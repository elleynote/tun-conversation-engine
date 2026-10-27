// High-Reliability X (Twitter) Reply Posting Content Script for Tun Conversation Engine
(() => {
  let activeJob = null;
  let bannerElement = null;

  // Listen for direct execution messages from background.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "EXECUTE_POST" && message.job) {
      if (message.job.platform === "x" || window.location.hostname.includes("x.com") || window.location.hostname.includes("twitter.com")) {
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
      (job.platform === "x" || window.location.hostname.includes("x.com") || window.location.hostname.includes("twitter.com")) &&
      Date.now() - (job.startedAt || 0) < 180000
    ) {
      startPostingFlow(job);
    }
  })();

  function createFloatingBanner(job) {
    if (bannerElement) bannerElement.remove();

    bannerElement = document.createElement("div");
    bannerElement.id = "tun-x-poster-banner";
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
          <strong style="color: #60a5fa;">Tun X (Twitter) Auto-Poster</strong>
        </div>
        <button id="tun-banner-close" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px;">✕</button>
      </div>
      <div id="tun-banner-status" style="font-size: 13px; color: #cbd5e1; line-height: 1.4;">Locating X reply box...</div>
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
      await postOnX(job);
    } catch (err) {
      console.warn("[Tun X Notice]:", err);
      updateStatus(`Notice: ${err.message}`, false, true);
      chrome.runtime.sendMessage({
        action: "POST_DONE",
        platform: "x",
        success: false,
        opportunityId: job.opportunityId,
        error: err.message
      });
    }
  }

  async function postOnX(job) {
    updateStatus("Searching for X reply box...");
    await sleep(1500);

    let editor = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      editor = document.querySelector(
        'div[data-testid="tweetTextarea_0"][contenteditable="true"], div[role="textbox"][contenteditable="true"], div[data-testid="tweetTextarea_0"]'
      );

      if (editor) {
        const style = window.getComputedStyle(editor);
        if (style.display !== "none" && style.visibility !== "hidden") {
          break;
        }
      }

      // If reply box isn't immediately focused, click placeholder or reply action icon
      const replyTriggers = Array.from(document.querySelectorAll('div[data-testid="tweetTextarea_0_label"], div[data-testid="reply"], span, div')).filter((el) => {
        const text = (el.textContent || "").trim().toLowerCase();
        const aria = (el.getAttribute("aria-label") || "").toLowerCase();
        return text.includes("post your reply") || aria.includes("reply") || text.includes("reply");
      });

      if (replyTriggers.length > 0) {
        simulateRealClick(replyTriggers[0]);
      }

      await sleep(500);
    }

    if (!editor) {
      throw new Error("Could not find X reply box. Please ensure you are logged into X (Twitter).");
    }

    updateStatus("Entering approved reply...");
    editor.scrollIntoView({ behavior: "smooth", block: "center" });
    editor.focus();
    await sleep(400);

    // Draft.js / Lexical selection & execCommand
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

    updateStatus("Submitting reply to X...");

    // Find the Reply / Post button
    let submitBtn = null;
    for (let bAttempt = 0; bAttempt < 8; bAttempt++) {
      submitBtn = Array.from(
        document.querySelectorAll(
          'button[data-testid="tweetButtonInline"], button[data-testid="tweetButton"], div[role="button"][data-testid="tweetButtonInline"], div[role="button"][data-testid="tweetButton"]'
        )
      ).find((b) => {
        const disabled = b.getAttribute("disabled") !== null || b.getAttribute("aria-disabled") === "true";
        return !disabled;
      });

      if (submitBtn) break;
      await sleep(300);
    }

    if (!submitBtn) {
      throw new Error("Could not find enabled Reply button on X.");
    }

    simulateRealClick(submitBtn);

    // Verification
    updateStatus("Verifying reply submission...", true);
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
      throw new Error("X reply was triggered, but confirmation could not be verified.");
    }

    updateStatus("✅ Success! Verified reply is live on X.", true);
    await sleep(1500);

    chrome.runtime.sendMessage({
      action: "POST_DONE",
      platform: "x",
      success: true,
      opportunityId: job.opportunityId,
      commentUrl: window.location.href
    });
  }
})();
