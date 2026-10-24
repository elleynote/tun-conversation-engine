// Enhanced Reddit posting content script for Tun Conversation Engine
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
      <div id="tun-banner-status" style="font-size: 13px; color: #cbd5e1; line-height: 1.4;">Initializing auto-poster...</div>
      <div style="display: flex; gap: 8px; margin-top: 4px;">
        <button id="tun-btn-paste-now" style="background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer; font-weight: 600;">
          ⚡ Paste into Comment Box
        </button>
        <button id="tun-btn-copy-text" style="background: #334155; color: #e2e8f0; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer;">
          📋 Copy Text
        </button>
      </div>
    `;

    document.body.appendChild(bannerElement);

    bannerElement.querySelector("#tun-banner-close").onclick = () => bannerElement.remove();
    bannerElement.querySelector("#tun-btn-copy-text").onclick = () => {
      navigator.clipboard.writeText(job.text);
      updateStatus("Copied to clipboard!", true);
    };
    bannerElement.querySelector("#tun-btn-paste-now").onclick = () => {
      manualPasteAndSubmit(job.text);
    };
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

  // Simulates a genuine full-event human click (pointerdown -> mousedown -> focus -> click)
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
      updateStatus("Opening Reddit comment box...");
      await sleep(1500);

      // Step 1: Find and activate the "Join the conversation" box
      const activated = await findAndActivateJoinConversation();
      await sleep(1200);

      // Step 2: Find the active rich text editor
      updateStatus("Locating editor...");
      const editor = await findActiveEditor();
      if (!editor) {
        throw new Error("Could not activate comment box. Click 'Join the conversation', then click 'Paste into Comment Box' on the banner.");
      }

      updateStatus("Typing approved response...");
      editor.scrollIntoView({ behavior: "smooth", block: "center" });
      editor.focus();
      await sleep(500);

      // Step 3: Insert text into Reddit's Lexical/ProseMirror editor
      insertTextIntoEditor(editor, job.text);
      await sleep(1200);

      // Step 4: Find the submit button inside the active composer only
      updateStatus("Submitting comment...");
      const submitBtn = await findComposerSubmitButton(editor);
      if (!submitBtn) {
        throw new Error("Text entered into comment box. Please click 'Comment' button manually to confirm.");
      }

      submitBtn.click();
      updateStatus("Comment submitted! Verifying with Reddit...", true);
      await sleep(3000);

      // Step 5: Verification check
      const remainingText = (editor.textContent || "").trim();
      const stillNeedsSubmit = document.contains(submitBtn) && !submitBtn.disabled && remainingText.length > 0;
      if (stillNeedsSubmit) {
        updateStatus("Comment text is in the box. Please click the 'Comment' button below to finalize.", false, true);
        chrome.runtime.sendMessage({
          action: "REDDIT_POST_DONE",
          success: false,
          opportunityId: job.opportunityId,
          error: "Manual confirmation needed on Reddit"
        });
        return;
      }

      updateStatus("✅ Success! Comment posted to Reddit.", true);

      chrome.runtime.sendMessage({
        action: "REDDIT_POST_DONE",
        success: true,
        opportunityId: job.opportunityId,
        commentUrl: window.location.href
      });

    } catch (err) {
      console.warn("[Tun Poster Notice]:", err);
      updateStatus(err.message, false, true);
      chrome.runtime.sendMessage({
        action: "REDDIT_POST_DONE",
        success: false,
        opportunityId: job.opportunityId,
        error: err.message
      });
    }
  }

  // Targets Modern Reddit's "Join the conversation" element and triggers activation
  async function findAndActivateJoinConversation() {
    // 1. Check for specific comment reply button if permalink
    const pathname = window.location.pathname;
    const parts = pathname.split("/").filter(Boolean);
    const commentsIndex = parts.indexOf("comments");
    const targetCommentId = (commentsIndex !== -1 && parts.length > commentsIndex + 3) ? parts[commentsIndex + 3] : null;

    if (targetCommentId) {
      const replyBtn = document.querySelector(`[id*="${targetCommentId}"] button[aria-label*="Reply" i], [thingid*="${targetCommentId}"] .reply-button, [id*="${targetCommentId}"] shreddit-comment-action-row button`);
      if (replyBtn) {
        simulateRealClick(replyBtn);
        return true;
      }
    }

    // 2. Look for "Join the conversation" placeholder
    for (let attempt = 0; attempt < 8; attempt++) {
      // Find elements containing "Join the conversation"
      const all = Array.from(document.querySelectorAll('faceplate-textarea-input, shreddit-async-loader, [name="comment"], div, p, span, button'));
      const target = all.find((el) => {
        const text = (el.textContent || "").trim();
        const placeholder = el.getAttribute("placeholder") || "";
        const aria = el.getAttribute("aria-label") || "";
        return (
          placeholder.toLowerCase().includes("join the conversation") ||
          aria.toLowerCase().includes("join the conversation") ||
          (text === "Join the conversation" && el.children.length === 0)
        );
      });

      if (target) {
        simulateRealClick(target);
        return true;
      }
      await sleep(300);
    }

    return false;
  }

  // Finds the active editable element
  async function findActiveEditor() {
    for (let i = 0; i < 15; i++) {
      const editor = (
        document.querySelector('comment-composer-host div[contenteditable="true"]') ||
        document.querySelector('shreddit-comment-composer div[contenteditable="true"]') ||
        document.querySelector('faceplate-form div[contenteditable="true"]') ||
        document.querySelector('div[role="textbox"][contenteditable="true"]') ||
        document.querySelector('textarea[name="text"]') ||
        document.querySelector('textarea[placeholder*="comment" i]') ||
        document.querySelector('div[contenteditable="true"]')
      );
      if (editor && editor.offsetParent !== null) return editor;
      await sleep(300);
    }
    return null;
  }

  // Inserts text into Lexical/ProseMirror editor
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
        editor.textContent = text;
      }

      editor.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertText", data: text, bubbles: true, cancelable: true }));
      editor.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: text, bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      editor.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true }));
    } else {
      editor.value = text;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // STRICTLY finds the submit button within the active composer only (no document fallback)
  async function findComposerSubmitButton(editor) {
    const composer = (
      editor.closest("comment-composer-host") ||
      editor.closest("shreddit-comment-composer") ||
      editor.closest("faceplate-form") ||
      editor.closest("form")
    );

    if (!composer) return null;

    for (let i = 0; i < 12; i++) {
      const buttons = Array.from(composer.querySelectorAll('button[type="submit"], button'));
      const submitBtn = buttons.find((btn) => {
        const text = (btn.textContent || "").trim().toLowerCase();
        const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
        return (text === "comment" || text === "save" || aria === "comment");
      });

      if (submitBtn && !submitBtn.disabled) return submitBtn;
      await sleep(300);
    }
    return null;
  }

  // Manual fallback helper for the banner button
  function manualPasteAndSubmit(text) {
    findActiveEditor().then((editor) => {
      if (editor) {
        insertTextIntoEditor(editor, text);
        updateStatus("Text inserted into box! Click 'Comment' below to post.", true);
        findComposerSubmitButton(editor).then((btn) => {
          if (btn) btn.click();
        });
      } else {
        updateStatus("Click 'Join the conversation' first, then click this button again.", false, true);
      }
    });
  }
})();
