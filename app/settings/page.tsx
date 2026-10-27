import { AppShell } from "@/components/app-shell";
import { getAutomationStatus } from "@/lib/repository";
import { connectionStatus } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [s, automation] = await Promise.all([
    Promise.resolve(connectionStatus()),
    getAutomationStatus(),
  ]);
  const rows = [
    ["Supabase", s.supabase ? "Configured" : "Waiting", s.supabase ? "on" : "", "Database + Edge Functions"],
    ["OpenAI", automation.openAIConnected ? "Configured" : "Waiting", automation.openAIConnected ? "on" : "", "Classification + drafting"],
    ["Syften", automation.syftenConnected ? "Configured" : "Waiting", automation.syftenConnected ? "on" : "", "Multi-platform discovery (Reddit, X / Twitter, YouTube)"],
    ["YouTube comments", automation.youtubeConnected ? "Connected" : "Waiting for API key", automation.youtubeConnected ? "on" : "", "Fetch public comments from Syften-discovered YouTube videos"],
    ["Reddit posting", "Extension ready", "on", "1-click auto-posting via Tun Chrome Extension"],
    ["X (Twitter) posting", "Extension ready", "on", "1-click auto-reply via Tun Chrome Extension"],
    ["Facebook posting", "Extension ready", "on", "1-click auto-posting to groups & posts via Tun Chrome Extension"],
    ["Instagram posting", "Extension ready", "on", "1-click auto-posting to posts/reels via Tun Chrome Extension"],
    ["YouTube posting", "Manual", "manual", "Copy approved reply → open YouTube → post → mark as posted"],
    ["Dashboard access", "No login", "manual", "Current single-business phase: no sign-up or login."],
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
      <div className="section notice"><strong>1-Click Auto-Posting:</strong> Reddit, X (Twitter), Facebook, and Instagram support 1-click automated posting via the private Tun Chrome Extension. YouTube starts in manual-posting mode until official channel OAuth is connected.</div>
    </AppShell>
  );
}
