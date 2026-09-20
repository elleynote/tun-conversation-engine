export async function openAIResponse(body: Record<string, unknown>) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "authorization": `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI request failed (${response.status})`);
  return data;
}

export function extractResponseText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text) return data.output_text;
  const chunks: string[] = [];
  for (const item of data?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const c of item?.content ?? []) if (c?.type === "output_text" && typeof c.text === "string") chunks.push(c.text);
  }
  return chunks.join("\n").trim();
}
