// Content script running on the Tun Conversation Engine dashboard
(() => {
  // Announce to the web application that the Tun Extension is installed and active
  document.documentElement.dataset.tunExtensionLoaded = "true";
  window.dispatchEvent(new CustomEvent("tun-extension-ready", { detail: { version: "1.0.1" } }));

  // Listen for actions dispatched from the Next.js review UI
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || typeof event.data !== "object") return;

    if (event.data.type === "TUN_PING_EXTENSION") {
      window.postMessage({ type: "TUN_PONG_EXTENSION", version: "1.0.1" }, "*");
      return;
    }

    if (event.data.type === "TUN_TRIGGER_REDDIT_POST") {
      const { opportunityId, url, text } = event.data;
      if (!url || !text) {
        window.postMessage({
          type: "TUN_POST_RESULT",
          opportunityId,
          success: false,
          error: "Missing URL or draft text"
        }, "*");
        return;
      }

      chrome.runtime.sendMessage(
        {
          action: "START_POSTING",
          opportunityId,
          url,
          text
        },
        (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage({
              type: "TUN_POST_RESULT",
              opportunityId,
              success: false,
              error: chrome.runtime.lastError.message
            }, "*");
          }
        }
      );
    }
  });

  // Listen for updates from background.js (completion or errors) and forward to dashboard
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.action === "POST_COMPLETED") {
      window.postMessage({
        type: "TUN_POST_RESULT",
        opportunityId: message.opportunityId,
        success: message.success,
        commentUrl: message.commentUrl,
        error: message.error
      }, "*");
    }
  });
})();
