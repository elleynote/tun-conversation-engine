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

  // Also check local storage on startup in case tab was already opened
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
      <div id="tun-banner-status" style="font-size: 13px; color: #cbd5e1;">Initializing auto-poster...</div>
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
      manualPasteIntoActiveElement(job.text);
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

  async function startPostingFlow(job) {
    if (activeJob) return; // Prevent concurrent executions
    activeJob = job;
    createFloatingBanner(job);

    try {
      updateStatus("Locating Reddit comment box...");
      await sleep(1500); // Allow Reddit components to hydrate

      // Step 1: Open the comment box if collapsed
      await openCommentBoxIfCollapsed();
      await sleep(1000);

      // Step 2: Find the active rich text editor
      const editor = await findEditor();
      if (!editor) {
        throw new Error("Could not find the comment input box. Try clicking the box, then click 'Paste into Comment Box' on the banner.");
      }

      updateStatus("Entering approved response...");
      editor.scrollIntoView({ behavior: "smooth", block: "center" });
      editor.focus();
      await sleep(400);

      // Step 3: Insert the text into Reddit's Lexical/ProseMirror editor
      insertTextIntoEditor(editor, job.text);
      await sleep(1000);

      // Step 4: Find and click the submit button
      updateStatus("Locating submit button...");
      const submitBtn = await findSubmitButton(editor);
      if (!submitBtn) {
        throw new Error("Comment text entered, but submit button was not found. Please click 'Comment' manually.");
      }

      updateStatus("Submitting comment to Reddit...");
      submitBtn.click();
      await sleep(3000);

      // Step 5: Verify if the comment was actually submitted
      const isStillOpen = document.contains(editor) && (editor.textContent || "").trim().length > 0;
      if (isStillOpen && !submitBtn.disabled) {
        updateStatus("Submit was clicked, but Reddit did not accept it yet. Please click 'Comment' manually.", false, true);
        chrome.runtime.sendMessage({
          action: "REDDIT_POST_DONE",
          success: false,
          opportunityId: job.opportunityId,
          error: "Submission pending user confirmation on Reddit"
        });
        return;
      }

      updateStatus("Success! Comment posted.", true);

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

  // Opens the comment box if it is in the collapsed "Join the conversation" state
  async function openCommentBoxIfCollapsed() {
    // Check for comment reply buttons first if this is a permalink
    const pathname = window.location.pathname;
    const parts = pathname.split("/").filter(Boolean);
    const commentsIndex = parts.indexOf("comments");
    const targetCommentId = (commentsIndex !== -1 && parts.length > commentsIndex + 3) ? parts[commentsIndex + 3] : null;

    if (targetCommentId) {
      const replyBtn = document.querySelector(`[id*="${targetCommentId}"] button[aria-label*="Reply" i], [thingid*="${targetCommentId}"] .reply-button, [id*="${targetCommentId}"] shreddit-comment-action-row button`);
      if (replyBtn) {
        replyBtn.click();
        return;
      }
    }

    // Look for Modern Reddit's "Join the conversation" placeholder
    const candidates = Array.from(document.querySelectorAll('faceplate-textarea-input, shreddit-async-loader [name="comment"], [placeholder*="Join the conversation" i], button[aria-label*="Add a comment" i], div[role="button"], button'));
    for (const el of candidates) {
      const text = (el.textContent || "").trim();
      const placeholder = el.getAttribute("placeholder") || "";
      const aria = el.getAttribute("aria-label") || "";
      if (
        text.includes("Join the conversation") ||
        placeholder.includes("Join the conversation") ||
        aria.includes("Join the conversation") ||
        aria.includes("Add a comment")
      ) {
        el.click();
        el.focus();
        break;
      }
    }
  }

  // Finds the active editable element (rich text editor or textarea)
  async function findEditor() {
    for (let i = 0; i < 15; i++) {
      const editor = (
        document.querySelector('comment-composer-host div[contenteditable="true"]') ||
        document.querySelector('shreddit-comment-composer div[contenteditable="true"]') ||
        document.querySelector('faceplate-form div[contenteditable="true"]') ||
        document.querySelector('div[role="textbox"][contenteditable="true"]') ||
        document.querySelector('div[contenteditable="true"]') ||
        document.querySelector('textarea[name="text"]') ||
        document.querySelector('textarea[placeholder*="comment" i]')
      );
      if (editor) return editor;
      await sleep(300);
    }
    return null;
  }

  // Inserts text simulating real user interaction for Lexical/ProseMirror
  function insertTextIntoEditor(editor, text) {
    editor.focus();

    if (editor.isContentEditable) {
      // Clear any existing placeholder content
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);

      // Use execCommand to preserve rich-editor state
      const ok = document.execCommand("insertText", false, text);
      if (!ok || !(editor.textContent || "").includes(text.slice(0, 10))) {
        editor.textContent = text;
      }

      // Dispatch input pipeline events
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

  // Finds the submit button within the composer context
  async function findSubmitButton(editor) {
    const composer = (
      editor.closest("comment-composer-host") ||
      editor.closest("shreddit-comment-composer") ||
      editor.closest("faceplate-form") ||
      editor.closest("form") ||
      editor.closest(".usertext-buttons") ||
      document
    );

    for (let i = 0; i < 10; i++) {
      const buttons = Array.from(composer.querySelectorAll('button[type="submit"], button'));
      const found = buttons.find((btn) => {
        const text = (btn.textContent || "").trim().toLowerCase();
        const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
        return (text === "comment" || text === "save" || text === "reply" || aria === "comment");
      });

      if (found && !found.disabled) return found;
      await sleep(300);
    }
    return null;
  }

  // Manual fallback button helper
  function manualPasteIntoActiveElement(text) {
    const active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === "TEXTAREA" || active.tagName === "INPUT")) {
      insertTextIntoEditor(active, text);
      updateStatus("Pasted text into active box!", true);
    } else {
      findEditor().then((editor) => {
        if (editor) {
          insertTextIntoEditor(editor, text);
          updateStatus("Pasted text into comment box!", true);
        } else {
          updateStatus("Please click inside the comment box first, then click 'Paste'.", false, true);
        }
      });
    }
  }
})();
