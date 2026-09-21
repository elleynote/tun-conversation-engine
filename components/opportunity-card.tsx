import Link from "next/link";
import type { OpportunityView } from "@/lib/types";
import { statusClass } from "@/lib/utils";

function ignoredReason(opportunity: OpportunityView) {
  if (opportunity.suppression_reason === "thread_context_only") return "Thread context only";
  if (opportunity.status === "ignored" && opportunity.classification?.response_mode === "do_not_reply") {
    const reason = opportunity.classification.reason?.toLowerCase() || "";
    if (reason.includes("already") || reason.includes("answered")) return "Already answered";
    if (reason.includes("culture") || reason.includes("history")) return "Culture/history only";
    if (reason.includes("sensitive") || reason.includes("griev")) return "Sensitive topic";
    if (reason.includes("promotion") || reason.includes("forced")) return "Promotion would be forced";
    return "No reply recommended";
  }
  return null;
}

export function OpportunityCard({ opportunity }: { opportunity: OpportunityView }) {
  const reason = ignoredReason(opportunity);

  return (
    <article className="card opportunity">
      <div className="opp-top">
        <div className="meta">
          <strong>{opportunity.platform}</strong>
          <span>•</span>
          <span>{opportunity.community || "Public conversation"}</span>
          <span>•</span>
          <span>{opportunity.relativeTime}</span>
          {opportunity.thread_key ? <span className="thread-pill">thread grouped</span> : null}
        </div>
        <span className={`badge ${statusClass(opportunity.status)}`}>{opportunity.status.replaceAll("_", " ")}</span>
      </div>

      <div className="opp-title">{opportunity.title || "Conversation opportunity"}</div>
      <p className="opp-content">{opportunity.content}</p>

      {reason ? <div className="ignored-reason"><strong>Ignored reason:</strong> {reason}</div> : null}

      <div className="opp-footer">
        <div className="meta">
          <span className="score">Score {opportunity.classification?.relevance_score ?? "-"}/5</span>
          {opportunity.classification?.intent ? <span>Intent: {opportunity.classification.intent.replaceAll("_", " ")}</span> : null}
          {opportunity.classification?.response_mode ? <span>Mode: {opportunity.classification.response_mode.replaceAll("_", " ")}</span> : null}
          {opportunity.products?.length ? <span>Route: {opportunity.products.map((p) => p.name).join(" + ")}</span> : null}
        </div>
        <div className="card-links">
          {opportunity.original_url ? <a className="link" href={opportunity.original_url} target="_blank" rel="noreferrer">Open Reddit ↗</a> : null}
          <Link className="link" href={`/opportunities/${opportunity.id}`}>Review →</Link>
        </div>
      </div>
    </article>
  );
}
