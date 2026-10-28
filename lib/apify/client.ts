export type ApifyInstagramItem = {
  id?: string;
  type?: string;
  shortCode?: string;
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  url?: string;
  commentsCount?: number;
  latestComments?: Array<{
    id?: string;
    text?: string;
    ownerUsername?: string;
    timestamp?: string;
    [key: string]: unknown;
  }>;
  ownerUsername?: string;
  ownerFullName?: string;
  timestamp?: string;
  inputUrl?: string;
  [key: string]: unknown;
};

export function getApifyToken(): string {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");
  return token;
}

export async function fetchApifyDatasetItems(datasetId: string, limit = 100): Promise<ApifyInstagramItem[]> {
  const token = getApifyToken();
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=${limit}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Apify dataset (${response.status}): ${errorText}`);
  }
  const items = await response.json();
  return Array.isArray(items) ? items : [];
}

export async function runApifyTask(taskId: string): Promise<{ runId: string; datasetId?: string }> {
  const token = getApifyToken();
  const url = `https://api.apify.com/v2/actor-tasks/${taskId}/runs?token=${token}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to trigger Apify task (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  return {
    runId: data.data.id,
    datasetId: data.data.defaultDatasetId,
  };
}
