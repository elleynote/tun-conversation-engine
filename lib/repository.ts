import { demoOpportunities, demoProducts } from "./demo-data";
import { isLiveMode } from "./runtime";
import type { OpportunityStatus, OpportunityView, Product } from "./types";
import { relativeTime } from "./utils";
import { createAdminClient } from "./supabase/admin";
import { routeProducts } from "./routing/product-router";

export async function listOpportunities(): Promise<OpportunityView[]> {
  if (!isLiveMode()) return demoOpportunities;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select(`*, classifications(*), drafts(*)`)
    .order("detected_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const { data: products } = await supabase.from("products").select("*").eq("active", true);
  const productRows = (products ?? []) as Product[];

  return (data ?? []).map((row: any) => {
    const rawClassification = Array.isArray(row.classifications) ? row.classifications[0] : row.classifications;
    const classification = rawClassification ? {
      ...rawClassification,
      recommended_product_keys: Array.isArray(rawClassification.recommended_product_keys)
        ? rawClassification.recommended_product_keys
        : rawClassification.recommended_product_key ? [rawClassification.recommended_product_key] : [],
      response_mode: rawClassification.response_mode || "recommend_only",
      answer_confidence: Number(rawClassification.answer_confidence ?? 0),
    } : null;
    const drafts = Array.isArray(row.drafts) ? row.drafts : [];
    const latestDraft = drafts.sort((a: any, b: any) => (b.version ?? 0) - (a.version ?? 0))[0] ?? null;
    const routed = classification ? routeProducts(classification, productRows) : [];
    return {
      id: row.id,
      platform: row.platform,
      community: row.community,
      author: row.author,
      title: row.title,
      content: row.content,
      original_url: row.original_url,
      published_at: row.published_at,
      detected_at: row.detected_at,
      relativeTime: relativeTime(row.detected_at),
      status: row.status,
      matched_filter: row.matched_filter,
      classification,
      product: routed[0] ?? null,
      products: routed,
      draft: latestDraft,
    } satisfies OpportunityView;
  });
}

export async function getOpportunity(id: string): Promise<OpportunityView | null> {
  if (!isLiveMode()) return demoOpportunities.find((x) => x.id === id) ?? null;
  const list = await listOpportunities();
  return list.find((x) => x.id === id) ?? null;
}

export async function listProducts(): Promise<Product[]> {
  if (!isLiveMode()) return demoProducts;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("products").select("*").order("priority");
  if (error) throw error;
  return data ?? [];
}

export async function updateOpportunity(id: string, payload: { status: OpportunityStatus; draft_body?: string }) {
  if (!isLiveMode()) return { mode: "demo" as const };
  const supabase = createAdminClient();
  const { error } = await supabase.from("opportunities").update({ status: payload.status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;

  if (typeof payload.draft_body === "string") {
    const { data: current } = await supabase.from("drafts").select("version").eq("opportunity_id", id).order("version", { ascending: false }).limit(1);
    const version = (current?.[0]?.version ?? 0) + 1;
    const { error: draftError } = await supabase.from("drafts").insert({ opportunity_id: id, version, body: payload.draft_body, status: payload.status === "approved" ? "approved" : "edited", model: "human_edit" });
    if (draftError) throw draftError;
  }

  await supabase.from("actions").insert({ opportunity_id: id, action_type: payload.status, metadata: { source: "dashboard" } });
  return { mode: "live" as const };
}
