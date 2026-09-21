import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OpportunityCard } from "@/components/opportunity-card";
import { listOpportunities } from "@/lib/repository";

export const dynamic = "force-dynamic";

const filters = [
  ["all", "All"],
  ["awaiting_review", "Needs review"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["ignored", "Ignored"],
  ["posted", "Posted"],
] as const;

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  const opportunities = await listOpportunities();
  const filtered = status === "all" ? opportunities : opportunities.filter((o) => o.status === status);

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">Review queue</div>
          <h1>Opportunities</h1>
          <div className="muted">Canonical conversations only. Reddit thread-context comments are hidden automatically.</div>
        </div>
      </div>

      <div className="filter-tabs">
        {filters.map(([key, label]) => {
          const count = key === "all" ? opportunities.length : opportunities.filter((o) => o.status === key).length;
          return (
            <Link key={key} className={`filter-tab ${status === key ? "active" : ""}`} href={key === "all" ? "/opportunities" : `/opportunities?status=${key}`}>
              {label}<span>{count}</span>
            </Link>
          );
        })}
      </div>

      <div className="list section">
        {filtered.length
          ? filtered.map((o) => <OpportunityCard key={o.id} opportunity={o} />)
          : <div className="card empty-state">No opportunities match this filter.</div>}
      </div>
    </AppShell>
  );
}
