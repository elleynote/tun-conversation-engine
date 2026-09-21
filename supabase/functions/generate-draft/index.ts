import { adminClient, json } from "../_shared/client.ts";
import { outputText, responses } from "../_shared/openai.ts";

function approvedProductContext(products: any[]) {
  if (!products.length) return "No product recommendation is approved for this conversation.";
  return products.map((p) => {
    const claims = Array.isArray(p.metadata?.claims) ? p.metadata.claims.join(" | ") : "";
    const offer = typeof p.metadata?.offer === "string" ? p.metadata.offer : "";
    return `${p.name}\nURL: ${p.url || "URL pending confirmation"}\nDescription: ${p.description}\nApproved claims: ${claims || "none supplied"}\nOffer: ${offer || "none supplied"}`;
  }).join("\n\n");
}

Deno.serve(async (req: Request) => {
  try {
    const { opportunity_id } = await req.json();
    if (!opportunity_id) return json({ error: "opportunity_id required" }, 400);
    const supabase = adminClient();
    const { data: opportunity, error: oppError } = await supabase.from("opportunities").select("*").eq("id", opportunity_id).single();
    if (oppError) throw oppError;
    const { data: classification, error: classError } = await supabase.from("classifications").select("*").eq("opportunity_id", opportunity_id).single();
    if (classError) throw classError;

    let threadContext = "";
    if (opportunity.thread_key) {
      const { data: threadRows, error: threadError } = await supabase
        .from("opportunities")
        .select("content,is_thread_root,detected_at")
        .eq("thread_key", opportunity.thread_key)
        .order("is_thread_root", { ascending: false })
        .order("detected_at", { ascending: true });
      if (threadError) throw threadError;
      threadContext = (threadRows ?? []).map((r: any, i: number) =>
        `${r.is_thread_root ? "ROOT POST" : `COMMENT ${i}`}: ${r.content || ""}`
      ).join("\n\n");
    }

    if (!classification.should_reply || classification.response_mode === "do_not_reply") {
      await supabase.from("opportunities").update({ status: "ignored", updated_at: new Date().toISOString() }).eq("id", opportunity_id);
      return json({ ok: true, ignored: true, reason: "classification says do not reply" });
    }

    const keys = Array.isArray(classification.recommended_product_keys) && classification.recommended_product_keys.length
      ? classification.recommended_product_keys
      : classification.recommended_product_key ? [classification.recommended_product_key] : [];
    let products: any[] = [];
    if (keys.length) {
      const { data } = await supabase.from("products").select("*").in("key", keys).eq("active", true);
      products = (data ?? []).sort((a: any, b: any) => keys.indexOf(a.key) - keys.indexOf(b.key));
    }

    const { data: rules } = await supabase.from("community_rules").select("*").eq("platform", opportunity.platform).eq("community", opportunity.community || "").maybeSingle();
    const { data: brand } = await supabase.from("settings").select("value").eq("key", "brand_voice").maybeSingle();
    const result = await responses({
      model: Deno.env.get("OPENAI_DRAFT_MODEL") || "gpt-5.6-terra",
      reasoning: { effort: "low" },
      instructions: `Write one natural public reply for Tun's Armenian-language ecosystem.

Follow response_mode exactly:
- answer_and_recommend: briefly answer the actual question first, then naturally recommend only approved resources below.
- recommend_only: do not invent an exact language answer; make the useful recommendation and explain why it fits.
- answer_only: answer helpfully and do not promote any product.
- do_not_reply: return an empty string.

Rules:
- Be concise, warm, practical, human and transparent.
- Never pretend to be an unaffiliated ordinary user.
- Do not dump several products simply because they exist.
- Use only approved claims/URLs below.
- If exact Armenian wording, translation, pronunciation, dialect or grammar is uncertain, do not guess.
- Mention Tun's 4 lessons for $1 only when Tun is genuinely relevant and it fits naturally.
- Respect community rules and avoid sensitive/inappropriate promotion.
- Use the full thread context to avoid repeating an answer that another commenter has already given.
- Return only final reply text.

Brand voice: ${brand?.value?.text || "Helpful, warm, practical and not salesy."}\nCommunity rules: ${rules?.rules_text || "No special rules supplied."}`,
      input: `Community: ${opportunity.community || "unknown"}\nTitle: ${opportunity.title || ""}\nPrimary conversation: ${opportunity.content}\n\nFull thread context:\n${threadContext || "(no additional thread context)"}\n\nIntent: ${classification.intent}\nResponse mode: ${classification.response_mode}\nAnswer confidence: ${classification.answer_confidence}\nApproved resources:\n${approvedProductContext(products)}`,
    });
    const body = outputText(result).trim();
    if (!body) {
      await supabase.from("opportunities").update({ status: "ignored", updated_at: new Date().toISOString() }).eq("id", opportunity_id);
      return json({ ok: true, ignored: true, reason: "empty draft" });
    }
    const { data: latest } = await supabase.from("drafts").select("version").eq("opportunity_id", opportunity_id).order("version", { ascending: false }).limit(1);
    const version = (latest?.[0]?.version || 0) + 1;
    await supabase.from("drafts").insert({ opportunity_id, version, body, model: Deno.env.get("OPENAI_DRAFT_MODEL") || "gpt-5.6-terra", status: "generated", metadata: { response_id: result.id, response_mode: classification.response_mode, product_keys: keys } });
    await supabase.from("opportunities").update({ status: "awaiting_review", updated_at: new Date().toISOString() }).eq("id", opportunity_id);
    return json({ ok: true, draft: body, version });
  } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 500); }
});
