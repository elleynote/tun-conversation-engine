import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OpportunityCard } from "@/components/opportunity-card";
import { listOpportunities } from "@/lib/repository";

export const dynamic = "force-dynamic";

const filters = [
  ["all", "All"],
  ["qualified", "Qualified"],
  ["awaiting_review", "Needs review"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["ignored", "Ignored"],
  ["posted", "Posted"],
] as const;

function matchesFilter(opportunity: Awaited<ReturnType<typeof listOpportunities>>[number], filter: string) {
  if (filter === "all") return true;
  if (filter === "qualified") return (opportunity.classification?.relevance_score ?? 0) >= 3 && !["ignored", "rejected"].includes(opportunity.status);
  if (filter === "awaiting_review") return ["drafted", "awaiting_review"].includes(opportunity.status);
  return opportunity.status === filter;
}

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  const opportunities = await listOpportunities();
  const filtered = opportunities.filter((o) => matchesFilter(o, status));

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">Review queue</div>
          <h1>Opportunities</h1>
          <div className="muted">One main card per Reddit thread. Relevant comments are available inside the thread view and can be promoted manually when needed.</div>
        </div>
      </div>

      <div className="filter-tabs">
        {filters.map(([key, label]) => {
          const count = opportunities.filter((o) => matchesFilter(o, key)).length;
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
