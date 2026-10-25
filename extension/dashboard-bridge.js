// Content script running on the Tun Conversation Engine dashboard
(() => {
  // Announce to the web application that the Tun Extension is installed and active
  document.documentElement.dataset.tunExtensionLoaded = "true";
  window.dispatchEvent(new CustomEvent("tun-extension-ready", { detail: { version: "1.1.0" } }));

  // Listen for actions dispatched from the Next.js review UI
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || typeof event.data !== "object") return;

    if (event.data.type === "TUN_PING_EXTENSION") {
      window.postMessage({ type: "TUN_PONG_EXTENSION", version: "1.1.0" }, "*");
      return;
    }

    if (event.data.type === "TUN_TRIGGER_POST" || event.data.type === "TUN_TRIGGER_REDDIT_POST") {
      const { opportunityId, url, text, platform } = event.data;
      if (!url || !text) {
        window.postMessage({
          type: "TUN_POST_RESULT",
          opportunityId,
          success: false,
          error: "Missing URL or draft text"
        }, "*");
        return;
      }

      // Check if extension context is valid
      try {
        if (!chrome.runtime || !chrome.runtime.id) {
          throw new Error("Extension was reloaded. Please refresh this dashboard tab (press F5).");
        }

        chrome.runtime.sendMessage(
          {
            action: "START_POSTING",
            platform: platform || "reddit",
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
      } catch (err) {
        window.postMessage({
          type: "TUN_POST_RESULT",
          opportunityId,
          success: false,
          error: "Extension context refreshed. Please reload this dashboard page (press F5) and try again."
        }, "*");
      }
    }
  });

  // Listen for updates from background.js (completion or errors) and forward to dashboard
  try {
    if (chrome.runtime && chrome.runtime.onMessage) {
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
    }
  } catch (e) {}
})();
