import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OpportunityReview } from "@/components/opportunity-review";
import { ThreadContext } from "@/components/thread-context";
import { UserAvatar } from "@/components/user-avatar";
import { getNextOpportunityId, getOpportunity } from "@/lib/repository";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function ignoredLabel(reason?: string | null, aiReason?: string | null) {
  if (reason === "thread_context_only") return "Thread context only";
  if (reason === "manual_dismissed") return "Dismissed by reviewer";
  const text = (aiReason || "").toLowerCase();
  if (text.includes("culture") || text.includes("history")) return "Culture/history only";
  if (text.includes("sensitive") || text.includes("griev")) return "Sensitive topic";
  if (text.includes("promotion") || text.includes("forced")) return "Promotion would be forced";
  return "AI did not recommend a reply";
}

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [o, nextOpportunityId] = await Promise.all([
    getOpportunity(id),
    getNextOpportunityId(id),
  ]);
  if (!o) notFound();

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">{o.platform} • {o.community ?? "Public conversation"}</div>
          <h1>Review opportunity</h1>
          <div className="review-author-row"><UserAvatar author={o.author} avatarUrl={o.author_avatar_url} size="md" /><div><strong>{o.author ? `u/${o.author.replace(/^u\//, "")}` : "Unknown user"}</strong><div className="small muted">Detected {o.relativeTime}{o.thread_key ? ` • ${o.thread_key}` : ""}</div></div></div>
        </div>
        <div className="actions">
          {o.original_url ? <a className="btn secondary" href={o.original_url} target="_blank" rel="noreferrer">View full Reddit thread ↗</a> : null}
          <Link className="btn primary" href={nextOpportunityId ? `/opportunities/${nextOpportunityId}` : "/opportunities"}>
            {nextOpportunityId ? "Next suggestion →" : "Back to queue"}
          </Link>
        </div>
      </div>

      {o.status === "ignored" ? (
        <div className="notice ignored-banner"><strong>AI did not queue a reply:</strong> {ignoredLabel(o.suppression_reason, o.classification?.reason)}. A reviewer can override this decision from the reply panel.</div>
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

        <OpportunityReview opportunity={o} nextOpportunityId={nextOpportunityId} />
      </div>

      {o.thread_items?.length ? <ThreadContext items={o.thread_items} currentId={o.id} /> : null}

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
