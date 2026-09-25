import { NextResponse } from "next/server";
import { dismissOpportunity } from "@/lib/repository";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await dismissOpportunity(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dismiss failed" },
      { status: 500 },
    );
  }
}
