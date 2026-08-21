/**
 * POST /api/faucet
 * Sends 100 testnet USDC to the requesting wallet.
 * - Establishes a trustline if needed (via separate flow — user must do that themselves)
 * - Sends USDC from the distributor account
 *
 * Body: { address: string }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  Keypair, Networks, TransactionBuilder, BASE_FEE,
  Operation, Asset, Horizon
} from "@stellar/stellar-sdk";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NP = Networks.TESTNET;
const USDC_AMOUNT = "100"; // 100 USDC per request

// Rate limiting: simple in-memory store (resets on cold start)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address || typeof address !== "string" || !address.startsWith("G") || address.length !== 56) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    // Rate limit check
    const lastRequest = rateLimitMap.get(address);
    if (lastRequest && Date.now() - lastRequest < RATE_LIMIT_MS) {
      const waitMins = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastRequest)) / 60000);
      return NextResponse.json(
        { error: `Rate limited. Try again in ${waitMins} minute(s).` },
        { status: 429 }
      );
    }

    const faucetSecret = process.env.FAUCET_SECRET;
    const issuerPublic = process.env.USDC_ISSUER_PUBLIC;
    const issuerSecret = process.env.USDC_ISSUER_SECRET;

    if (!faucetSecret || !issuerPublic || !issuerSecret) {
      return NextResponse.json({ error: "Faucet not configured" }, { status: 500 });
    }

    const faucetKp = Keypair.fromSecret(faucetSecret);
    const issuerKp = Keypair.fromSecret(issuerSecret);
    const USDC = new Asset("USDC", issuerPublic);

    const horizon = new Horizon.Server(HORIZON_URL);

    // Check if user has the USDC trustline
    let userHasTrustline = false;
    try {
      const userAccount = await horizon.loadAccount(address);
      userHasTrustline = userAccount.balances.some(
        (b: any) => b.asset_code === "USDC" && b.asset_issuer === issuerPublic
      );
    } catch {
      // Account doesn't exist yet — needs XLM first
      return NextResponse.json(
        { error: "Account not found on testnet. Fund it with XLM first via Friendbot." },
        { status: 400 }
      );
    }

    if (!userHasTrustline) {
      // We can't add a trustline on behalf of the user — they must do it
      // Instead, return a helpful error with instructions
      return NextResponse.json(
        {
          error: "TRUSTLINE_REQUIRED",
          message: "You need to add a USDC trustline first. Click 'Add Trustline' below.",
          issuer: issuerPublic,
          assetCode: "USDC",
        },
        { status: 400 }
      );
    }

    // Mint fresh USDC from issuer to user directly (issuer can always send)
    const issuerAccount = await horizon.loadAccount(issuerKp.publicKey());
    const tx = new TransactionBuilder(issuerAccount, { fee: BASE_FEE, networkPassphrase: NP })
      .addOperation(
        Operation.payment({
          destination: address,
          asset: USDC,
          amount: USDC_AMOUNT,
        })
      )
      .setTimeout(30)
      .build();
    tx.sign(issuerKp);

    const result = await horizon.submitTransaction(tx);

    // Record rate limit
    rateLimitMap.set(address, Date.now());

    return NextResponse.json({
      success: true,
      txHash: result.hash,
      amount: USDC_AMOUNT,
      message: `${USDC_AMOUNT} testnet USDC sent to your wallet!`,
    });
  } catch (err: unknown) {
    console.error("Faucet error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
