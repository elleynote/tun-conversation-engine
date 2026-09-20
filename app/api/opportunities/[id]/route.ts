import { NextResponse } from "next/server";
import { updateOpportunity } from "@/lib/repository";
import type { OpportunityStatus } from "@/lib/types";

const allowed = new Set<OpportunityStatus>(["new","classified","qualified","ignored","drafted","awaiting_review","approved","rejected","posted","failed"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!allowed.has(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    const result = await updateOpportunity(id, { status: body.status, draft_body: typeof body.draft_body === "string" ? body.draft_body : undefined });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 500 });
  }
}
