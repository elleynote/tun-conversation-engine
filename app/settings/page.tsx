import { AppShell } from "@/components/app-shell";
import { connectionStatus } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const s = connectionStatus();
  const rows = [
    ["Supabase", s.supabase ? "Configured" : "Waiting", s.supabase ? "on" : "", "Database + Edge Functions"],
    ["OpenAI", s.openai ? "Configured" : "Waiting", s.openai ? "on" : "", "Classification + drafting"],
    ["Syften", s.syften ? "Configured" : "Waiting", s.syften ? "on" : "", "Reddit discovery + monitoring"],
    ["Reddit posting", "Manual", "manual", "Copy approved reply → open Reddit → post → mark as posted"],
    ["Netlify runtime", s.netlify ? "Configured" : "Waiting", s.netlify ? "on" : "", "Dashboard hosting"],
  ] as const;

  return (
    <AppShell>
      <div className="page-head"><div><div className="eyebrow">Configuration</div><h1>Integration status</h1><div className="muted">No secrets are displayed here—only whether each integration is configured.</div></div><span className={`badge ${s.mode === "live" ? "green" : "amber"}`}>{s.mode} mode</span></div>
      <div className="card panel table-wrap">
        <table><thead><tr><th>Integration</th><th>Status</th><th>Setup</th></tr></thead><tbody>
          {rows.map(([name, status, state, note]) => <tr key={name}><td><strong>{name}</strong></td><td><span className={`status-dot ${state === "on" ? "on" : state === "manual" ? "manual" : ""}`} />{status}</td><td>{note}</td></tr>)}
        </tbody></table>
      </div>
      <div className="section success-note"><strong>Notification preference:</strong> dashboard only. Reviewers see new/awaiting-review opportunities inside this app.</div>
      <div className="section notice"><strong>Reddit launch flow:</strong> Reddit did not approve API posting access, so posting is intentionally manual. Approve the reply, copy it, open Reddit, post it, then mark the opportunity as posted.</div>
    </AppShell>
  );
}
