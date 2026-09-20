import { AppShell } from "@/components/app-shell";
import { connectionStatus } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const s = connectionStatus();
  const rows = [
    ["Supabase", s.supabase, "NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"],
    ["OpenAI", s.openai, "OPENAI_API_KEY"],
    ["Syften", s.syften, "SYFTEN_API_TOKEN"],
    ["Reddit publishing", s.redditPublishing, "Devvit / approved Reddit publishing path (pending approval)"],
    ["Netlify runtime", s.netlify, "becomes active after Netlify deployment"],
  ] as const;
  return (
    <AppShell>
      <div className="page-head"><div><div className="eyebrow">Configuration</div><h1>Integration status</h1><div className="muted">No secrets are displayed here—only whether each integration is configured.</div></div><span className={`badge ${s.mode === "live" ? "green" : "amber"}`}>{s.mode} mode</span></div>
      <div className="card panel table-wrap">
        <table><thead><tr><th>Integration</th><th>Status</th><th>Required setup</th></tr></thead><tbody>
          {rows.map(([name, ok, note]) => <tr key={name}><td><strong>{name}</strong></td><td><span className={`status-dot ${ok ? "on" : ""}`} />{ok ? "Configured" : "Waiting"}</td><td>{note}</td></tr>)}
        </tbody></table>
      </div>
      <div className="section success-note"><strong>Notification preference:</strong> dashboard only. Reviewers will see new/awaiting-review opportunities inside this app; no email or Slack integration is required for Phase 1.</div>
      <div className="section notice">Current Reddit target: AI drafts the response, a reviewer explicitly approves it, and the approved Reddit publishing adapter performs the comment action when Reddit access is approved.</div>
    </AppShell>
  );
}
