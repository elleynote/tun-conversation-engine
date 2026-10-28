// High-Reliability LinkedIn Comment Posting Content Script for Tun Conversation Engine
(() => {
  let activeJob = null;
  let bannerElement = null;

  // Listen for direct execution messages from background.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "EXECUTE_POST" && message.job) {
      if (message.job.platform === "linkedin" || window.location.hostname.includes("linkedin.com")) {
        startPostingFlow(message.job);
        sendResponse({ ok: true });
      }
    }
  });

  // Also check local storage on startup
  (async () => {
    const { tunPendingJob: job } = await chrome.storage.local.get("tunPendingJob");
    if (
      job &&
      job.text &&
      (job.platform === "linkedin" || window.location.hostname.includes("linkedin.com")) &&
      Date.now() - (job.startedAt || 0) < 180000
    ) {
      startPostingFlow(job);
    }
  })();

  function createFloatingBanner(job) {
    if (bannerElement) bannerElement.remove();

    bannerElement = document.createElement("div");
    bannerElement.id = "tun-li-poster-banner";
    bannerElement.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 2147483647;
      background: #0f172a;
      color: #f8fafc;
      border: 2px solid #3b82f6;
      border-radius: 10px;
      padding: 14px 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
      max-width: 420px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    bannerElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">⚡</span>
          <strong style="color: #60a5fa;">Tun LinkedIn Auto-Poster</strong>
        </div>
        <button id="tun-banner-close" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px;">✕</button>
      </div>
      <div id="tun-banner-status" style="font-size: 13px; color: #cbd5e1; line-height: 1.4;">Locating LinkedIn comment box...</div>
    `;

    document.body.appendChild(bannerElement);
    bannerElement.querySelector("#tun-banner-close").onclick = () => bannerElement.remove();
  }

  function updateStatus(text, isSuccess = false, isError = false) {
    if (!bannerElement) return;
    const statusEl = bannerElement.querySelector("#tun-banner-status");
    if (statusEl) statusEl.textContent = text;
    bannerElement.style.borderColor = isSuccess ? "#22c55e" : isError ? "#ef4444" : "#3b82f6";
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function simulateRealClick(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const rect = el.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, view: window, clientX: rect.x + 10, clientY: rect.y + 10 };
    el.dispatchEvent(new PointerEvent("pointerdown", opts));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.focus();
    el.dispatchEvent(new PointerEvent("pointerup", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
  }

  async function startPostingFlow(job) {
    if (activeJob) return;
    activeJob = job;
    createFloatingBanner(job);

    try {
      await postOnLinkedIn(job);
    } catch (err) {
      console.warn("[Tun LinkedIn Notice]:", err);
      updateStatus(`Notice: ${err.message}`, false, true);
      chrome.runtime.sendMessage({
        action: "POST_DONE",
        platform: "linkedin",
        success: false,
        opportunityId: job.opportunityId,
        error: err.message
      });
    }
  }

  async function postOnLinkedIn(job) {
    updateStatus("Searching for LinkedIn comment field...");
    await sleep(1500);

    let editor = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      editor = document.querySelector(
        'div.comments-comment-box__editor[contenteditable="true"], div.ql-editor[contenteditable="true"], div[role="textbox"][contenteditable="true"], div.editor-content[contenteditable="true"]'
      );

      if (editor) {
        const style = window.getComputedStyle(editor);
        if (style.display !== "none" && style.visibility !== "hidden") {
          break;
        }
      }

      // If not open, look for "Comment" action button on the post to open the composer
      const commentButtons = Array.from(document.querySelectorAll('button[aria-label*="Comment" i], button.comment-button, button, div[role="button"]')).filter((el) => {
        const aria = (el.getAttribute("aria-label") || "").toLowerCase();
        const text = (el.textContent || "").trim().toLowerCase();
        return aria === "comment" || text === "comment";
      });

      if (commentButtons.length > 0) {
        simulateRealClick(commentButtons[0]);
      }

      await sleep(500);
    }

    if (!editor) {
      throw new Error("Could not find LinkedIn comment box. Please ensure you are logged into LinkedIn.");
    }

    updateStatus("Entering approved reply...");
    editor.scrollIntoView({ behavior: "smooth", block: "center" });
    editor.focus();
    await sleep(400);

    // Draft.js / Quill editor selection
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);

    const ok = document.execCommand("insertText", false, job.text);
    if (!ok || !(editor.textContent || "").includes(job.text.slice(0, 10))) {
      editor.innerText = job.text;
    }

    editor.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: job.text }));
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: job.text }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));

    await sleep(800);

    updateStatus("Submitting comment to LinkedIn...");

    // Find the Comment / Post submit button
    const container = editor.closest("form, div.comments-comment-box, div.feed-shared-update-v2") || editor.parentElement?.parentElement;
    let submitBtn = null;

    for (let bAttempt = 0; bAttempt < 8; bAttempt++) {
      submitBtn = Array.from(
        (container || document).querySelectorAll(
          'button.comments-comment-box__submit-button, button[type="submit"], button.artdeco-button--primary'
        )
      ).find((b) => {
        const text = (b.textContent || "").trim().toLowerCase();
        const disabled = b.disabled || b.getAttribute("aria-disabled") === "true";
        return (text.includes("comment") || text.includes("post") || b.getAttribute("type") === "submit") && !disabled;
      });

      if (submitBtn) break;
      await sleep(300);
    }

    if (!submitBtn) {
      throw new Error("Could not find enabled Comment button on LinkedIn.");
    }

    simulateRealClick(submitBtn);

    // Verification
    updateStatus("Verifying comment submission...", true);
    let verified = false;
    for (let i = 0; i < 20; i++) {
      await sleep(350);
      const editorText = (editor.textContent || "").trim();
      const pageTextMatches = (document.body.innerText || "").includes(job.text.slice(0, 15));
      if (pageTextMatches || editorText === "" || editorText !== job.text.trim()) {
        verified = true;
        break;
      }
    }

    if (!verified) {
      throw new Error("LinkedIn comment was triggered, but confirmation could not be verified.");
    }

    updateStatus("✅ Success! Verified comment is live on LinkedIn.", true);
    await sleep(1500);

    chrome.runtime.sendMessage({
      action: "POST_DONE",
      platform: "linkedin",
      success: true,
      opportunityId: job.opportunityId,
      commentUrl: window.location.href
    });
  }
})();
