import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OpportunityCard } from "@/components/opportunity-card";
import { StatCard } from "@/components/stat-card";
import { getAutomationStatus, listOpportunities } from "@/lib/repository";
import { connectionStatus } from "@/lib/runtime";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [opportunities, automation] = await Promise.all([
    listOpportunities(),
    getAutomationStatus(),
  ]);
  const status = connectionStatus();
  const pending = opportunities.filter((x) => ["drafted", "awaiting_review"].includes(x.status)).length;
  const qualified = opportunities.filter((x) => (x.classification?.relevance_score ?? 0) >= 3 && !["ignored", "rejected"].includes(x.status)).length;
  const posted = opportunities.filter((x) => x.status === "posted").length;
  const priorityOrder: Record<string, number> = { awaiting_review: 0, drafted: 0, qualified: 1, new: 1, classified: 1, approved: 2, rejected: 3, ignored: 4, posted: 5 };
  const recent = [...opportunities].sort((a, b) => {
    const rank = (priorityOrder[a.status] ?? 9) - (priorityOrder[b.status] ?? 9);
    if (rank !== 0) return rank;
    return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
  });

  return (
    <AppShell>
      <div className="page-head">
        <div><div className="eyebrow">Phase 1 • Reddit</div><h1>Conversation Engine</h1><div className="muted">Find relevant conversations, answer where appropriate, recommend the right Tun resource, and keep a human in control.</div></div>
        <span className={`badge ${status.mode === "live" ? "green" : "amber"}`}>{status.mode} mode</span>
      </div>

      {status.mode === "demo" ? <div className="notice">This app is in demo mode. Connect Supabase and set <span className="code">APP_MODE=live</span> when ready.</div> : null}

      <section className="card panel automation-panel">
        <div className="section-head">
          <div><div className="eyebrow">Automation</div><h2>Pipeline status</h2></div>
          <span className={`badge ${automation.syftenConnected && automation.openAIConnected ? "green" : "amber"}`}>
            {automation.syftenConnected && automation.openAIConnected ? "Running" : "Setup required"}
          </span>
        </div>
        <div className="automation-grid">
          <div className="automation-item"><span className={`status-dot ${automation.syftenConnected ? "on" : ""}`} /><div><strong>Syften</strong><div className="small muted">{automation.syftenConnected ? "Connected" : "Waiting for token"}</div></div></div>
          <div className="automation-item"><span className={`status-dot ${automation.openAIConnected ? "on" : ""}`} /><div><strong>OpenAI</strong><div className="small muted">{automation.openAIConnected ? "Connected" : "Waiting for API key"}</div></div></div>
          <div className="automation-item"><div><div className="label">Last Syften check</div><strong>{automation.lastSyftenCheck ? relativeTime(automation.lastSyftenCheck) : "Waiting for next run"}</strong></div></div>
          <div className="automation-item"><div><div className="label">Last AI pipeline run</div><strong>{automation.lastPipelineRun ? relativeTime(automation.lastPipelineRun) : "Waiting for next run"}</strong></div></div>
          <div className="automation-item"><div><div className="label">Syften matches today</div><strong>{automation.newToday}</strong></div></div>
        </div>
      </section>

      <div className="success-note section"><strong>Dashboard notifications:</strong> new qualified drafts appear under Needs review. Thread comments stay nested under the main conversation unless a reviewer manually promotes one.</div>

      <div className="grid-stats section">
        <StatCard label="Detected" value={opportunities.length} hint="canonical conversations" href="/opportunities" />
        <StatCard label="Qualified" value={qualified} hint="relevance 3-5" href="/opportunities?status=qualified" />
        <StatCard label="Needs review" value={pending} hint="drafted responses" href="/opportunities?status=awaiting_review" />
        <StatCard label="Posted" value={posted} hint="manually posted" href="/opportunities?status=posted" />
      </div>

      <section className="section">
        <div className="section-head"><div><div className="eyebrow">Priority queue</div><h2>Recent opportunities</h2></div><Link className="link" href="/opportunities">View all →</Link></div>
        <div className="list">
          {recent.length ? recent.slice(0, 5).map((o) => <OpportunityCard key={o.id} opportunity={o} />) : <div className="card empty-state">No conversations in the queue yet. Automation is monitoring for new matches.</div>}
        </div>
      </section>
    </AppShell>
  );
}
