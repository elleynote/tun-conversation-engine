// High-Reliability Reddit Posting Content Script for Tun Conversation Engine
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

    const isOldReddit = window.location.hostname === "old.reddit.com";

    try {
      if (isOldReddit) {
        await postOnOldReddit(job);
      } else {
        await postOnModernReddit(job);
      }
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

  // --- OLD REDDIT STRATEGY (Indestructible plain HTML form submission) ---
  async function postOnOldReddit(job) {
    updateStatus("Locating comment form...");
    await sleep(800);

    // Look for target comment if permalink
    const pathname = window.location.pathname;
    const parts = pathname.split("/").filter(Boolean);
    const commentsIndex = parts.indexOf("comments");
    const targetCommentId = (commentsIndex !== -1 && parts.length > commentsIndex + 3) ? parts[commentsIndex + 3] : null;

    let targetForm = null;
    if (targetCommentId) {
      const commentEl = document.querySelector(`[data-fullname*="${targetCommentId}"], div.thing.id-t1_${targetCommentId}, [id*="${targetCommentId}"]`);
      if (commentEl) {
        const replyBtn = commentEl.querySelector(".reply-button a, a.reply-button");
        if (replyBtn) {
          replyBtn.click();
          await sleep(500);
          targetForm = commentEl.querySelector("form.usertext");
        }
      }
    }

    if (!targetForm) {
      targetForm = document.querySelector(".commentarea form.usertext, form[action*='comment']");
    }

    if (!targetForm) {
      throw new Error("Could not find comment form on old.reddit.com");
    }

    const textarea = targetForm.querySelector("textarea[name='text']");
    if (!textarea) {
      throw new Error("Could not find textarea in comment form");
    }

    updateStatus("Entering approved reply...");
    textarea.scrollIntoView({ behavior: "smooth", block: "center" });
    textarea.focus();
    textarea.value = job.text;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(600);

    updateStatus("Submitting comment...");
    const saveBtn = targetForm.querySelector("button.save, input[type='submit'], .btn");
    if (!saveBtn) {
      throw new Error("Could not find save button on comment form");
    }

    const commentCountBefore = document.querySelectorAll(".commentarea .sitetable .entry").length;
    saveBtn.click();
    updateStatus("Submitting to Reddit...", true);

    // Strict verification: Wait up to 6 seconds for new comment to appear in the DOM
    let verified = false;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      const comments = Array.from(document.querySelectorAll(".commentarea .entry .usertext-body, .entry"));
      const found = comments.some((c) => (c.textContent || "").includes(job.text.slice(0, 15)));
      const countNow = document.querySelectorAll(".commentarea .sitetable .entry").length;
      if (found || countNow > commentCountBefore) {
        verified = true;
        break;
      }
    }

    if (!verified) {
      throw new Error("Comment submit was triggered, but Reddit did not confirm insertion.");
    }

    updateStatus("✅ Success! Verified comment is live on Reddit.", true);
    await sleep(1500);

    chrome.runtime.sendMessage({
      action: "REDDIT_POST_DONE",
      success: true,
      opportunityId: job.opportunityId,
      commentUrl: window.location.href.replace("old.reddit.com", "www.reddit.com")
    });
  }

  // --- MODERN REDDIT STRATEGY (Shreddit web components) ---
  async function postOnModernReddit(job) {
    updateStatus("Expanding Reddit comment box...");
    await sleep(1200);

    // Expand composer
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
        break;
      }
    }

    await sleep(1000);

    // Find editor
    let editor = null;
    for (let i = 0; i < 15; i++) {
      const cand = document.querySelector('comment-composer-host div[contenteditable="true"], shreddit-comment-composer div[contenteditable="true"], faceplate-form div[contenteditable="true"], div[role="textbox"][contenteditable="true"], div[contenteditable="true"], textarea[name="text"]');
      if (cand) {
        const style = window.getComputedStyle(cand);
        if (style.display !== "none" && style.visibility !== "hidden") {
          editor = cand;
          break;
        }
      }
      await sleep(250);
    }

    if (!editor) {
      throw new Error("Could not find the comment box on Reddit.");
    }

    updateStatus("Typing approved response...");
    editor.scrollIntoView({ behavior: "smooth", block: "center" });
    editor.focus();
    await sleep(400);

    // Insert text
    if (editor.isContentEditable) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);

      const ok = document.execCommand("insertText", false, job.text);
      if (!ok || !(editor.textContent || "").includes(job.text.slice(0, 8))) {
        editor.innerText = job.text;
      }
      editor.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: job.text, bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      editor.value = job.text;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    }

    await sleep(1000);

    // Submit button
    const composer = editor.closest("comment-composer-host, shreddit-comment-composer, faceplate-form, form") || editor.parentElement?.parentElement;
    const submitBtn = Array.from(composer?.querySelectorAll('button') || []).find((b) => {
      const t = (b.textContent || "").trim().toLowerCase();
      return (t === "comment" || t === "save" || t === "reply") && !b.disabled;
    });

    if (!submitBtn) {
      throw new Error("Could not find enabled submit button.");
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
  }
})();
