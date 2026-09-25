import type { Classification, Product } from "../types";
import { extractResponseText, openAIResponse } from "./openai";

function productContext(products: Product[]) {
  if (!products.length) return "No product recommendation is approved for this conversation.";
  return products.map((p) => {
    const meta = p.metadata && typeof p.metadata === "object" ? p.metadata as Record<string, unknown> : {};
    const claims = Array.isArray(meta.claims) ? meta.claims.join(" | ") : "";
    const offer = typeof meta.offer === "string" ? meta.offer : "";
    return `${p.name}\nURL: ${p.url || "URL pending confirmation"}\nDescription: ${p.description}\nApproved claims: ${claims || "none supplied"}\nOffer: ${offer || "none supplied"}`;
  }).join("\n\n");
}

export async function generateDraft(input: {
  content: string;
  title?: string | null;
  community?: string | null;
  classification: Classification;
  product?: Product | null;
  products?: Product[];
  communityRules?: string | null;
  brandVoice?: string | null;
}) {
  const products = input.products?.length ? input.products : input.product ? [input.product] : [];
  if (!process.env.OPENAI_API_KEY) {
    return `Demo: response mode is ${input.classification.response_mode}. The live AI will answer the immediate question only when appropriate, then naturally mention ${products.length ? products.map((p) => p.name).join(" + ") : "no product"}.`;
  }
  const data = await openAIResponse({
    model: process.env.OPENAI_DRAFT_MODEL || "gpt-5.6-terra",
    reasoning: { effort: "low" },
    instructions: `Write one natural public reply for Tun's Armenian-language ecosystem.

Follow the response mode exactly:
- answer_and_recommend: briefly answer the person's actual question first, then naturally mention only the approved resources below.
- recommend_only: do not invent a language answer; make the useful recommendation and explain why it fits.
- answer_only: answer helpfully and do not promote a product.
- do_not_reply: return an empty string.

Quality rules:
- Be concise, casual, helpful, friendly and human.
- Sound like a knowledgeable person helping, not like a corporate/company account.
- Answer the actual question genuinely before mentioning any resource.
- Never pretend to be unaffiliated. If mentioning something we own, disclose it naturally with wording such as "we built..." or "we offer...".
- Do not over-promote or dump multiple links simply because they exist.
- Use only approved product claims and URLs below; never invent claims.
- If exact Armenian wording, dialect, translation, grammar or pronunciation is uncertain, do not guess. Prefer a cautious recommendation instead.
- Mention Tun's 4 lessons for $1 only when Tun is genuinely relevant and the offer fits naturally.
- Respect the community rules and do not respond in sensitive/inappropriate contexts.
- Return only the final reply text.

Brand voice: ${input.brandVoice || "Casual, helpful, friendly and human. Not corporate or salesy. Answer the actual question first."}
Community rules: ${input.communityRules || "No additional rules supplied."}`,
    input: `Community: ${input.community ?? "unknown"}\nTitle: ${input.title ?? ""}\nConversation: ${input.content}\nIntent: ${input.classification.intent}\nResponse mode: ${input.classification.response_mode}\nAnswer confidence: ${input.classification.answer_confidence}\nApproved resources:\n${productContext(products)}`,
  });
  return extractResponseText(data).trim();
}
