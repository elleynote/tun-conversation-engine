// Fully Automated Reddit Posting Content Script for Tun Conversation Engine
(() => {
  let activeJob = null;
  let bannerElement = null;

  // Listen for direct execution messages from background.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "EXECUTE_POST" && message.job) {
      startPostingFlow(message.job);
      sendResponse({ ok: true });
    }
  });

  // Also check local storage on startup
  (async () => {
    const { tunPendingJob: job } = await chrome.storage.local.get("tunPendingJob");
    if (job && job.text && Date.now() - (job.startedAt || 0) < 180000) {
      startPostingFlow(job);
    }
  })();

  function createFloatingBanner(job) {
    if (bannerElement) bannerElement.remove();

    bannerElement = document.createElement("div");
    bannerElement.id = "tun-poster-banner";
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
          <strong style="color: #60a5fa;">Tun Conversation Engine</strong>
        </div>
        <button id="tun-banner-close" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px;">✕</button>
      </div>
      <div id="tun-banner-status" style="font-size: 13px; color: #cbd5e1; line-height: 1.4;">Automating reply...</div>
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
      updateStatus("Expanding Reddit comment box...");
      await sleep(1500);

      // Step 1: Open the composer
      await expandCommentComposer();
      await sleep(1000);

      // Step 2: Find the active editor (WITHOUT offsetParent checking which breaks on fixed/sticky elements)
      updateStatus("Focusing editor...");
      const editor = await findActiveEditor();
      if (!editor) {
        throw new Error("Could not find the comment box. Reddit might be loading slowly.");
      }

      updateStatus("Typing approved reply...");
      editor.scrollIntoView({ behavior: "smooth", block: "center" });
      editor.focus();
      await sleep(400);

      // Step 3: Insert text cleanly into Lexical / ProseMirror
      insertTextIntoEditor(editor, job.text);
      await sleep(1200);

      // Step 4: Find submit button
      updateStatus("Submitting comment...");
      const submitBtn = await findComposerSubmitButton(editor);
      if (!submitBtn) {
        throw new Error("Comment inserted, but submit button was not found.");
      }

      simulateRealClick(submitBtn);
      updateStatus("Submitting to Reddit...", true);
      await sleep(3500);

      updateStatus("✅ Success! Comment posted to Reddit.", true);

      chrome.runtime.sendMessage({
        action: "REDDIT_POST_DONE",
        success: true,
        opportunityId: job.opportunityId,
        commentUrl: window.location.href
      });

    } catch (err) {
      console.warn("[Tun Poster Notice]:", err);
      updateStatus(`Error: ${err.message}`, false, true);
      chrome.runtime.sendMessage({
        action: "REDDIT_POST_DONE",
        success: false,
        opportunityId: job.opportunityId,
        error: err.message
      });
    }
  }

  // Clicks and expands Modern Reddit's comment composer
  async function expandCommentComposer() {
    // 1. Check for comment reply buttons if URL is a permalink
    const pathname = window.location.pathname;
    const parts = pathname.split("/").filter(Boolean);
    const commentsIndex = parts.indexOf("comments");
    const targetCommentId = (commentsIndex !== -1 && parts.length > commentsIndex + 3) ? parts[commentsIndex + 3] : null;

    if (targetCommentId) {
      const replyBtn = document.querySelector(`[id*="${targetCommentId}"] button[aria-label*="Reply" i], [thingid*="${targetCommentId}"] .reply-button, [id*="${targetCommentId}"] shreddit-comment-action-row button`);
      if (replyBtn) {
        simulateRealClick(replyBtn);
        return;
      }
    }

    // 2. Click the comment box container
    const targets = Array.from(document.querySelectorAll('faceplate-textarea-input, comment-composer-host, shreddit-comment-composer, shreddit-async-loader[bundlename="comment_composer"], [name="comment"], div, p, span, button'));
    for (const el of targets) {
      const placeholder = (el.getAttribute("placeholder") || "").toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const text = (el.textContent || "").trim().toLowerCase();

      if (
        placeholder.includes("join the conversation") ||
        aria.includes("join the conversation") ||
        placeholder.includes("add a comment") ||
        aria.includes("add a comment") ||
        (text.includes("join the conversation") && el.children.length <= 2)
      ) {
        simulateRealClick(el);
        return;
      }
    }
  }

  // Finds the active editable element without broken offsetParent checks
  async function findActiveEditor() {
    for (let i = 0; i < 20; i++) {
      const candidates = [
        document.querySelector('comment-composer-host div[contenteditable="true"]'),
        document.querySelector('shreddit-comment-composer div[contenteditable="true"]'),
        document.querySelector('faceplate-form div[contenteditable="true"]'),
        document.querySelector('div[role="textbox"][contenteditable="true"]'),
        document.querySelector('div[contenteditable="true"]'),
        document.querySelector('textarea[name="text"]'),
        document.querySelector('textarea[placeholder*="comment" i]'),
        document.querySelector('textarea[placeholder*="conversation" i]'),
        document.querySelector('faceplate-textarea-input textarea')
      ].filter(Boolean);

      for (const cand of candidates) {
        const style = window.getComputedStyle(cand);
        if (style.display !== "none" && style.visibility !== "hidden") {
          return cand;
        }
      }

      // Check shadowRoot if applicable
      const hosts = Array.from(document.querySelectorAll('comment-composer-host, shreddit-comment-composer'));
      for (const h of hosts) {
        if (h.shadowRoot) {
          const shadowEditor = h.shadowRoot.querySelector('div[contenteditable="true"], textarea');
          if (shadowEditor) return shadowEditor;
        }
      }

      await sleep(250);
    }
    return null;
  }

  // Inserts text into Lexical / ProseMirror and triggers full change pipelines
  function insertTextIntoEditor(editor, text) {
    editor.focus();

    if (editor.isContentEditable) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);

      const ok = document.execCommand("insertText", false, text);
      if (!ok || !(editor.textContent || "").includes(text.slice(0, 8))) {
        editor.innerText = text;
      }

      editor.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertText", data: text, bubbles: true, cancelable: true }));
      editor.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: text, bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      editor.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
      editor.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
    } else {
      editor.value = text;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // Finds submit button strictly inside the composer
  async function findComposerSubmitButton(editor) {
    for (let i = 0; i < 15; i++) {
      const composer = (
        editor.closest("comment-composer-host") ||
        editor.closest("shreddit-comment-composer") ||
        editor.closest("faceplate-form") ||
        editor.closest("form") ||
        editor.parentElement?.parentElement
      );

      if (composer) {
        const buttons = Array.from(composer.querySelectorAll('button'));
        const submitBtn = buttons.find((btn) => {
          const text = (btn.textContent || "").trim().toLowerCase();
          const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
          return (text === "comment" || text === "reply" || text === "save" || aria === "comment");
        });

        if (submitBtn && !submitBtn.disabled) return submitBtn;
      }

      // Check root node if in shadow DOM
      const root = editor.getRootNode && editor.getRootNode();
      if (root && root.querySelectorAll) {
        const shadowButtons = Array.from(root.querySelectorAll('button'));
        const shadowSubmit = shadowButtons.find((btn) => {
          const text = (btn.textContent || "").trim().toLowerCase();
          return (text === "comment" || text === "reply" || text === "save") && !btn.disabled;
        });
        if (shadowSubmit) return shadowSubmit;
      }

      await sleep(250);
    }
    return null;
  }
})();
