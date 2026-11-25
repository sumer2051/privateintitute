import { useEffect, useState } from "react";
import { ExternalLink, Users, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface TikTokProfile {
  username: string;
  display_name: string;
  avatar_url: string;
  profile_url: string;
  follower_count: number;
  likes_count: number;
  video_count: number;
}

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

export const TikTokFollowStrip = () => {
  const [profile, setProfile] = useState<TikTokProfile | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.functions.invoke("tiktok-profile");
      if (active) {
        if (!error && data && typeof data.username === "string") setProfile(data as TikTokProfile);
        setDone(true);
      }
    })();
    return () => { active = false; };
  }, []);

  // While loading, or if TikTok can't be reached, the strip simply isn't shown.
  if (!done || !profile) return null;

  return (
    <div className="luxe-card relative overflow-hidden rounded-2xl border border-primary/15 bg-card/60 p-4 backdrop-blur-md shadow-lg shadow-primary/10">
      <div className="flex items-center gap-3 md:gap-4">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full border border-primary/20 object-cover md:h-14 md:w-14"
          />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-full bg-primary/15 md:h-14 md:w-14" />
        )}

        <div className="min-w-0 flex-1">
          <p className="luxe-label text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Follow the bank
          </p>
          <p className="truncate font-display text-sm font-semibold text-secondary md:text-base">
            {profile.display_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            @{profile.username}
            <span className="mx-1.5 opacity-50">·</span>
            <Users className="mr-0.5 inline h-3 w-3 align-[-1px]" />
            {compact(profile.follower_count)} followers
            <span className="mx-1.5 opacity-50">·</span>
            <PlayCircle className="mr-0.5 inline h-3 w-3 align-[-1px]" />
            {compact(profile.video_count)} videos
          </p>
        </div>

        <Button
          asChild
          size="sm"
          className="shrink-0 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
        >
          <a href={profile.profile_url} target="_blank" rel="noopener noreferrer">
            Follow
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );
};
