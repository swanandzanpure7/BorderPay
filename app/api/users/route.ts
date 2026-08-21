import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

// GET /api/users?address=G... — fetch user profile
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address param required." }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { walletAddress: address },
      include: {
        feedbackReceived: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { rating: true, comment: true, createdAt: true, giverAddress: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ walletAddress: address, feedbackReceived: [] });
    }

    return NextResponse.json(user);
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// PUT /api/users — update profile
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, displayName, bio } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress required." }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { walletAddress },
      create: { walletAddress, displayName, bio },
      update: { displayName, bio },
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error("PUT /api/users error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
