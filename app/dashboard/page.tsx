import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OpportunityCard } from "@/components/opportunity-card";
import { StatCard } from "@/components/stat-card";
import { listOpportunities } from "@/lib/repository";
import { connectionStatus } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const opportunities = await listOpportunities();
  const status = connectionStatus();
  const pending = opportunities.filter((x) => ["drafted", "awaiting_review"].includes(x.status)).length;
  const qualified = opportunities.filter((x) => (x.classification?.relevance_score ?? 0) >= 3).length;
  const posted = opportunities.filter((x) => x.status === "posted").length;

  return (
    <AppShell>
      <div className="page-head">
        <div><div className="eyebrow">Phase 1 • Reddit</div><h1>Conversation Engine</h1><div className="muted">Find relevant conversations, answer where appropriate, recommend the right Tun resource, and keep a human in control.</div></div>
        <span className={`badge ${status.mode === "live" ? "green" : "amber"}`}>{status.mode} mode</span>
      </div>
      {status.mode === "demo" ? <div className="notice">This ZIP starts in demo mode so you can review the full workflow before external credentials arrive. Connect Supabase and set <span className="code">APP_MODE=live</span> when ready.</div> : null}
      <div className="success-note section"><strong>Dashboard notifications:</strong> this queue is the Phase 1 notification channel. New qualified drafts appear under Needs review; no email or Slack integration is required.</div>
      <div className="grid-stats section">
        <StatCard label="Detected" value={opportunities.length} hint="current sample/window" />
        <StatCard label="Qualified" value={qualified} hint="relevance 3-5" />
        <StatCard label="Needs review" value={pending} hint="drafted responses" />
        <StatCard label="Posted" value={posted} hint="after approval" />
      </div>
      <section className="section">
        <div className="section-head"><div><div className="eyebrow">Priority queue</div><h2>Recent opportunities</h2></div><Link className="link" href="/opportunities">View all →</Link></div>
        <div className="list">{opportunities.slice(0, 4).map((o) => <OpportunityCard key={o.id} opportunity={o} />)}</div>
      </section>
    </AppShell>
  );
}
