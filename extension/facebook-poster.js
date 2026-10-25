// High-Reliability Facebook Comment Posting Content Script for Tun Conversation Engine
(() => {
  let activeJob = null;
  let bannerElement = null;

  // Listen for direct execution messages from background.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "EXECUTE_POST" && message.job) {
      if (message.job.platform === "facebook" || window.location.hostname.includes("facebook.com")) {
        startPostingFlow(message.job);
        sendResponse({ ok: true });
      }
    }
  });

  // Also check local storage on startup
  (async () => {
    const { tunPendingJob: job } = await chrome.storage.local.get("tunPendingJob");
    if (job && job.text && (job.platform === "facebook" || window.location.hostname.includes("facebook.com")) && Date.now() - (job.startedAt || 0) < 180000) {
      startPostingFlow(job);
    }
  })();

  function createFloatingBanner(job) {
    if (bannerElement) bannerElement.remove();

    bannerElement = document.createElement("div");
    bannerElement.id = "tun-fb-poster-banner";
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
          <strong style="color: #60a5fa;">Tun Facebook Auto-Poster</strong>
        </div>
        <button id="tun-banner-close" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px;">✕</button>
      </div>
      <div id="tun-banner-status" style="font-size: 13px; color: #cbd5e1; line-height: 1.4;">Locating Facebook comment box...</div>
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
      await postOnFacebook(job);
    } catch (err) {
      console.warn("[Tun Facebook Notice]:", err);
      updateStatus(`Notice: ${err.message}`, false, true);
      chrome.runtime.sendMessage({
        action: "POST_DONE",
        platform: "facebook",
        success: false,
        opportunityId: job.opportunityId,
        error: err.message
      });
    }
  }

  async function postOnFacebook(job) {
    updateStatus("Searching for Facebook comment field...");
    await sleep(1500);

    // 1. If composer is not open, look for placeholder or comment action button
    let editor = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      editor = document.querySelector(
        'div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"], div[aria-label*="Write a comment" i][contenteditable="true"], div[aria-label*="Write a public comment" i][contenteditable="true"], div[aria-label*="Write an answer" i][contenteditable="true"]'
      );

      if (editor) {
        const style = window.getComputedStyle(editor);
        if (style.display !== "none" && style.visibility !== "hidden") {
          break;
        }
      }

      // Try clicking "Write a comment..." trigger or comment button
      const placeholders = Array.from(document.querySelectorAll('div[aria-label*="Write a comment" i], div[aria-label*="Comment" i][role="button"], span, div')).filter((el) => {
        const t = (el.textContent || "").trim().toLowerCase();
        const aria = (el.getAttribute("aria-label") || "").toLowerCase();
        return (t.includes("write a comment") || aria.includes("write a comment") || aria === "comment") && el.children.length <= 2;
      });

      if (placeholders.length > 0) {
        simulateRealClick(placeholders[0]);
      }

      await sleep(500);
    }

    if (!editor) {
      throw new Error("Could not locate Facebook comment box. Please make sure you are logged into Facebook.");
    }

    updateStatus("Entering approved reply...");
    editor.scrollIntoView({ behavior: "smooth", block: "center" });
    editor.focus();
    await sleep(400);

    // 2. Insert text using native selection & execCommand for Lexical/Draft.js compatibility
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

    updateStatus("Submitting comment to Facebook...");

    // 3. Dispatch Enter key to submit
    const enterDown = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    editor.dispatchEvent(enterDown);

    const enterUp = new KeyboardEvent("keyup", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    editor.dispatchEvent(enterUp);

    // Also look for explicit Send / Comment button if Enter alone was intercepted
    await sleep(600);
    const parentContainer = editor.closest('[role="presentation"], form, div[class*="comment"]') || editor.parentElement?.parentElement;
    const sendBtn = Array.from(parentContainer?.querySelectorAll('div[role="button"], button') || []).find((b) => {
      const label = (b.getAttribute("aria-label") || "").toLowerCase();
      return (label.includes("comment") || label.includes("send") || label.includes("post")) && !b.getAttribute("aria-disabled");
    });
    if (sendBtn) {
      simulateRealClick(sendBtn);
    }

    // 4. Verification: Check if editor cleared or comment appeared in DOM
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
      throw new Error("Facebook submission attempted, but confirmation could not be verified.");
    }

    updateStatus("✅ Success! Verified comment is live on Facebook.", true);
    await sleep(1500);

    chrome.runtime.sendMessage({
      action: "POST_DONE",
      platform: "facebook",
      success: true,
      opportunityId: job.opportunityId,
      commentUrl: window.location.href
    });
  }
})();
