"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/user-avatar";
import type { ThreadItem } from "@/lib/types";

export function ThreadContext({ items, currentId }: { items: ThreadItem[]; currentId: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function promote(id: string) {
    setBusyId(id);
    setMessage("");
    try {
      const res = await fetch(`/api/opportunities/${id}/promote`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create reply opportunity");
      setMessage("Marked as a reply opportunity. It is now available for a manual reply.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card panel section">
      <div className="section-head">
        <div>
          <div className="eyebrow">Thread context</div>
          <h2>Original post + relevant comments</h2>
        </div>
        <span className="badge blue">{items.length} item{items.length === 1 ? "" : "s"}</span>
      </div>
      <p className="small muted thread-guidance">Default approach: reply once to the main thread. Promote a comment only when it asks a distinct question that deserves its own response.</p>
      <div className="thread-list">
        {items.map((item) => {
          const isCurrent = item.id === currentId;
          const isContextOnly = item.suppression_reason === "thread_context_only";
          const canPromote = !isCurrent && isContextOnly;
          return (
            <div className={`thread-item ${item.is_thread_root ? "root" : "comment"}`} key={item.id}>
              <div className="thread-avatar"><UserAvatar author={item.author} avatarUrl={item.author_avatar_url} size="md" /></div>
              <div className="thread-body">
                <div className="thread-meta-row">
                  <div><strong>{item.author ? `u/${item.author.replace(/^u\//, "")}` : "Unknown user"}</strong><span> • {item.relativeTime}</span></div>
                  <span className={`badge ${item.is_thread_root ? "blue" : ""}`}>{item.is_thread_root ? "original post" : "comment"}</span>
                </div>
                <div className="thread-content">{item.content}</div>
                <div className="actions compact">
                  {item.original_url ? <a className="link" href={item.original_url} target="_blank" rel="noreferrer">Open on Reddit ↗</a> : null}
                  {canPromote ? <button className="text-button" disabled={busyId === item.id} onClick={() => promote(item.id)}>{busyId === item.id ? "Adding..." : "Make reply opportunity"}</button> : null}
                  {!isCurrent && !isContextOnly ? <a className="link" href={`/opportunities/${item.id}`}>Review reply →</a> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {message ? <p className="small muted section-tight">{message}</p> : null}
    </section>
  );
}
