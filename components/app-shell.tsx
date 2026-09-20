import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">T</div>
          <div>
            <div className="brand-title">Tun</div>
            <div className="brand-sub">Conversation Engine</div>
          </div>
        </div>
        <nav className="nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/opportunities">Opportunities</Link>
          <Link href="/settings">Settings</Link>
        </nav>
        <div className="sidebar-note">
          Phase 1: Reddit<br />
          Human approval before publishing
        </div>
      </aside>
      <main className="content"><div className="page">{children}</div></main>
    </div>
  );
}
