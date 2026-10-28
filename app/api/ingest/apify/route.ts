import { NextResponse } from "next/server";
import { fetchApifyDatasetItems, runApifyTask, type ApifyInstagramItem } from "@/lib/apify/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveMode } from "@/lib/runtime";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow webhooks if no CRON_SECRET configured
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;
  return false;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isLiveMode()) {
    return NextResponse.json({
      error: "APP_MODE must be live and Supabase configured for real ingestion",
    }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const body = await request.json().catch(() => ({}));

    // Ensure source exists for instagram & linkedin
    const { data: instagramSource } = await supabase
      .from("sources")
      .upsert(
        {
          key: "instagram",
          name: "Instagram Social Listening",
          source_type: "monitoring",
          enabled: true,
          config: { platform: "instagram", provider: "apify" },
        },
        { onConflict: "key" },
      )
      .select()
      .single();

    const { data: linkedinSource } = await supabase
      .from("sources")
      .upsert(
        {
          key: "linkedin",
          name: "LinkedIn Social Listening",
          source_type: "monitoring",
          enabled: true,
          config: { platform: "linkedin", provider: "apify" },
        },
        { onConflict: "key" },
      )
      .select()
      .single();

    let items: any[] = [];
    let datasetId: string | null = null;

    // 1. Apify Webhook event payload (ACTOR.RUN.SUCCEEDED)
    const webhookDatasetId =
      body?.resource?.defaultDatasetId ||
      body?.eventData?.defaultDatasetId ||
      body?.defaultDatasetId ||
      body?.datasetId;

    if (webhookDatasetId) {
      datasetId = webhookDatasetId;
      items = await fetchApifyDatasetItems(webhookDatasetId, 200);
    } else if (Array.isArray(body?.items)) {
      items = body.items;
    } else if (body?.taskId) {
      // Trigger task run directly
      const run = await runApifyTask(body.taskId);
      return NextResponse.json({
        ok: true,
        message: "Triggered Apify task run",
        runId: run.runId,
        datasetId: run.datasetId,
      });
    }

    if (!items.length) {
      return NextResponse.json({
        ok: true,
        message: "No items to ingest",
        datasetId,
      });
    }

    let insertedPosts = 0;
    let insertedComments = 0;

    for (const item of items) {
      // 1. Check if item is from LinkedIn
      const isLinkedIn = Boolean(
        item.linkedinUrl ||
        item.shareLinkedinUrl ||
        (typeof item.url === "string" && item.url.includes("linkedin.com")) ||
        item.entityId
      );

      if (isLinkedIn && linkedinSource) {
        const postUrl = item.shareLinkedinUrl || item.linkedinUrl || item.url || null;
        const externalPostId = item.id ? `li_${item.id}` : `li_${item.entityId || Date.now()}`;
        const threadKey = item.entityId ? `linkedin:${item.entityId}` : `linkedin:${externalPostId}`;
        const authorName = item.author?.name || item.authorName || "LinkedIn user";
        const content = item.content || item.text || "";

        const postRow = {
          source_id: linkedinSource.id,
          external_id: externalPostId,
          platform: "linkedin",
          community: item.query?.search ? `LinkedIn: "${item.query.search}"` : "LinkedIn Discussion",
          author: authorName,
          title: content ? content.slice(0, 100) : "LinkedIn discussion",
          content,
          original_url: postUrl,
          published_at: item.postedAt?.date || item.timestamp || null,
          detected_at: new Date().toISOString(),
          matched_filter: item.query?.search || "linkedin_search",
          status: "new",
          source_analysis: {
            authorInfo: item.author?.info || null,
            authorAvatar: item.author?.avatar?.url || null,
            engagement: item.engagement || {},
          },
          raw_payload: item,
          thread_key: threadKey,
          is_thread_root: true,
        };

        const { error: postError } = await supabase
          .from("opportunities")
          .upsert(postRow, { onConflict: "source_id,external_id", ignoreDuplicates: true });

        if (!postError) insertedPosts++;
        continue;
      }

      // 2. Handle Instagram posts & reels
      if (instagramSource) {
        const shortCode = item.shortCode || (item.url ? item.url.split("/p/")[1]?.split("/")[0] : null);
        const postUrl = item.url || (shortCode ? `https://www.instagram.com/p/${shortCode}/` : null);
        const threadKey = shortCode ? `instagram:${shortCode}` : null;
        const externalPostId = item.id ? String(item.id) : shortCode ? `ig_${shortCode}` : null;

        if (externalPostId) {
          const postRow = {
            source_id: instagramSource.id,
            external_id: externalPostId,
            platform: "instagram",
            community: item.hashtags?.[0] ? `#${item.hashtags[0]}` : null,
            author: item.ownerUsername || item.ownerFullName || null,
            title: item.caption ? item.caption.slice(0, 100) : "Instagram post",
            content: item.caption || "",
            original_url: postUrl,
            published_at: item.timestamp || null,
            detected_at: new Date().toISOString(),
            matched_filter: item.inputUrl || (item.hashtags?.length ? `#${item.hashtags.join(", #")}` : "instagram_hashtag"),
            status: "new",
            source_analysis: {
              hashtags: item.hashtags || [],
              commentsCount: item.commentsCount || 0,
              likesCount: item.likesCount || 0,
            },
            raw_payload: item,
            thread_key: threadKey,
            is_thread_root: true,
          };

          const { error: postError } = await supabase
            .from("opportunities")
            .upsert(postRow, { onConflict: "source_id,external_id", ignoreDuplicates: true });

          if (!postError) insertedPosts++;
        }

        // Ingest latest comments as potential learner questions
        if (Array.isArray(item.latestComments) && item.latestComments.length > 0) {
          for (let idx = 0; idx < item.latestComments.length; idx++) {
            const comment = item.latestComments[idx];
            if (!comment || !comment.text || typeof comment.text !== "string") continue;

            const commentExternalId = comment.id
              ? String(comment.id)
              : `${externalPostId}_comment_${idx}`;

            const commentRow = {
              source_id: instagramSource.id,
              external_id: commentExternalId,
              platform: "instagram",
              community: item.hashtags?.[0] ? `#${item.hashtags[0]}` : null,
              author: comment.ownerUsername || null,
              title: `Comment by @${comment.ownerUsername || "user"} on @${item.ownerUsername || "post"}`,
              content: comment.text,
              original_url: postUrl,
              published_at: comment.timestamp || null,
              detected_at: new Date().toISOString(),
              matched_filter: "instagram_comment",
              status: "new",
              source_analysis: {
                parentPostShortCode: shortCode,
                parentAuthor: item.ownerUsername || null,
              },
              raw_payload: comment,
              thread_key: threadKey,
              is_thread_root: false,
            };

            const { error: commentError } = await supabase
              .from("opportunities")
              .upsert(commentRow, { onConflict: "source_id,external_id", ignoreDuplicates: true });

            if (!commentError) insertedComments++;
          }
        }
      }
    }

    await supabase.from("settings").upsert(
      {
        key: "apify_last_run",
        value: {
          at: new Date().toISOString(),
          datasetId,
          postsIngested: insertedPosts,
          commentsIngested: insertedComments,
          totalItemsProcessed: items.length,
        },
      },
      { onConflict: "key" },
    );

    return NextResponse.json({
      ok: true,
      datasetId,
      postsIngested: insertedPosts,
      commentsIngested: insertedComments,
      totalItemsReceived: items.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Apify ingestion failed" },
      { status: 500 },
    );
  }
}
