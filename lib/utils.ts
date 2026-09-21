import type { OpportunityStatus } from "./types";

export function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function statusClass(status: OpportunityStatus) {
  if (["approved", "posted", "qualified"].includes(status)) return "green";
  if (["rejected", "failed", "ignored"].includes(status)) return "red";
  if (["awaiting_review", "drafted"].includes(status)) return "amber";
  return "blue";
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}


export function cleanSourceText(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
