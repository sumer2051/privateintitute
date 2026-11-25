import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { ArrowLeft, ExternalLink, Heart, Loader2, Music2, RefreshCw, ShieldAlert, Sparkles, Users, Video } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { AdminTikTokPromoter } from "@/components/AdminTikTokPromoter";
import { TikTokProfileKit } from "@/components/TikTokProfileKit";
import { TikTokCommentReplies } from "@/components/TikTokCommentReplies";
import { TikTokVideoComposer } from "@/components/TikTokVideoComposer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Helmet } from "react-helmet-async";

type Profile = {
  username: string;
  display_name: string;
  avatar_url: string;
  profile_url: string;
  follower_count: number;
  following_count: number;
  likes_count: number;
  video_count: number;
};

export default function AdminTikTok() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab = requestedTab && ["profile", "drafts", "replies", "video", "account"].includes(requestedTab) ? requestedTab : "profile";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setAllowed(false); return; }
      const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (active) setAllowed(!error && data === true);
    })();
    return () => { active = false; };
  }, []);

  const profile = useQuery({
    queryKey: ["admin-tiktok-profile"],
    enabled: allowed === true,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase.functions.invoke("tiktok-profile");
      if (error) {
        const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
        throw new Error(details || "TikTok account could not be loaded.");
      }
      if (!data?.username) throw new Error(data?.error || "TikTok profile is unavailable.");
      return data as Profile;
    },
  });

  if (allowed === null) return <AuthLayout><div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Checking admin access" /></div></AuthLayout>;
  if (!allowed) return <AuthLayout><div className="mx-auto max-w-md space-y-4 py-16"><ShieldAlert className="h-8 w-8 text-destructive" /><h1 className="text-2xl font-semibold">Admin only</h1><Button asChild><Link to="/accounts">Back to accounts</Link></Button></div></AuthLayout>;

  const account = profile.data;
  return <AuthLayout>
    <Helmet><title>TikTok | BoA private institute</title><meta name="description" content="BoA private institute TikTok account and admin promotion drafts." /></Helmet>
    <div className="mx-auto max-w-5xl space-y-8 min-w-0 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Button asChild variant="link" className="h-auto p-0 text-muted-foreground"><Link to="/admin/users"><ArrowLeft className="mr-2 h-4 w-4" />Admin Users</Link></Button>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-foreground"><Music2 className="h-7 w-7 text-primary" />TikTok</h1>
        </div>
        <Button variant="outline" onClick={() => void profile.refetch()} disabled={profile.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${profile.isFetching ? "animate-spin" : ""}`} />Refresh account
        </Button>
      </div>

      {profile.isPending && <div className="flex items-center gap-3 border-y py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading TikTok account…</div>}
      {profile.isError && <div role="alert" className="space-y-2 border-y py-8"><p className="font-semibold text-destructive">TikTok account could not be loaded</p><p className="break-words text-sm text-muted-foreground">{profile.error.message}</p><Button variant="outline" onClick={() => void profile.refetch()}>Try again</Button></div>}

      {account && <section className="space-y-7 border-y py-7" aria-label="Connected TikTok account">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <img src={account.avatar_url || `${import.meta.env.BASE_URL}logo.png`} alt={`${account.display_name} profile`} className="h-20 w-20 shrink-0 rounded-full border object-cover" />
          <div className="min-w-0 flex-1 space-y-2">
            <Badge variant="secondary">Connected account</Badge>
            <h2 className="break-words text-2xl font-bold text-foreground">{account.display_name}</h2>
            <p className="break-all text-sm text-muted-foreground">@{account.username}</p>
          </div>
          <Button asChild className="self-start sm:self-center"><a href={account.profile_url} target="_blank" rel="noopener noreferrer">Open TikTok<ExternalLink className="ml-2 h-4 w-4" /></a></Button>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {[{ label: "Followers", value: account.follower_count, Icon: Users }, { label: "Following", value: account.following_count, Icon: Users }, { label: "Likes", value: account.likes_count, Icon: Heart }, { label: "Published videos", value: account.video_count, Icon: Video }].map(({ label, value, Icon }) => <div key={label} className="space-y-1"><dt className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4 shrink-0" />{label}</dt><dd className="text-3xl font-semibold tabular-nums text-foreground">{value.toLocaleString()}</dd></div>)}
        </dl>
        <p className="text-xs text-muted-foreground">Last refreshed {new Date(profile.dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      </section>}

      <Tabs value={tab} onValueChange={value => setSearchParams(previous => { const next = new URLSearchParams(previous); next.set("tab", value); return next; }, { replace: true })} className="min-w-0">
        <TabsList className="h-auto flex flex-wrap justify-start gap-1"><TabsTrigger value="profile">Public profile</TabsTrigger><TabsTrigger value="video">Video & caption</TabsTrigger><TabsTrigger value="drafts"><Sparkles className="mr-2 h-4 w-4" />Claude drafts</TabsTrigger><TabsTrigger value="replies">Comment replies</TabsTrigger><TabsTrigger value="account">Account</TabsTrigger></TabsList>
        <TabsContent value="video"><TikTokVideoComposer /></TabsContent>
        <TabsContent value="replies"><TikTokCommentReplies profileUrl={account?.profile_url} /></TabsContent>
        <TabsContent value="profile"><TikTokProfileKit /></TabsContent>
        <TabsContent value="drafts" className="pt-6"><AdminTikTokPromoter embedded /></TabsContent>
        <TabsContent value="account" className="space-y-6 pt-6">
          <h2 className="text-xl font-semibold">Account details</h2>
          <dl className="grid gap-5 sm:grid-cols-2">
            <div><dt className="text-sm text-muted-foreground">Bank</dt><dd className="mt-1 font-medium">BoA private institute</dd></div>
            <div><dt className="text-sm text-muted-foreground">Brand name</dt><dd className="mt-1 font-medium">Business of Associations</dd></div>
            <div><dt className="text-sm text-muted-foreground">TikTok handle</dt><dd className="mt-1 break-all font-medium">{account ? `@${account.username}` : "Unavailable"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Connection access</dt><dd className="mt-1 font-medium">Profile and published videos · read only</dd></div>
          </dl>
          <p className="border-t pt-4 text-sm text-muted-foreground">Viewer comments are unavailable with this connection. Publishing and replies remain in TikTok.</p>
        </TabsContent>
      </Tabs>
    </div>
  </AuthLayout>;
}