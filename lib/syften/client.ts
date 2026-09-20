export type SyftenMatch = {
  id: string;
  matched_on: string;
  filter: string;
  item: {
    backend: string;
    backend_sub?: string;
    type?: string;
    timestamp?: string;
    item_url?: string;
    author?: string;
    text?: string;
    title?: string;
    lang?: string;
    analysis?: { nsfw?: boolean; accept?: boolean; rejection_reason?: string };
    [key: string]: unknown;
  };
};

export async function fetchSyftenMatches(options: { after?: string; before?: string; limit?: number; show?: "all" | "ai_accepted" | "ai_rejected" | "nsfw" } = {}) {
  const token = process.env.SYFTEN_API_TOKEN;
  if (!token) throw new Error("SYFTEN_API_TOKEN is not configured");
  const base = process.env.SYFTEN_API_BASE_URL || "https://syften.com";
  const response = await fetch(`${base}/api/0.1/items/get`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ limit: Math.min(options.limit ?? 100, 100), show: options.show ?? "all", ...(options.after ? { after: options.after } : {}), ...(options.before ? { before: options.before } : {}) }),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || `Syften request failed (${response.status})`);
  const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return rows as SyftenMatch[];
}
