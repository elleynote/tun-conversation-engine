export async function responses(body: Record<string, unknown>) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const res = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI error ${res.status}`);
  return data;
}

export function outputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  const out: string[] = [];
  for (const item of data?.output ?? []) for (const c of item?.content ?? []) if (c?.type === "output_text" && typeof c.text === "string") out.push(c.text);
  return out.join("\n").trim();
}
