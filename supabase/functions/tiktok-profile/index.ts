import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/tiktok";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Only signed-in members may read the bank's public TikTok profile.
    const auth = req.headers.get("Authorization") ?? "";
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await user.auth.getUser();
    if (!u.user) return json({ error: "Not signed in" }, 401);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI gateway key is not configured" }, 500);

    const TIKTOK_API_KEY = Deno.env.get("TIKTOK_API_KEY");
    if (!TIKTOK_API_KEY) return json({ error: "TikTok connection is not linked" }, 500);

    const response = await fetch(
      `${GATEWAY_URL}/user/info/?fields=open_id,avatar_url,display_name,username,profile_bio_url,follower_count,following_count,likes_count,video_count`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TIKTOK_API_KEY,
        },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`TikTok profile request failed [${response.status}]: ${errorBody}`);
      return json(
        { error: "TikTok request failed", status: response.status, details: errorBody },
        response.status,
      );
    }

    const payload = (await response.json()) as {
      data?: { user?: Record<string, unknown> };
      error?: { code?: string; message?: string };
    };

    // TikTok reports some failures inside a 200 body.
    if (payload.error && payload.error.code && payload.error.code !== "ok") {
      const details = `${payload.error.code}: ${payload.error.message ?? ""}`;
      console.error(`TikTok profile error: ${details}`);
      return json({ error: "TikTok request failed", details }, 502);
    }

    const raw = payload.data?.user ?? {};
    const username = typeof raw.username === "string" ? raw.username : "";
    if (!username) return json({ error: "TikTok profile is unavailable" }, 502);

    const count = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

    return json({
      username,
      display_name: typeof raw.display_name === "string" ? raw.display_name : username,
      avatar_url: typeof raw.avatar_url === "string" ? raw.avatar_url : "",
      profile_url: `https://www.tiktok.com/@${encodeURIComponent(username)}`,
      follower_count: count(raw.follower_count),
      following_count: count(raw.following_count),
      likes_count: count(raw.likes_count),
      video_count: count(raw.video_count),
    });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    console.error("tiktok-profile failed:", details);
    return json({ error: "TikTok profile lookup failed", details }, 500);
  }
});
