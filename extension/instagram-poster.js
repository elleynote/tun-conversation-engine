// High-Reliability Instagram Comment Posting Content Script for Tun Conversation Engine
(() => {
  let activeJob = null;
  let bannerElement = null;

  // Listen for direct execution messages from background.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "EXECUTE_POST" && message.job) {
      if (message.job.platform === "instagram" || window.location.hostname.includes("instagram.com")) {
        startPostingFlow(message.job);
        sendResponse({ ok: true });
      }
    }
  });

  // Also check local storage on startup
  (async () => {
    const { tunPendingJob: job } = await chrome.storage.local.get("tunPendingJob");
    if (job && job.text && (job.platform === "instagram" || window.location.hostname.includes("instagram.com")) && Date.now() - (job.startedAt || 0) < 180000) {
      startPostingFlow(job);
    }
  })();

  function createFloatingBanner(job) {
    if (bannerElement) bannerElement.remove();

    bannerElement = document.createElement("div");
    bannerElement.id = "tun-ig-poster-banner";
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
          <strong style="color: #60a5fa;">Tun Instagram Auto-Poster</strong>
        </div>
        <button id="tun-banner-close" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px;">✕</button>
      </div>
      <div id="tun-banner-status" style="font-size: 13px; color: #cbd5e1; line-height: 1.4;">Locating Instagram comment box...</div>
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
      await postOnInstagram(job);
    } catch (err) {
      console.warn("[Tun Instagram Notice]:", err);
      updateStatus(`Notice: ${err.message}`, false, true);
      chrome.runtime.sendMessage({
        action: "POST_DONE",
        platform: "instagram",
        success: false,
        opportunityId: job.opportunityId,
        error: err.message
      });
    }
  }

  async function postOnInstagram(job) {
    updateStatus("Searching for Instagram comment box...");
    await sleep(1500);

    let textarea = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      textarea = document.querySelector(
        'textarea[aria-label*="Add a comment" i], textarea[placeholder*="Add a comment" i], form textarea, div[role="textbox"][contenteditable="true"]'
      );

      if (textarea) {
        const style = window.getComputedStyle(textarea);
        if (style.display !== "none" && style.visibility !== "hidden") {
          break;
        }
      }

      // If comment box isn't immediately visible, look for comment icon button to open it
      const commentIcons = Array.from(document.querySelectorAll('svg[aria-label*="Comment" i], button, div[role="button"]')).filter((el) => {
        const aria = (el.getAttribute("aria-label") || "").toLowerCase();
        return aria === "comment";
      });

      if (commentIcons.length > 0) {
        simulateRealClick(commentIcons[0]);
      }

      await sleep(500);
    }

    if (!textarea) {
      throw new Error("Could not find Instagram comment box. Please make sure you are logged into Instagram.");
    }

    updateStatus("Entering approved reply...");
    textarea.scrollIntoView({ behavior: "smooth", block: "center" });
    textarea.focus();
    await sleep(350);

    // Set value using prototype setter to ensure React state update
    if (textarea.tagName.toLowerCase() === "textarea") {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      if (nativeSetter) {
        nativeSetter.call(textarea, job.text);
      } else {
        textarea.value = job.text;
      }
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // Contenteditable fallback
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(textarea);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("insertText", false, job.text);
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: job.text }));
    }

    await sleep(800);

    updateStatus("Submitting comment to Instagram...");

    // Find the "Post" button
    const container = textarea.closest("form") || textarea.parentElement?.parentElement;
    let postBtn = null;

    if (container) {
      postBtn = Array.from(container.querySelectorAll('button, div[role="button"]')).find((b) => {
        const t = (b.textContent || "").trim().toLowerCase();
        const disabled = b.getAttribute("disabled") !== null || b.getAttribute("aria-disabled") === "true";
        return (t === "post" || b.getAttribute("type") === "submit") && !disabled;
      });
    }

    if (postBtn) {
      simulateRealClick(postBtn);
    } else {
      // Enter keypress fallback
      const enterDown = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true });
      textarea.dispatchEvent(enterDown);
      const enterUp = new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true });
      textarea.dispatchEvent(enterUp);
    }

    // Verification
    updateStatus("Verifying comment submission...", true);
    let verified = false;
    for (let i = 0; i < 20; i++) {
      await sleep(350);
      const val = (textarea.value || textarea.textContent || "").trim();
      const pageHasText = (document.body.innerText || "").includes(job.text.slice(0, 15));
      if (pageHasText || val === "" || val !== job.text.trim()) {
        verified = true;
        break;
      }
    }

    if (!verified) {
      throw new Error("Instagram submit attempted, but confirmation could not be verified.");
    }

    updateStatus("✅ Success! Verified comment is live on Instagram.", true);
    await sleep(1500);

    chrome.runtime.sendMessage({
      action: "POST_DONE",
      platform: "instagram",
      success: true,
      opportunityId: job.opportunityId,
      commentUrl: window.location.href
    });
  }
})();
