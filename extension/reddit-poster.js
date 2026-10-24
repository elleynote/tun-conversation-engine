// Content script running on Reddit tabs to automatically post the approved comment
(async () => {
  const { tunPendingJob: job } = await chrome.storage.local.get("tunPendingJob");
  if (!job || !job.text) return;

  // Verify the job isn't stale (within last 3 minutes)
  if (Date.now() - (job.startedAt || 0) > 180000) {
    chrome.storage.local.remove("tunPendingJob");
    return;
  }

  // Display a floating status notification on the Reddit page
  const banner = document.createElement("div");
  banner.id = "tun-poster-banner";
  banner.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: #0f172a;
    color: #f8fafc;
    border: 2px solid #3b82f6;
    border-radius: 8px;
    padding: 12px 18px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    gap: 10px;
  `;
  banner.innerHTML = `<span style="font-size: 18px;">⚡</span> <span>Tun Engine: Preparing automated reply...</span>`;
  document.body.appendChild(banner);

  function setStatus(text, isSuccess = false, isError = false) {
    if (!banner) return;
    banner.style.borderColor = isSuccess ? "#22c55e" : isError ? "#ef4444" : "#3b82f6";
    banner.innerHTML = `<span style="font-size: 18px;">${isSuccess ? "✅" : isError ? "❌" : "⏳"}</span> <span>${text}</span>`;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForElement(selectorFn, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const el = selectorFn();
      if (el) return el;
      await sleep(400);
    }
    return null;
  }

  async function postComment() {
    try {
      setStatus("Locating comment box...");
      await sleep(1500); // Give Reddit's web components a moment to hydrate

      // Check if we need to reply to a specific comment (permalink)
      const pathname = window.location.pathname;
      const parts = pathname.split("/").filter(Boolean);
      const commentsIndex = parts.indexOf("comments");
      const isCommentPermalink = commentsIndex !== -1 && parts.length > commentsIndex + 3;
      const targetCommentId = isCommentPermalink ? parts[commentsIndex + 3] : null;

      let replyButton = null;
      if (targetCommentId) {
        // Look for the specific comment's Reply button
        replyButton = document.querySelector(`[id*="${targetCommentId}"] button[aria-label*="Reply"], [thingid*="${targetCommentId}"] .reply-button, [id*="${targetCommentId}"] shreddit-comment-action-row button`);
        if (replyButton) {
          setStatus("Opening reply composer for target comment...");
          replyButton.click();
          await sleep(1000);
        }
      }

      // If no comment reply or button wasn't clicked, look for main post comment box
      if (!replyButton) {
        // On modern Reddit, click the "Add a comment" placeholder if present
        const placeholder = document.querySelector('shreddit-async-loader [name="comment"], button[aria-label="Add a comment"], faceplate-form textarea, [data-testid="comment-top-level-placeholder"]');
        if (placeholder && !placeholder.offsetParent === null) {
          placeholder.click();
          await sleep(800);
        }
      }

      // Find the active editable field (contenteditable div or textarea)
      const editor = await waitForElement(() => {
        return (
          document.querySelector('div[role="textbox"][contenteditable="true"]') ||
          document.querySelector('shreddit-comment-composer div[contenteditable="true"]') ||
          document.querySelector('faceplate-form div[contenteditable="true"]') ||
          document.querySelector('div[contenteditable="true"]') ||
          document.querySelector('textarea[name="text"]') ||
          document.querySelector('textarea[placeholder*="comment" i]')
        );
      });

      if (!editor) {
        throw new Error("Could not find the comment input box on this Reddit page.");
      }

      setStatus("Inserting approved response...");
      editor.scrollIntoView({ behavior: "smooth", block: "center" });
      editor.focus();
      await sleep(500);

      if (editor.isContentEditable) {
        // Modern Reddit contenteditable (Lexical/Draft.js)
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, job.text);
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        // Standard textarea (Old Reddit or Markdown mode)
        editor.value = job.text;
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
      }

      await sleep(1000);

      setStatus("Submitting comment...");

      // Find the submit button
      const submitBtn = await waitForElement(() => {
        // Look in closest container first
        const container = editor.closest("form") || editor.closest("shreddit-comment-composer") || editor.closest(".usertext-buttons") || document;
        const candidates = Array.from(container.querySelectorAll('button[type="submit"], button'));
        return candidates.find((b) => {
          const txt = (b.textContent || "").trim().toLowerCase();
          return (txt === "comment" || txt === "save" || txt === "reply" || b.getAttribute("aria-label") === "Comment") && !b.disabled;
        });
      }, 5000);

      if (!submitBtn) {
        throw new Error("Found comment box and entered text, but could not find an enabled submit button.");
      }

      submitBtn.click();
      setStatus("Comment submitted! Verifying...", true);
      await sleep(2500);

      setStatus("Success! Marking as posted in dashboard...", true);

      chrome.runtime.sendMessage({
        action: "REDDIT_POST_DONE",
        success: true,
        opportunityId: job.opportunityId,
        commentUrl: window.location.href
      });

    } catch (err) {
      console.error("[Tun Poster Error]:", err);
      setStatus(`Error: ${err.message}`, false, true);

      chrome.runtime.sendMessage({
        action: "REDDIT_POST_DONE",
        success: false,
        opportunityId: job.opportunityId,
        error: err.message
      });
    }
  }

  postComment();
})();
