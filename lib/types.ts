export type OpportunityStatus =
  | "new"
  | "classified"
  | "qualified"
  | "ignored"
  | "drafted"
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "posted"
  | "failed";

export type ResponseMode =
  | "answer_and_recommend"
  | "recommend_only"
  | "answer_only"
  | "do_not_reply";

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

export type ProductMetadata = {
  offer?: string;
  claims?: string[];
  recommendation_notes?: string[];
  awaiting_url?: boolean;
  approved_copy?: string[];
};

export type Product = {
  id?: string;
  key: string;
  name: string;
  description: string;
  url: string | null;
  intent_keys: string[];
  active?: boolean;
  priority?: number;
  metadata?: ProductMetadata | Record<string, unknown>;
};

export type Draft = {
  id?: string;
  body: string;
  version?: number;
  status?: string;
};

export type ActivityItem = {
  id: string;
  type: string;
  label: string;
  detail?: string | null;
  created_at: string;
};

export type ThreadItem = {
  id: string;
  author: string | null;
  author_avatar_url?: string | null;
  content: string;
  original_url: string | null;
  detected_at: string;
  relativeTime: string;
  is_thread_root: boolean;
  status: OpportunityStatus;
  suppression_reason: string | null;
};

export type AutomationStatus = {
  syftenConnected: boolean;
  openAIConnected: boolean;
  lastSyftenCheck: string | null;
  lastPipelineRun: string | null;
  lastSyftenCursor: string | null;
  newToday: number;
};

export type OpportunityView = {
  id: string;
  platform: string;
  community: string | null;
  author: string | null;
  author_avatar_url?: string | null;
  title: string | null;
  content: string;
  original_url: string | null;
  published_at: string | null;
  detected_at: string;
  relativeTime: string;
  status: OpportunityStatus;
  matched_filter?: string | null;
  thread_key?: string | null;
  is_thread_root?: boolean;
  suppression_reason?: string | null;
  classification?: Classification | null;
  product?: Product | null;
  products?: Product[];
  draft?: Draft | null;
  activity?: ActivityItem[];
  thread_items?: ThreadItem[];
};

