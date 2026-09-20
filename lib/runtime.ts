export function isLiveMode() {
  return process.env.APP_MODE === "live" && hasSupabase();
}

export function hasSupabase() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function hasSyften() {
  return Boolean(process.env.SYFTEN_API_TOKEN);
}

export function hasRedditPublishing() {
  if (process.env.REDDIT_PUBLISHING_ENABLED !== "true") return false;
  return Boolean(process.env.REDDIT_DEVVIT_APP_SLUG || (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET && process.env.REDDIT_REFRESH_TOKEN));
}

export function connectionStatus() {
  return {
    mode: isLiveMode() ? "live" : "demo",
    supabase: hasSupabase(),
    openai: hasOpenAI(),
    syften: hasSyften(),
    redditPublishing: hasRedditPublishing(),
    netlify: Boolean(process.env.NETLIFY || process.env.DEPLOY_ID),
  };
}
