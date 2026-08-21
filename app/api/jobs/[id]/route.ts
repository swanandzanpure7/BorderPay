import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/jobs/[id] — fetch tx history for a specific on-chain job ID
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const jobMeta = await prisma.jobMeta.findUnique({
      where: { onChainJobId: id },
      include: {
        txHistory: { orderBy: { createdAt: "asc" } },
        milestones: { orderBy: { milestoneIndex: "asc" } },
      },
    });

    if (!jobMeta) return NextResponse.json({ txHistory: [] });

    return NextResponse.json({
      txHistory: jobMeta.txHistory,
      milestones: jobMeta.milestones,
    });
  } catch (err) {
    console.error("GET /api/jobs/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
