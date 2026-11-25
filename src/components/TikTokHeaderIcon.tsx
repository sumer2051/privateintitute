import { useEffect, useState } from "react";
import { ExternalLink, Users, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

/** TikTok note glyph — drawn inline so it follows the header's text color tokens. */
const TikTokGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

/**
 * Header icon for the bank's TikTok: sits next to the theme toggle, opens a small
 * card with the live profile, and links out to the public page. Hidden when the
 * profile can't be reached so the header never shows a dead icon.
 */
export const TikTokHeaderIcon = () => {
  const [profile, setProfile] = useState<TikTokProfile | null>(null);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.functions.invoke("tiktok-profile");
      if (active) {
        if (!error && data && typeof data.username === "string") setProfile(data as TikTokProfile);
        setDone(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!done || !profile) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="TikTok"
          title="TikTok"
          className="h-9 w-9 md:h-10 md:w-10"
        >
          <TikTokGlyph className="h-[1.05rem] w-[1.05rem] md:h-5 md:w-5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-72 rounded-2xl border border-primary/15 bg-card/95 p-4 shadow-lg shadow-primary/10 backdrop-blur-md"
      >
        <div className="flex items-center gap-3">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-11 w-11 shrink-0 rounded-full border border-primary/20 object-cover"
            />
          ) : (
            <div className="h-11 w-11 shrink-0 rounded-full bg-primary/15" />
          )}

          <div className="min-w-0 flex-1">
            <p className="luxe-label text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Follow the bank
            </p>
            <p className="truncate font-display text-sm font-semibold text-secondary">
              {profile.display_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {compact(profile.follower_count)} followers
          </span>
          <span className="inline-flex items-center gap-1">
            <PlayCircle className="h-3 w-3" />
            {compact(profile.video_count)} videos
          </span>
        </div>

        <Button
          asChild
          size="sm"
          className="mt-3 w-full rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
        >
          <a href={profile.profile_url} target="_blank" rel="noopener noreferrer">
            Follow on TikTok
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
      </PopoverContent>
    </Popover>
  );
};
