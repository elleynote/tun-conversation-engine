import { adminClient, json } from "../_shared/client.ts";
import { outputText, responses } from "../_shared/openai.ts";

function approvedProductContext(products: any[]) {
  if (!products.length) return "No product recommendation is approved for this conversation.";
  return products.map((p) => {
    const claims = Array.isArray(p.metadata?.claims) ? p.metadata.claims.join(" | ") : "";
    const offer = typeof p.metadata?.offer === "string" ? p.metadata.offer : "";
    return `${p.name}
URL: ${p.url || "URL pending confirmation"}
Description: ${p.description}
Approved claims: ${claims || "none supplied"}
Offer: ${offer || "none supplied"}`;
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

    const communityKey = String(opportunity.community || "").replace(/^r\//i, "").toLowerCase();
    const { data: rules } = await supabase
      .from("community_rules")
      .select("*")
      .eq("platform", opportunity.platform)
      .ilike("community", communityKey)
      .maybeSingle();
    const { data: brand } = await supabase.from("settings").select("value").eq("key", "brand_voice").maybeSingle();

    const ruleNotes = String(rules?.notes || "").toLowerCase();
    const promotionBlocked = rules?.links_allowed === false || String(rules?.self_promotion || "").toLowerCase() === "prohibited";
    const manualReplyOnly = ruleNotes.includes("manual_reply_only");
    const deprioritizeOrDrop = ruleNotes.includes("deprioritize_or_drop");

    if (deprioritizeOrDrop) {
      await supabase.from("opportunities").update({ status: "ignored", updated_at: new Date().toISOString() }).eq("id", opportunity_id);
      return json({ ok: true, ignored: true, reason: "community policy deprioritizes automated engagement" });
    }

    if (manualReplyOnly) {
      await supabase.from("opportunities").update({ status: "awaiting_review", updated_at: new Date().toISOString() }).eq("id", opportunity_id);
      return json({ ok: true, manual_required: true, reason: "community requires a human-written reply" });
    }

    if (promotionBlocked) {
      products = [];
    }
    const result = await responses({
      model: Deno.env.get("OPENAI_DRAFT_MODEL") || "gpt-5.6-terra",
      reasoning: { effort: "low" },
      instructions: `Write one natural public Reddit reply for Tun's Armenian-language ecosystem.

Follow response_mode exactly:
- answer_and_recommend: briefly answer the actual question first, then naturally recommend only approved resources below.
- recommend_only: do not invent an exact language answer; make the useful recommendation and explain why it fits.
- answer_only: answer helpfully and do not promote any product.
- do_not_reply: return an empty string.

Rules:
- Sound like a knowledgeable person helping in the conversation, not like a corporate/company account.
- Answer the person's actual question genuinely before mentioning any Tun resource.
- If mentioning something we own, be transparent and natural, for example "we built..." or "we offer..."; never pretend to be unaffiliated.
- The 4 lessons for $1 offer may appear only when the person has a genuine learning need and it fits naturally. Never lead with the offer or use it as sales copy.
- Be concise, casual, helpful, friendly and human.
- Do not pretend to be an unaffiliated ordinary Reddit user.
- Do not dump several products simply because they exist.
- Use only approved claims/URLs below.
- The classifier has already selected the relevant resources. For answer_and_recommend or recommend_only, if more than one approved resource is supplied, mention EVERY supplied approved resource exactly once. Do not silently drop one of the classifier-selected resources.
- When both the Armenian Verb Conjugation Tool and English to Armenian Translation are approved, naturally explain the distinct value of both: use armenianverbs.com for verb forms/tenses and translatearmenian.com for quick English-to-Western-Armenian translation.
- If exact Armenian wording, translation, pronunciation, dialect or grammar is uncertain, do not guess.
- An existing answer elsewhere in the thread does not automatically prevent a reply. Add distinct value instead of repeating what is already there.
- Default to one useful reply to the thread. Do not address every comment unless a reviewer separately promotes a comment as its own opportunity.
- Respect community rules and avoid sensitive/inappropriate promotion.
- Return only final reply text.

Brand voice: ${brand?.value?.text || "Casual, helpful, friendly and human. Answer the actual question first and do not sound salesy."}
Community rules: ${rules?.rules_text || "No special rules supplied."}
Community notes: ${rules?.notes || "None"}`,
      input: `Community: ${opportunity.community || "unknown"}
Title: ${opportunity.title || ""}
Primary conversation: ${opportunity.content}

Full thread context:
${threadContext || "(no additional thread context)"}

Intent: ${classification.intent}
Response mode: ${classification.response_mode}
Answer confidence: ${classification.answer_confidence}
Approved resources:
${approvedProductContext(products)}`,
    });
    let body = outputText(result).trim();
    let finalResponseId = result.id;

    // Deterministic guard: when the classifier intentionally selected multiple
    // resources for a recommendation response, the final draft must include
    // every selected resource URL. If the first model pass drops one, repair
    // the draft once rather than silently publishing an incomplete recommendation.
    const recommendationMode =
      classification.response_mode === "answer_and_recommend" ||
      classification.response_mode === "recommend_only";
    const requiredUrls = recommendationMode
      ? products
          .map((p: any) => typeof p.url === "string" ? p.url.trim() : "")
          .filter((url: string) => Boolean(url))
      : [];
    const missingUrls = requiredUrls.filter(
      (url: string) => !body.toLowerCase().includes(url.toLowerCase())
    );

    if (body && missingUrls.length > 0) {
      const repaired = await responses({
        model: Deno.env.get("OPENAI_DRAFT_MODEL") || "gpt-5.6-terra",
        reasoning: { effort: "low" },
        instructions: `Revise the supplied Reddit reply without changing its useful answer.

Requirements:
- Keep it concise, warm, practical, human and not salesy.
- Keep the voice person-like and helpful rather than corporate or salesy.
- If mentioning an owned resource, disclose it naturally with wording such as "we built..." rather than pretending to be unaffiliated.
- Preserve the original answer unless a wording change is needed for flow.
- Include EVERY required approved resource URL exactly once.
- Do not add any unapproved resource, claim, offer or URL.
- When both armenianverbs.com and translatearmenian.com are required, explain their distinct uses naturally: the verb tool is for verb forms/tenses, and the translation tool is for quick English-to-Western-Armenian translation.
- Return only the final revised reply text.`,
        input: `Current reply:
${body}

Required approved resource URLs:
${requiredUrls.join("\n")}`,
      });

      const repairedBody = outputText(repaired).trim();
      if (repairedBody) {
        const stillMissing = requiredUrls.filter(
          (url: string) => !repairedBody.toLowerCase().includes(url.toLowerCase())
        );
        if (stillMissing.length === 0) {
          body = repairedBody;
          finalResponseId = repaired.id;
        }
      }
    }

    if (!body) {
      await supabase.from("opportunities").update({ status: "ignored", updated_at: new Date().toISOString() }).eq("id", opportunity_id);
      return json({ ok: true, ignored: true, reason: "empty draft" });
    }
    const { data: latest } = await supabase.from("drafts").select("version").eq("opportunity_id", opportunity_id).order("version", { ascending: false }).limit(1);
    const version = (latest?.[0]?.version || 0) + 1;
    await supabase.from("drafts").insert({ opportunity_id, version, body, model: Deno.env.get("OPENAI_DRAFT_MODEL") || "gpt-5.6-terra", status: "generated", metadata: { response_id: finalResponseId, response_mode: classification.response_mode, product_keys: keys } });
    await supabase.from("opportunities").update({ status: "awaiting_review", updated_at: new Date().toISOString() }).eq("id", opportunity_id);
    return json({ ok: true, draft: body, version });
  } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 500); }
});

