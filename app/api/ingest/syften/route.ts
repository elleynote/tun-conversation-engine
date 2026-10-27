import { NextResponse } from "next/server";
import { fetchSyftenMatches } from "@/lib/syften/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveMode } from "@/lib/runtime";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function detectPlatform(backend?: string | null, url?: string | null): string {
  if (url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
      if (host === "youtu.be" || host.includes("youtube.com")) return "youtube";
      if (host.includes("facebook.com") || host === "fb.com" || host.includes("fb.watch")) return "facebook";
      if (host.includes("instagram.com")) return "instagram";
      if (host.includes("twitter.com") || host.includes("x.com")) return "x";
      if (host.includes("reddit.com")) return "reddit";
    } catch {}
  }
  const raw = String(backend || "").toLowerCase();
  if (raw.includes("facebook") || raw === "fb") return "facebook";
  if (raw.includes("instagram") || raw === "ig") return "instagram";
  if (raw.includes("twitter") || raw === "x") return "x";
  if (raw.includes("reddit")) return "reddit";
  if (raw.includes("youtube")) return "youtube";
  return raw || "unknown";
}

function detectThreadInfo(platform: string, url?: string | null) {
  if (!url) return { threadKey: null, isThreadRoot: true };
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (platform === "reddit") {
      const commentsIndex = parts.indexOf("comments");
      if (commentsIndex !== -1 && parts[commentsIndex + 1]) {
        return { threadKey: `reddit:${parts[commentsIndex + 1]}`, isThreadRoot: parts.slice(commentsIndex + 2).length <= 1 };
      }
    }
    if (platform === "facebook") {
      const postsIdx = parts.indexOf("posts");
      if (postsIdx !== -1 && parts[postsIdx + 1]) {
        return { threadKey: `facebook:${parts[postsIdx + 1]}`, isThreadRoot: true };
      }
      const storyId = parsed.searchParams.get("story_fbid") || parsed.searchParams.get("id");
      if (storyId) return { threadKey: `facebook:${storyId}`, isThreadRoot: true };
    }
    if (platform === "instagram") {
      if (["p", "reel", "tv"].includes(parts[0]) && parts[1]) {
        return { threadKey: `instagram:${parts[1]}`, isThreadRoot: true };
      }
    }
    if (platform === "x") {
      const statusIdx = parts.indexOf("status");
      if (statusIdx !== -1 && parts[statusIdx + 1]) {
        return { threadKey: `x:${parts[statusIdx + 1]}`, isThreadRoot: true };
      }
    }
  } catch {}
  return { threadKey: null, isThreadRoot: true };
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
      const originalUrl = m.item.item_url || null;
      const platform = detectPlatform(m.item.backend, originalUrl);
      const thread = detectThreadInfo(platform, originalUrl);

      const row = {
        source_id: source.id,
        external_id: m.id,
        platform,
        community: m.item.backend_sub || null,
        author: m.item.author || null,
        title: m.item.title || null,
        content: m.item.text || "",
        original_url: originalUrl,
        published_at: m.item.timestamp || null,
        detected_at: m.matched_on,
        matched_filter: m.filter,
        status: "new",
        source_analysis: m.item.analysis || {},
        raw_payload: m,
        thread_key: thread.threadKey,
        is_thread_root: thread.isThreadRoot,
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
