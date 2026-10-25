// Background service worker for Tun Conversation Engine Extension

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "START_POSTING") {
    handleStartPosting(message, sender.tab?.id);
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === "REDDIT_POST_DONE" || message.action === "POST_DONE") {
    handlePostDone(message);
    sendResponse({ ok: true });
    return true;
  }
});

// Watch for tab loading completion and trigger execution directly
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    const { tunPendingJob: job } = await chrome.storage.local.get("tunPendingJob");
    if (job && (job.posterTabId === tabId || job.redditTabId === tabId)) {
      setTimeout(() => {
        try {
          chrome.tabs.sendMessage(tabId, { action: "EXECUTE_POST", job });
        } catch (e) {
          console.warn("Could not send EXECUTE_POST to poster tab:", e);
        }
      }, 1000);
    }
  }
});

async function handleStartPosting(data, dashboardTabId) {
  const platform = data.platform || "reddit";
  let targetUrl = data.url;

  // Use old.reddit.com for bulletproof, standard HTML form submission with the user's existing login session
  if (platform === "reddit") {
    targetUrl = data.url.replace(/^https?:\/\/(www\.)?reddit\.com/i, "https://old.reddit.com");
  }

  const job = {
    opportunityId: data.opportunityId,
    platform: platform,
    originalUrl: data.url,
    url: targetUrl,
    text: data.text,
    dashboardTabId: dashboardTabId,
    startedAt: Date.now()
  };

  // Persist pending job in local storage
  await chrome.storage.local.set({ tunPendingJob: job });

  // Open the conversation in a tab
  chrome.tabs.create({ url: targetUrl, active: true }, (newTab) => {
    job.posterTabId = newTab.id;
    job.redditTabId = newTab.id; // backward-compatibility
    chrome.storage.local.set({ tunPendingJob: job });
  });
}

async function handlePostDone(result) {
  const { tunPendingJob: job } = await chrome.storage.local.get("tunPendingJob");
  if (!job) return;

  // Clear the active job
  await chrome.storage.local.remove("tunPendingJob");

  // Inform the original dashboard tab
  if (job.dashboardTabId) {
    try {
      chrome.tabs.sendMessage(job.dashboardTabId, {
        action: "POST_COMPLETED",
        opportunityId: job.opportunityId,
        success: result.success,
        commentUrl: result.commentUrl,
        error: result.error
      });
    } catch (e) {
      console.warn("Could not message dashboard tab:", e);
    }
  }

  // Only close tab if 100% verified success
  if (result.success && job.dashboardTabId) {
    setTimeout(() => {
      try {
        chrome.tabs.update(job.dashboardTabId, { active: true });
        const targetTabId = job.posterTabId || job.redditTabId;
        if (targetTabId) {
          chrome.tabs.remove(targetTabId);
        }
      } catch (e) {}
    }, 3500);
  }
}
