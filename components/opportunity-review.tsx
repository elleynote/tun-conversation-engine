"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type { OpportunityView, OpportunityStatus } from "@/lib/types";

export function OpportunityReview({ opportunity, nextOpportunityId }: { opportunity: OpportunityView; nextOpportunityId: string | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState(opportunity.draft?.body ?? "");
  const [status, setStatus] = useState<OpportunityStatus>(opportunity.status);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [extensionConnected, setExtensionConnected] = useState(false);

  const platform = opportunity.platform || "source";
  const platformLabel =
    platform === "facebook" ? "Facebook" :
    platform === "instagram" ? "Instagram" :
    platform === "youtube" ? "YouTube" :
    platform === "reddit" ? "Reddit" :
    platform === "x" ? "X" :
    "source";

  const isAutomatedPlatform = ["reddit", "facebook", "instagram", "x"].includes(platform);

  useEffect(() => {
    function checkExtension() {
      if (document.documentElement.dataset.tunExtensionLoaded === "true") {
        setExtensionConnected(true);
      }
    }

    checkExtension();

    function handleExtensionReady() {
      setExtensionConnected(true);
    }

    function handleMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== "object") return;

      if (event.data.type === "TUN_PONG_EXTENSION") {
        setExtensionConnected(true);
      }

      if (event.data.type === "TUN_POST_RESULT" && event.data.opportunityId === opportunity.id) {
        setBusy(false);
        if (event.data.success) {
          update("posted", false);
          setMessage(`⚡ Successfully posted to ${platformLabel} via Chrome Extension!`);
        } else {
          setMessage(`Extension posting notice: ${event.data.error || "Failed to post automatically"}`);
        }
      }
    }

    window.addEventListener("tun-extension-ready", handleExtensionReady);
    window.addEventListener("message", handleMessage);

    window.postMessage({ type: "TUN_PING_EXTENSION" }, "*");

    return () => {
      window.removeEventListener("tun-extension-ready", handleExtensionReady);
      window.removeEventListener("message", handleMessage);
    };
  }, [opportunity.id, platformLabel]);

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

  async function autoPostToSocial() {
    if (!draft.trim() || !opportunity.original_url) return;
    setBusy(true);
    setMessage(`Sending comment to Chrome Extension to post on ${platformLabel}...`);

    if (status !== "approved") {
      try {
        const body: Record<string, unknown> = { status: "approved", draft_body: draft };
        const res = await fetch(`/api/opportunities/${opportunity.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) setStatus("approved");
      } catch (e) {
        console.warn("Could not pre-approve draft before extension post:", e);
      }
    }

    window.postMessage({
      type: "TUN_TRIGGER_POST",
      platform: opportunity.platform,
      opportunityId: opportunity.id,
      url: opportunity.original_url,
      text: draft,
    }, "*");

    // Backward compatibility for existing extension listener
    if (opportunity.platform === "reddit") {
      window.postMessage({
        type: "TUN_TRIGGER_REDDIT_POST",
        opportunityId: opportunity.id,
        url: opportunity.original_url,
        text: draft,
      }, "*");
    }

    setTimeout(() => {
      setBusy((current) => {
        if (current) {
          setMessage((prev) => prev.startsWith("Sending") ? "If the extension didn't trigger, verify it is loaded at chrome://extensions." : prev);
        }
        return false;
      });
    }, 15000);
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

  async function copyAndOpenSource() {
    if (opportunity.original_url) window.open(opportunity.original_url, "_blank", "noopener,noreferrer");
    await copyReply();
  }

  function goToNextSuggestion() {
    router.push(nextOpportunityId ? `/opportunities/${nextOpportunityId}` : "/opportunities");
  }

  async function dismissAndNext() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}/dismiss`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not dismiss suggestion");
      goToNextSuggestion();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong");
      setBusy(false);
    }
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
          <button className="btn danger" disabled={busy} onClick={dismissAndNext}>Dismiss & next</button>
          <button className="btn secondary" disabled={busy} onClick={goToNextSuggestion}>{nextOpportunityId ? "Next suggestion →" : "Back to queue"}</button>
          {opportunity.original_url ? <a className="btn secondary" href={opportunity.original_url} target="_blank" rel="noreferrer">View on {platformLabel} ↗</a> : null}
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
        <div>
          <div className="eyebrow">
            Review response
            {extensionConnected ? <span style={{ marginLeft: "8px", color: "#22c55e", fontWeight: "normal" }}>• ⚡ Extension Connected</span> : null}
          </div>
          <h2>{manualBlank ? "Write a manual reply" : "Suggested reply"}</h2>
        </div>
        <span className={`badge ${approved || posted ? "green" : "blue"}`}>{status.replaceAll("_", " ")}</span>
      </div>
      <div className="field">
        <label className="label" htmlFor="draft">{approved || posted ? "Approved reply" : "Edit before approval"}</label>
        <textarea id="draft" value={draft} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)} />
      </div>

      {!approved && !posted ? (
        <div className="actions">
          {isAutomatedPlatform && opportunity.original_url ? (
            <button
              className="btn primary"
              disabled={busy || !draft.trim()}
              onClick={autoPostToSocial}
              title={`Post directly to ${platformLabel} via Chrome Extension`}
            >
              ⚡ Auto-Post to {platformLabel}
            </button>
          ) : null}
          <button className="btn success" disabled={busy || !draft.trim()} onClick={() => update("approved")}>Approve</button>
          <button className="btn secondary" disabled={busy || !draft.trim()} onClick={() => update("awaiting_review")}>Save edit</button>
          <button className="btn danger" disabled={busy} onClick={() => update("rejected", false)}>Reject</button>
          <button className="btn danger" disabled={busy} onClick={dismissAndNext}>Dismiss & next</button>
          <button className="btn secondary" disabled={busy} onClick={goToNextSuggestion}>{nextOpportunityId ? "Next suggestion →" : "Back to queue"}</button>
          {opportunity.original_url ? <a className="btn secondary" href={opportunity.original_url} target="_blank" rel="noreferrer">View on {platformLabel} ↗</a> : null}
        </div>
      ) : null}

      {approved && !posted ? (
        <div className="manual-post-box">
          <div className="label">{platformLabel} posting</div>
          <p className="small muted">
            {isAutomatedPlatform
              ? `Post automatically with one click using the Chrome Extension, or copy and paste manually.`
              : `The final posting step is manual for ${platformLabel}. Copy the approved reply, open the conversation, post it, then mark it as posted.`}
          </p>
          <div className="actions">
            {isAutomatedPlatform && opportunity.original_url ? (
              <button
                className="btn primary"
                disabled={busy || !draft.trim()}
                onClick={autoPostToSocial}
                title={`Post directly to ${platformLabel} via Chrome Extension`}
              >
                ⚡ Auto-Post to {platformLabel}
              </button>
            ) : null}
            <button className="btn secondary" disabled={busy || !draft.trim()} onClick={copyReply}>Copy reply</button>
            {opportunity.original_url ? <button className="btn secondary" disabled={busy || !draft.trim()} onClick={copyAndOpenSource}>Copy + open {platformLabel}</button> : null}
            {opportunity.original_url ? <a className="btn secondary" href={opportunity.original_url} target="_blank" rel="noreferrer">Open {platformLabel} only ↗</a> : null}
            <button className="btn success" disabled={busy} onClick={() => update("posted", false)}>Mark as posted</button>
            <button className="btn secondary" disabled={busy} onClick={goToNextSuggestion}>{nextOpportunityId ? "Next suggestion →" : "Back to queue"}</button>
          </div>
        </div>
      ) : null}

      {posted ? (
        <div className="manual-post-box section-tight">
          <div className="label">Status: Posted to {platformLabel}</div>
          <p className="small muted">This opportunity has been posted.</p>
          <div className="actions" style={{ marginTop: "8px" }}>
            <button className="btn secondary" disabled={busy} onClick={() => update("awaiting_review", false)}>
              ↩ Move back to Review
            </button>
            {opportunity.original_url ? (
              <a className="btn secondary" href={opportunity.original_url} target="_blank" rel="noreferrer">
                View on {platformLabel} ↗
              </a>
            ) : null}
            <button className="btn secondary" disabled={busy} onClick={goToNextSuggestion}>
              {nextOpportunityId ? "Next suggestion →" : "Back to queue"}
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="small muted">{message}</p> : null}
    </div>
  );
}
