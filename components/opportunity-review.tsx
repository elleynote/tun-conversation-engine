"use client";

import { useState, type ChangeEvent } from "react";
import type { OpportunityView, OpportunityStatus } from "@/lib/types";

export function OpportunityReview({ opportunity }: { opportunity: OpportunityView }) {
  const [draft, setDraft] = useState(opportunity.draft?.body ?? "");
  const [status, setStatus] = useState<OpportunityStatus>(opportunity.status);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function update(nextStatus: OpportunityStatus) {
    setBusy(true); setMessage("");
    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus, draft_body: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setStatus(nextStatus);
      setMessage(data.mode === "demo" ? "Demo updated locally. Connect Supabase for persistence." : "Saved successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    } finally { setBusy(false); }
  }

  if (status === "ignored" && !draft.trim()) {
    return (
      <div className="card panel">
        <div className="section-head">
          <div><div className="eyebrow">AI decision</div><h2>No reply recommended</h2></div>
          <span className="badge red">ignored</span>
        </div>
        <p className="muted">This conversation stays in the audit history but is not sent to the human reply queue.</p>
        {opportunity.original_url ? <a className="btn secondary" href={opportunity.original_url} target="_blank" rel="noreferrer">Open original Reddit ↗</a> : null}
      </div>
    );
  }

  return (
    <div className="card panel">
      <div className="section-head">
        <div><div className="eyebrow">Review response</div><h2>Suggested reply</h2></div>
        <span className="badge blue">{status.replaceAll("_", " ")}</span>
      </div>
      <div className="field">
        <label className="label" htmlFor="draft">Edit before approval</label>
        <textarea id="draft" value={draft} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)} />
      </div>
      <div className="actions">
        <button className="btn success" disabled={busy || !draft.trim()} onClick={() => update("approved")}>Approve</button>
        <button className="btn secondary" disabled={busy || !draft.trim()} onClick={() => update("awaiting_review")}>Save edit</button>
        <button className="btn danger" disabled={busy} onClick={() => update("rejected")}>Reject</button>
        {opportunity.original_url ? <a className="btn secondary" href={opportunity.original_url} target="_blank" rel="noreferrer">Open original</a> : null}
      </div>
      {message ? <p className="small muted">{message}</p> : null}
      <div className="divider" />
      <div className="notice">
        Phase 1 rule: dashboard approval is an internal review step, not a Reddit post. The final publishing action stays disabled until Reddit confirms the approved route.
      </div>
    </div>
  );
}
