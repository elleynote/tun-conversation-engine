import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OpportunityReview } from "@/components/opportunity-review";
import { getOpportunity } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOpportunity(id);
  if (!o) notFound();

  return (
    <AppShell>
      <div className="page-head"><div><div className="eyebrow">{o.platform} • {o.community ?? "Public conversation"}</div><h1>Review opportunity</h1><div className="muted">Detected {o.relativeTime} • @{o.author ?? "unknown"}</div></div></div>
      <div className="columns">
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
    </AppShell>
  );
}
