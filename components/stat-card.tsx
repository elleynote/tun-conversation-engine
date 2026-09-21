import Link from "next/link";

export function StatCard({ label, value, hint, href }: { label: string; value: number | string; hint?: string; href?: string }) {
  const content = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="small muted">{hint}</div> : null}
    </>
  );

  if (href) {
    return <Link className="card stat stat-link" href={href}>{content}</Link>;
  }

  return <div className="card stat">{content}</div>;
}
