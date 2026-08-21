import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

// POST /api/jobs — sync off-chain job metadata after on-chain creation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      onChainJobId,
      contractId,
      title,
      description,
      clientAddress,
      freelancerAddress,
      tokenAddress,
      totalAmountStroops,
      milestones,
      createTxHash,
      // tx recording fields
      txHash,
      action,
      actorAddress,
      txMetadata,
    } = body;

    if (!onChainJobId) {
      return NextResponse.json({ error: "Missing onChainJobId." }, { status: 400 });
    }

    const isCreateOnly = !clientAddress || !freelancerAddress;

    if (!isCreateOnly) {
      await prisma.user.upsert({
        where: { walletAddress: clientAddress },
        create: { walletAddress: clientAddress },
        update: {},
      });
      await prisma.user.upsert({
        where: { walletAddress: freelancerAddress },
        create: { walletAddress: freelancerAddress },
        update: {},
      });
    }

    const existing = await prisma.jobMeta.findUnique({
      where: { onChainJobId: onChainJobId.toString() },
      select: { id: true },
    });
    if (!existing && isCreateOnly) {
      return NextResponse.json({ error: "Missing required fields for job creation." }, { status: 400 });
    }

    let jobMeta;
    if (existing) {
      jobMeta = await prisma.jobMeta.update({
        where: { onChainJobId: onChainJobId.toString() },
        data: {
          ...(title ? { title } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(createTxHash ? { createTxHash } : {}),
          ...(body.fundTxHash ? { fundTxHash: body.fundTxHash } : {}),
        },
      });
    } else {
      jobMeta = await prisma.jobMeta.create({
        data: {
          onChainJobId: onChainJobId.toString(),
          contractId: contractId || process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "",
          title: title || `Job #${onChainJobId}`,
          description: description || null,
          clientAddress,
          freelancerAddress,
          tokenAddress: tokenAddress || "",
          totalAmountStroops: totalAmountStroops?.toString() || "0",
          createTxHash: createTxHash || null,
        },
      });
    }

    // Record tx hash into TxHistory if provided
    if (txHash && action && actorAddress) {
      await prisma.txHistory.upsert({
        where: { txHash },
        create: {
          jobMetaId: jobMeta.id,
          txHash,
          action,
          actorAddress,
          metadata: txMetadata || null,
        },
        update: {},
      });
    }
    // Also record createTxHash / fundTxHash automatically
    if (createTxHash && clientAddress) {
      await prisma.txHistory.upsert({
        where: { txHash: createTxHash },
        create: {
          jobMetaId: jobMeta.id,
          txHash: createTxHash,
          action: "create_job",
          actorAddress: clientAddress,
        },
        update: {},
      });
    }
    if (body.fundTxHash && clientAddress) {
      await prisma.txHistory.upsert({
        where: { txHash: body.fundTxHash },
        create: {
          jobMetaId: jobMeta.id,
          txHash: body.fundTxHash,
          action: "fund_job",
          actorAddress: clientAddress,
        },
        update: {},
      });
    }

    // Sync milestones
    if (milestones && Array.isArray(milestones)) {
      for (const m of milestones) {
        await prisma.milestoneMeta.upsert({
          where: {
            jobMetaId_milestoneIndex: {
              jobMetaId: jobMeta.id,
              milestoneIndex: m.index,
            },
          },
          create: {
            jobMetaId: jobMeta.id,
            milestoneIndex: m.index,
            description: m.description,
            amountStroops: m.amount?.toString() || "0",
          },
          update: { description: m.description },
        });
      }
    }

    return NextResponse.json({ success: true, jobMetaId: jobMeta.id });
  } catch (err) {
    console.error("POST /api/jobs error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// GET /api/jobs?address=G... — fetch job metadata by wallet address
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address param required." }, { status: 400 });
  }

  try {
    const jobs = await prisma.jobMeta.findMany({
      where: {
        OR: [{ clientAddress: address }, { freelancerAddress: address }],
      },
      include: { milestones: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(jobs);
  } catch (err) {
    console.error("GET /api/jobs error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
