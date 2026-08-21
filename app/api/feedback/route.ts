import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

// POST /api/feedback — submit feedback after a job completes
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, giverAddress, receiverAddress, rating, comment } = body;

    // Validate inputs
    if (!jobId || !giverAddress || !receiverAddress) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
    }
    if (giverAddress === receiverAddress) {
      return NextResponse.json({ error: "Cannot rate yourself." }, { status: 400 });
    }

    // Upsert users to satisfy FK constraints
    await prisma.user.upsert({
      where: { walletAddress: giverAddress },
      create: { walletAddress: giverAddress },
      update: {},
    });
    await prisma.user.upsert({
      where: { walletAddress: receiverAddress },
      create: { walletAddress: receiverAddress },
      update: {},
    });

    // Find the job meta record
    const jobMeta = await prisma.jobMeta.findFirst({
      where: { onChainJobId: jobId.toString() },
    });

    if (!jobMeta) {
      // Create a minimal job meta if it doesn't exist (fallback)
      return NextResponse.json(
        { error: "Job metadata not found. Sync the job first." },
        { status: 404 }
      );
    }

    // Upsert feedback (one per giver per job)
    const feedback = await prisma.feedback.upsert({
      where: { jobMetaId_giverAddress: { jobMetaId: jobMeta.id, giverAddress } },
      create: {
        jobMetaId: jobMeta.id,
        giverAddress,
        receiverAddress,
        rating,
        comment: comment?.trim() || null,
      },
      update: { rating, comment: comment?.trim() || null },
    });

    return NextResponse.json({ success: true, feedbackId: feedback.id });
  } catch (err) {
    console.error("POST /api/feedback error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

// GET /api/feedback — aggregate stats for the status page
export async function GET() {
  try {
    const all = await prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
    });

    const count = all.length;
    const avgRating =
      count > 0
        ? all.reduce((sum: number, f: { rating: number }) => sum + f.rating, 0) / count
        : 0;

    const sampleComments = all
      .filter((f: { comment: string | null }) => f.comment && f.comment.trim().length > 0)
      .slice(0, 10)
      .map((f: { rating: number; comment: string | null; createdAt: Date }) => ({
        rating: f.rating,
        comment: f.comment,
        createdAt: f.createdAt,
      }));

    const distribution = [1, 2, 3, 4, 5].map((star) => ({
      star,
      count: all.filter((f: { rating: number }) => f.rating === star).length,
    }));

    return NextResponse.json({
      count,
      avgRating: Math.round(avgRating * 10) / 10,
      distribution,
      sampleComments,
    });
  } catch (err) {
    console.error("GET /api/feedback error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
