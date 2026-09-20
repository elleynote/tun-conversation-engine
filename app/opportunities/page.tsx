import { AppShell } from "@/components/app-shell";
import { OpportunityCard } from "@/components/opportunity-card";
import { listOpportunities } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const opportunities = await listOpportunities();
  return (
    <AppShell>
      <div className="page-head"><div><div className="eyebrow">Review queue</div><h1>Opportunities</h1><div className="muted">Normalized conversations from Syften and future source adapters.</div></div></div>
      <div className="list">{opportunities.map((o) => <OpportunityCard key={o.id} opportunity={o} />)}</div>
    </AppShell>
  );
}
