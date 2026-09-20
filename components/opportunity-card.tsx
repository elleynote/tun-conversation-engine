import Link from "next/link";
import type { OpportunityView } from "@/lib/types";
import { statusClass } from "@/lib/utils";

export function OpportunityCard({ opportunity }: { opportunity: OpportunityView }) {
  return (
    <article className="card opportunity">
      <div className="opp-top">
        <div className="meta">
          <strong>{opportunity.platform}</strong>
          <span>•</span>
          <span>{opportunity.community || "Public conversation"}</span>
          <span>•</span>
          <span>{opportunity.relativeTime}</span>
        </div>
        <span className={`badge ${statusClass(opportunity.status)}`}>{opportunity.status.replaceAll("_", " ")}</span>
      </div>
      <div className="opp-title">{opportunity.title || "Conversation opportunity"}</div>
      <p className="opp-content">{opportunity.content}</p>
      <div className="opp-footer">
        <div className="meta">
          <span className="score">Score {opportunity.classification?.relevance_score ?? "-"}/5</span>
          {opportunity.classification?.intent ? <span>Intent: {opportunity.classification.intent.replaceAll("_", " ")}</span> : null}
          {opportunity.classification?.response_mode ? <span>Mode: {opportunity.classification.response_mode.replaceAll("_", " ")}</span> : null}
          {opportunity.products?.length ? <span>Route: {opportunity.products.map((p) => p.name).join(" + ")}</span> : null}
        </div>
        <Link className="link" href={`/opportunities/${opportunity.id}`}>Review →</Link>
      </div>
    </article>
  );
}
