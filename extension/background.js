// Background service worker for Tun Conversation Engine Extension

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "START_POSTING") {
    handleStartPosting(message, sender.tab?.id);
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === "REDDIT_POST_DONE") {
    handleRedditPostDone(message);
    sendResponse({ ok: true });
    return true;
  }
});

async function handleStartPosting(data, dashboardTabId) {
  const job = {
    opportunityId: data.opportunityId,
    url: data.url,
    text: data.text,
    dashboardTabId: dashboardTabId,
    startedAt: Date.now()
  };

  // Persist pending job in local storage
  await chrome.storage.local.set({ tunPendingJob: job });

  // Open the Reddit conversation in a tab
  chrome.tabs.create({ url: data.url, active: true }, (newTab) => {
    job.redditTabId = newTab.id;
    chrome.storage.local.set({ tunPendingJob: job });
  });
}

async function handleRedditPostDone(result) {
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

  // Focus back on the dashboard tab so the user can continue their workflow smoothly
  if (job.dashboardTabId) {
    try {
      chrome.tabs.update(job.dashboardTabId, { active: true });
    } catch (e) {}
  }

  // Close the Reddit tab after 3 seconds if successful, or leave open on error
  if (result.success && job.redditTabId) {
    setTimeout(() => {
      try {
        chrome.tabs.remove(job.redditTabId);
      } catch (e) {}
    }, 3000);
  }
}
