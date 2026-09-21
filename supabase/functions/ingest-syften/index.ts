import { adminClient, json } from "../_shared/client.ts";
import { cronRequestAuthorized } from "../_shared/cron-auth.ts";

function redditThreadInfo(url?: string | null) {
  if (!url) return { threadKey: null, isThreadRoot: true };
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split("/").filter(Boolean);
    const commentsIndex = parts.indexOf("comments");
    if (commentsIndex === -1 || !parts[commentsIndex + 1]) return { threadKey: null, isThreadRoot: true };
    const postId = parts[commentsIndex + 1];
    const trailing = parts.slice(commentsIndex + 2);
    // Reddit root post URLs are /comments/{postId}/{slug}/.
    // Comment permalinks add one more segment for the comment id.
    const isThreadRoot = trailing.length <= 1;
    return { threadKey: `reddit:${postId}`, isThreadRoot };
  } catch {
    return { threadKey: null, isThreadRoot: true };
  }
}

Deno.serve(async (req: Request) => {
  if (!cronRequestAuthorized(req)) return json({ error: "Unauthorized" }, 401);
  try {
    const token = Deno.env.get("SYFTEN_API_TOKEN");
    if (!token) return json({ error: "SYFTEN_API_TOKEN missing" }, 500);
    const supabase = adminClient();
    const { data: source, error: sourceError } = await supabase.from("sources").upsert(
      { key: "syften", name: "Syften", source_type: "monitoring", enabled: true },
      { onConflict: "key" },
    ).select().single();
    if (sourceError) throw sourceError;

    const { data: cursor } = await supabase.from("settings").select("value").eq("key", "syften_cursor").maybeSingle();
    const after = cursor?.value?.matched_on;
    const res = await fetch("https://syften.com/api/0.1/items/get", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ limit: 100, show: "ai_accepted", ...(after ? { after } : {}) }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error || `Syften error ${res.status}`);
    const matches = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];

    let newest = after;
    let inserted = 0;
    const touchedThreadKeys = new Set<string>();

    for (const m of matches) {
      if (!newest || new Date(m.matched_on) > new Date(newest)) newest = m.matched_on;
      const originalUrl = m.item?.item_url || null;
      const platform = m.item?.backend || "unknown";
      const thread = originalUrl?.includes("reddit.com/")
        ? redditThreadInfo(originalUrl)
        : { threadKey: null, isThreadRoot: true };

      if (thread.threadKey) touchedThreadKeys.add(thread.threadKey);

      const { error } = await supabase.from("opportunities").upsert({
        source_id: source.id,
        external_id: m.id,
        platform,
        community: m.item?.backend_sub || null,
        author: m.item?.author || null,
        title: m.item?.title || null,
        content: m.item?.text || "",
        original_url: originalUrl,
        published_at: m.item?.timestamp || null,
        detected_at: m.matched_on,
        matched_filter: m.filter,
        status: thread.threadKey && !thread.isThreadRoot ? "ignored" : "new",
        source_analysis: m.item?.analysis || {},
        raw_payload: m,
        thread_key: thread.threadKey,
        is_thread_root: thread.isThreadRoot,
        suppression_reason: thread.threadKey && !thread.isThreadRoot ? "thread_context_only" : null,
      }, { onConflict: "source_id,external_id", ignoreDuplicates: true });
      if (!error) inserted++;
    }

    // If Syften supplied only comments for a Reddit thread, promote the earliest
    // comment as the single canonical opportunity so the thread is still reviewable.
    for (const threadKey of touchedThreadKeys) {
      const { data: rows, error: rowsError } = await supabase
        .from("opportunities")
        .select("id,status,is_thread_root,suppression_reason,detected_at")
        .eq("thread_key", threadKey)
        .order("is_thread_root", { ascending: false })
        .order("detected_at", { ascending: true });
      if (rowsError) throw rowsError;
      if (!rows?.length) continue;

      const root = rows.find((r: any) => r.is_thread_root) || rows[0];
      if (root.status === "ignored" && root.suppression_reason === "thread_context_only") {
        await supabase.from("opportunities").update({
          status: "new",
          suppression_reason: null,
          updated_at: new Date().toISOString(),
        }).eq("id", root.id);
      }

      const siblingIds = rows.filter((r: any) => r.id !== root.id && !["approved","rejected","posted"].includes(r.status)).map((r: any) => r.id);
      if (siblingIds.length) {
        await supabase.from("opportunities").update({
          status: "ignored",
          suppression_reason: "thread_context_only",
          updated_at: new Date().toISOString(),
        }).in("id", siblingIds);
      }
    }

    if (newest) {
      await supabase.from("settings").upsert({ key: "syften_cursor", value: { matched_on: newest } }, { onConflict: "key" });
    }
    return json({ ok: true, fetched: matches.length, processed: inserted, cursor: newest, threads_touched: touchedThreadKeys.size });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
