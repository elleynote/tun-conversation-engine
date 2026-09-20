import { NextResponse } from "next/server";
import { fetchSyftenMatches } from "@/lib/syften/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveMode } from "@/lib/runtime";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isLiveMode()) return NextResponse.json({ error: "APP_MODE must be live and Supabase configured" }, { status: 400 });
  try {
    const supabase = createAdminClient();
    const { data: source, error: sourceError } = await supabase.from("sources").upsert({ key: "syften", name: "Syften", source_type: "monitoring", enabled: true }, { onConflict: "key" }).select().single();
    if (sourceError) throw sourceError;

    const { data: cursorRow } = await supabase.from("settings").select("value").eq("key", "syften_cursor").maybeSingle();
    const after = cursorRow?.value?.matched_on as string | undefined;
    const matches = await fetchSyftenMatches({ after, limit: 100, show: "all" });
    let inserted = 0;
    let newest = after;
    for (const m of matches) {
      if (!newest || new Date(m.matched_on) > new Date(newest)) newest = m.matched_on;
      const row = {
        source_id: source.id,
        external_id: m.id,
        platform: m.item.backend || "unknown",
        community: m.item.backend_sub || null,
        author: m.item.author || null,
        title: m.item.title || null,
        content: m.item.text || "",
        original_url: m.item.item_url || null,
        published_at: m.item.timestamp || null,
        detected_at: m.matched_on,
        matched_filter: m.filter,
        status: "new",
        source_analysis: m.item.analysis || {},
        raw_payload: m,
      };
      const { error } = await supabase.from("opportunities").upsert(row, { onConflict: "source_id,external_id", ignoreDuplicates: true });
      if (!error) inserted++;
    }
    if (newest) await supabase.from("settings").upsert({ key: "syften_cursor", value: { matched_on: newest } }, { onConflict: "key" });
    return NextResponse.json({ ok: true, fetched: matches.length, processed: inserted, cursor: newest });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ingestion failed" }, { status: 500 });
  }
}
