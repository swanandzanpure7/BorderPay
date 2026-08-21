import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

// GET /api/status — aggregate platform health and analytics
export async function GET() {
  try {
    const [
      jobCount,
      feedbackStats,
      recentTx,
    ] = await Promise.all([
      prisma.jobMeta.count(),
      prisma.feedback.aggregate({
        _avg: { rating: true },
        _count: { id: true },
      }),
      prisma.txHistory.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          txHash: true,
          action: true,
          actorAddress: true,
          createdAt: true,
        },
      }),
    ]);

    const statusBreakdown = await prisma.jobMeta.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
      contractId: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "not configured",
      jobs: {
        total: jobCount,
        byStatus: statusBreakdown.map((s: { status: string; _count: { id: number } }) => ({
          status: s.status,
          count: s._count.id,
        })),
      },
      feedback: {
        count: feedbackStats._count.id,
        avgRating: feedbackStats._avg.rating
          ? Math.round(feedbackStats._avg.rating * 10) / 10
          : null,
      },
      recentTransactions: recentTx,
    });
  } catch (err) {
    console.error("GET /api/status error:", err);
    // Return partial data even if DB is unavailable
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
      contractId: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "not configured",
      error: "Database unavailable — showing config only.",
    });
  }
}
