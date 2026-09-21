import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OpportunityReview } from "@/components/opportunity-review";
import { getOpportunity } from "@/lib/repository";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function ignoredLabel(reason?: string | null, aiReason?: string | null) {
  if (reason === "thread_context_only") return "Thread context only";
  const text = (aiReason || "").toLowerCase();
  if (text.includes("already") || text.includes("answered")) return "Already answered";
  if (text.includes("culture") || text.includes("history")) return "Culture/history only";
  if (text.includes("sensitive") || text.includes("griev")) return "Sensitive topic";
  if (text.includes("promotion") || text.includes("forced")) return "Promotion would be forced";
  return "No reply recommended";
}

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOpportunity(id);
  if (!o) notFound();

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">{o.platform} • {o.community ?? "Public conversation"}</div>
          <h1>Review opportunity</h1>
          <div className="muted">Detected {o.relativeTime} • @{o.author ?? "unknown"}{o.thread_key ? ` • ${o.thread_key}` : ""}</div>
        </div>
        {o.original_url ? <a className="btn secondary" href={o.original_url} target="_blank" rel="noreferrer">Open original Reddit ↗</a> : null}
      </div>

      {o.status === "ignored" ? (
        <div className="notice ignored-banner"><strong>Not queued for reply:</strong> {ignoredLabel(o.suppression_reason, o.classification?.reason)}</div>
      ) : null}

      <div className="columns section">
        <div className="card panel">
          <div className="eyebrow">Original conversation</div>
          <h2>{o.title || "Conversation"}</h2>
          <p className="quote">{o.content}</p>
          <div className="divider" />
          <div className="field"><div className="label">Matched filter</div><div className="value">{o.matched_filter || "-"}</div></div>
          <div className="field"><div className="label">AI reason</div><div>{o.classification?.reason || "Not classified yet"}</div></div>
          <div className="field"><div className="label">Intent</div><div className="value">{o.classification?.intent?.replaceAll("_", " ") || "-"}</div></div>
          <div className="field"><div className="label">Response mode</div><div className="value">{o.classification?.response_mode?.replaceAll("_", " ") || "-"}</div></div>
          <div className="field"><div className="label">Dialect</div><div className="value">{o.classification?.dialect || "-"}</div></div>
          <div className="field"><div className="label">Recommended resources</div><div className="value">{o.products?.length ? o.products.map((p) => p.name).join(" + ") : "None"}</div></div>
          <div className="field"><div className="label">Relevance / classifier confidence</div><div className="value">{o.classification ? `${o.classification.relevance_score}/5 • ${Math.round(o.classification.confidence * 100)}%` : "-"}</div></div>
          <div className="field"><div className="label">Direct-answer confidence</div><div className="value">{o.classification ? `${Math.round(o.classification.answer_confidence * 100)}%` : "-"}</div></div>
        </div>

        <OpportunityReview opportunity={o} />
      </div>

      <section className="card panel section">
        <div className="section-head"><div><div className="eyebrow">Audit trail</div><h2>Activity</h2></div></div>
        <div className="timeline">
          {o.activity?.length ? o.activity.map((item) => (
            <div className="timeline-item" key={item.id}>
              <div className="timeline-dot" />
              <div>
                <div className="timeline-head"><strong>{item.label}</strong><span>{relativeTime(item.created_at)}</span></div>
                {item.detail ? <div className="small muted timeline-detail">{item.detail}</div> : null}
              </div>
            </div>
          )) : <div className="muted">No activity recorded yet.</div>}
        </div>
      </section>
    </AppShell>
  );
}
