export type ResponseMode = "answer_and_recommend" | "recommend_only" | "answer_only" | "do_not_reply";
export type Product = { key: string; name: string; description: string; url: string | null; intent_keys: string[]; priority?: number; active?: boolean; metadata?: Record<string, unknown> };
export type Classification = {
  relevance_score: number;
  intent: string;
  dialect: "western" | "eastern" | "unknown";
  commercial_intent: number;
  recommended_product_key: string | null;
  recommended_product_keys: string[];
  response_mode: ResponseMode;
  answer_confidence: number;
  should_reply: boolean;
  confidence: number;
  reason: string;
};
