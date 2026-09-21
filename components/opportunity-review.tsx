"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type { OpportunityView, OpportunityStatus } from "@/lib/types";

export function OpportunityReview({ opportunity }: { opportunity: OpportunityView }) {
  const router = useRouter();
  const [draft, setDraft] = useState(opportunity.draft?.body ?? "");
  const [status, setStatus] = useState<OpportunityStatus>(opportunity.status);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function update(nextStatus: OpportunityStatus, includeDraft = true) {
    setBusy(true); setMessage("");
    try {
      const body: Record<string, unknown> = { status: nextStatus };
      if (includeDraft) body.draft_body = draft;
      const res = await fetch(`/api/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setStatus(nextStatus);
      setMessage(nextStatus === "posted" ? "Marked as posted." : "Saved successfully.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    } finally { setBusy(false); }
  }

  async function promote() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}/promote`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create reply opportunity");
      setStatus("awaiting_review");
      setMessage("Marked as a reply opportunity. Write a manual reply below, then approve it.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    } finally { setBusy(false); }
  }

  async function copyReply() {
    if (!draft.trim()) return;
    try {
      await navigator.clipboard.writeText(draft);
      setMessage("Reply copied to clipboard.");
    } catch {
      setMessage("Could not copy automatically. Please select and copy the reply manually.");
    }
  }

  async function copyAndOpenReddit() {
    if (opportunity.original_url) window.open(opportunity.original_url, "_blank", "noopener,noreferrer");
    await copyReply();
  }

  if (status === "ignored" && !draft.trim()) {
    return (
      <div className="card panel">
        <div className="section-head">
          <div><div className="eyebrow">AI decision</div><h2>No reply recommended</h2></div>
          <span className="badge red">ignored</span>
        </div>
        <p className="muted">The AI did not queue this conversation, but you can override that decision. Overrides are saved in the activity history so we can use them to improve the rules later.</p>
        <div className="actions">
          <button className="btn primary" disabled={busy} onClick={promote}>Mark as reply opportunity</button>
          {opportunity.original_url ? <a className="btn secondary" href={opportunity.original_url} target="_blank" rel="noreferrer">View Reddit thread ↗</a> : null}
        </div>
        {message ? <p className="small muted">{message}</p> : null}
      </div>
    );
  }

  const approved = status === "approved";
  const posted = status === "posted";
  const manualBlank = status === "awaiting_review" && !opportunity.draft?.body;

  return (
    <div className="card panel">
      <div className="section-head">
        <div><div className="eyebrow">Review response</div><h2>{manualBlank ? "Write a manual reply" : "Suggested reply"}</h2></div>
        <span className={`badge ${approved || posted ? "green" : "blue"}`}>{status.replaceAll("_", " ")}</span>
      </div>
      <div className="field">
        <label className="label" htmlFor="draft">{approved || posted ? "Approved reply" : "Edit before approval"}</label>
        <textarea id="draft" value={draft} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)} />
      </div>

      {!approved && !posted ? (
        <div className="actions">
          <button className="btn success" disabled={busy || !draft.trim()} onClick={() => update("approved")}>Approve</button>
          <button className="btn secondary" disabled={busy || !draft.trim()} onClick={() => update("awaiting_review")}>Save edit</button>
          <button className="btn danger" disabled={busy} onClick={() => update("rejected", false)}>Reject</button>
          {opportunity.original_url ? <a className="btn secondary" href={opportunity.original_url} target="_blank" rel="noreferrer">View Reddit thread ↗</a> : null}
        </div>
      ) : null}

      {approved || posted ? (
        <div className="manual-post-box">
          <div className="label">Manual Reddit posting</div>
          <p className="small muted">Reddit API access was not approved, so the final step is manual. Copy the approved reply, open the Reddit thread, post it, then mark it as posted here.</p>
          <div className="actions">
            <button className="btn primary" disabled={busy || !draft.trim()} onClick={copyReply}>Copy reply</button>
            {opportunity.original_url ? <button className="btn secondary" disabled={busy || !draft.trim()} onClick={copyAndOpenReddit}>Copy + open Reddit</button> : null}
            {opportunity.original_url ? <a className="btn secondary" href={opportunity.original_url} target="_blank" rel="noreferrer">Open Reddit only ↗</a> : null}
            {!posted ? <button className="btn success" disabled={busy} onClick={() => update("posted", false)}>Mark as posted</button> : null}
          </div>
        </div>
      ) : null}

      {posted ? <div className="success-note section-tight"><strong>Posted manually.</strong> This opportunity is complete.</div> : null}
      {message ? <p className="small muted">{message}</p> : null}
    </div>
  );
}
