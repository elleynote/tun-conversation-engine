import { demoOpportunities, demoProducts } from "./demo-data";
import { hasOpenAI, hasSyften, isLiveMode } from "./runtime";
import type { ActivityItem, AutomationStatus, OpportunityStatus, OpportunityView, Product, ThreadItem } from "./types";
import { cleanSourceText, relativeTime } from "./utils";
import { createAdminClient } from "./supabase/admin";
import { routeProducts } from "./routing/product-router";

function avatarFromRow(row: any): string | null {
  const item = row?.raw_payload?.item ?? {};
  const values = [
    item.author_avatar,
    item.authorAvatar,
    item.avatar,
    item.profile_image,
    item.profileImage,
    item.author_image,
    item.authorImage,
    row?.source_analysis?.avatar,
  ];
  return values.find((value) => typeof value === "string" && /^https?:\/\//i.test(value)) ?? null;
}

function mapOpportunity(row: any, productRows: Product[]): OpportunityView {
  const rawClassification = Array.isArray(row.classifications) ? row.classifications[0] : row.classifications;
  const classification = rawClassification ? {
    ...rawClassification,
    recommended_product_keys: Array.isArray(rawClassification.recommended_product_keys)
      ? rawClassification.recommended_product_keys
      : rawClassification.recommended_product_key ? [rawClassification.recommended_product_key] : [],
    response_mode: rawClassification.response_mode || "recommend_only",
    answer_confidence: Number(rawClassification.answer_confidence ?? 0),
  } : null;
  const drafts = Array.isArray(row.drafts) ? [...row.drafts] : [];
  const latestDraft = drafts.sort((a: any, b: any) => (b.version ?? 0) - (a.version ?? 0))[0] ?? null;
  const routed = classification && classification.should_reply && classification.response_mode !== "do_not_reply"
    ? routeProducts(classification, productRows)
    : [];

  return {
    id: row.id,
    platform: row.platform,
    community: row.community,
    author: row.author,
    author_avatar_url: avatarFromRow(row),
    title: cleanSourceText(row.title),
    content: cleanSourceText(row.content),
    original_url: row.original_url,
    published_at: row.published_at,
    detected_at: row.detected_at,
    relativeTime: relativeTime(row.detected_at),
    status: row.status,
    matched_filter: row.matched_filter,
    thread_key: row.thread_key ?? null,
    is_thread_root: row.is_thread_root ?? true,
    suppression_reason: row.suppression_reason ?? null,
    classification,
    product: routed[0] ?? null,
    products: routed,
    draft: latestDraft,
  } satisfies OpportunityView;
}

export async function listOpportunities(options: { includeSuppressed?: boolean } = {}): Promise<OpportunityView[]> {
  if (!isLiveMode()) return demoOpportunities.map((row) => ({ ...row, author_avatar_url: null }));
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select(`*, classifications(*), drafts(*)`)
    .order("detected_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const { data: products } = await supabase.from("products").select("*").eq("active", true);
  const productRows = (products ?? []) as Product[];

  const rows = (data ?? []).map((row: any) => mapOpportunity(row, productRows));
  return options.includeSuppressed ? rows : rows.filter((row) => row.suppression_reason !== "thread_context_only");
}

export async function getOpportunity(id: string): Promise<OpportunityView | null> {
  if (!isLiveMode()) {
    const demo = demoOpportunities.find((x) => x.id === id);
    return demo ? { ...demo, author_avatar_url: null } : null;
  }
  const supabase = createAdminClient();

  const [{ data: row, error }, { data: products }] = await Promise.all([
    supabase.from("opportunities").select(`*, classifications(*), drafts(*)`).eq("id", id).single(),
    supabase.from("products").select("*").eq("active", true),
  ]);
  if (error) return null;

  const opportunity = mapOpportunity(row, (products ?? []) as Product[]);
  const rawClassification = Array.isArray(row.classifications) ? row.classifications[0] : row.classifications;
  const drafts = Array.isArray(row.drafts) ? row.drafts : [];

  const activityPromises = [
    supabase.from("actions").select("*").eq("opportunity_id", id).order("created_at", { ascending: true }),
    supabase.from("events").select("*").eq("opportunity_id", id).order("created_at", { ascending: true }),
  ] as const;
  const [{ data: actions }, { data: events }] = await Promise.all(activityPromises);

  if (opportunity.thread_key) {
    const { data: threadRows } = await supabase
      .from("opportunities")
      .select("id,author,content,original_url,detected_at,is_thread_root,status,suppression_reason,raw_payload,source_analysis")
      .eq("thread_key", opportunity.thread_key)
      .order("is_thread_root", { ascending: false })
      .order("detected_at", { ascending: true });

    opportunity.thread_items = (threadRows ?? []).map((item: any) => ({
      id: item.id,
      author: item.author,
      author_avatar_url: avatarFromRow(item),
      content: cleanSourceText(item.content),
      original_url: item.original_url,
      detected_at: item.detected_at,
      relativeTime: relativeTime(item.detected_at),
      is_thread_root: Boolean(item.is_thread_root),
      status: item.status,
      suppression_reason: item.suppression_reason ?? null,
    } satisfies ThreadItem));
  }

  const activity: ActivityItem[] = [
    {
      id: `detected-${id}`,
      type: "detected",
      label: "Detected by Syften",
      detail: opportunity.thread_key ? `Grouped as ${opportunity.thread_key}` : opportunity.matched_filter || null,
      created_at: opportunity.detected_at,
    },
  ];

  if (rawClassification?.updated_at || rawClassification?.created_at) {
    activity.push({
      id: `classification-${id}`,
      type: "classified",
      label: rawClassification.should_reply ? "AI classified opportunity" : "AI did not queue a reply",
      detail: rawClassification.reason || null,
      created_at: rawClassification.updated_at || rawClassification.created_at,
    });
  }

  for (const draft of drafts) {
    if (!draft?.created_at) continue;
    activity.push({
      id: `draft-${draft.id || draft.version}`,
      type: "draft",
      label: draft.status === "edited" ? "Draft edited" : draft.status === "approved" ? "Draft approved" : "AI draft generated",
      detail: draft.model ? `Version ${draft.version ?? 1} • ${draft.model}` : `Version ${draft.version ?? 1}`,
      created_at: draft.created_at,
    });
  }

  for (const action of actions ?? []) {
    activity.push({
      id: `action-${action.id}`,
      type: action.action_type,
      label: action.action_type.replaceAll("_", " "),
      detail: action.external_url || null,
      created_at: action.created_at,
    });
  }

  for (const event of events ?? []) {
    activity.push({
      id: `event-${event.id}`,
      type: event.event_type,
      label: event.event_type.replaceAll("_", " "),
      detail: event.message,
      created_at: event.created_at,
    });
  }

  opportunity.activity = activity.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return opportunity;
}

export async function getAutomationStatus(): Promise<AutomationStatus> {
  if (!isLiveMode()) {
    return {
      syftenConnected: false,
      openAIConnected: false,
      lastSyftenCheck: null,
      lastPipelineRun: null,
      lastSyftenCursor: null,
      newToday: 0,
    };
  }

  const supabase = createAdminClient();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [{ data: settings }, { count }] = await Promise.all([
    supabase.from("settings").select("key,value").in("key", ["syften_cursor", "syften_last_run", "pipeline_last_run"]),
    supabase.from("opportunities").select("id", { count: "exact", head: true }).gte("detected_at", today.toISOString()),
  ]);

  const values = new Map((settings ?? []).map((row: any) => [row.key, row.value]));
  const syftenRun: any = values.get("syften_last_run");
  const pipelineRun: any = values.get("pipeline_last_run");
  const cursor: any = values.get("syften_cursor");

  return {
    syftenConnected: Boolean(syftenRun?.at || cursor?.matched_on || hasSyften()),
    openAIConnected: Boolean(pipelineRun?.at || hasOpenAI()),
    lastSyftenCheck: syftenRun?.at ?? null,
    lastPipelineRun: pipelineRun?.at ?? null,
    lastSyftenCursor: cursor?.matched_on ?? null,
    newToday: count ?? 0,
  };
}

export async function listProducts(): Promise<Product[]> {
  if (!isLiveMode()) return demoProducts;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("products").select("*").order("priority");
  if (error) throw error;
  return data ?? [];
}

export async function promoteOpportunity(id: string) {
  if (!isLiveMode()) return { mode: "demo" as const };
  const supabase = createAdminClient();
  const { data: current, error: readError } = await supabase
    .from("opportunities")
    .select("id,status,suppression_reason,thread_key")
    .eq("id", id)
    .single();
  if (readError) throw readError;

  const { error } = await supabase.from("opportunities").update({
    status: "awaiting_review",
    suppression_reason: null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;

  await supabase.from("actions").insert({
    opportunity_id: id,
    action_type: "manual_reply_override",
    metadata: {
      source: "dashboard",
      previous_status: current.status,
      previous_suppression_reason: current.suppression_reason,
      thread_key: current.thread_key,
      feedback_for_rules: true,
    },
  });
  return { mode: "live" as const };
}

export async function updateOpportunity(id: string, payload: { status: OpportunityStatus; draft_body?: string }) {
  if (!isLiveMode()) return { mode: "demo" as const };
  const supabase = createAdminClient();
  const { error } = await supabase.from("opportunities").update({ status: payload.status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;

  if (typeof payload.draft_body === "string") {
    const { data: current } = await supabase.from("drafts").select("id,version,body,status").eq("opportunity_id", id).order("version", { ascending: false }).limit(1);
    const latest = current?.[0];
    if (latest?.body === payload.draft_body) {
      if (payload.status === "approved" && latest.status !== "approved") {
        const { error: updateDraftError } = await supabase.from("drafts").update({ status: "approved" }).eq("id", latest.id);
        if (updateDraftError) throw updateDraftError;
      }
    } else {
      const version = (latest?.version ?? 0) + 1;
      const { error: draftError } = await supabase.from("drafts").insert({
        opportunity_id: id,
        version,
        body: payload.draft_body,
        status: payload.status === "approved" ? "approved" : "edited",
        model: "human_edit",
      });
      if (draftError) throw draftError;
    }
  }

  await supabase.from("actions").insert({ opportunity_id: id, action_type: payload.status, metadata: { source: "dashboard", manual_reddit_posting: payload.status === "posted" } });
  return { mode: "live" as const };
}
