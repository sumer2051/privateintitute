import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const bio = "Business of Associations | BoA private institute\nUpdates & money-safety tips.";
const posts = [
  { title: "Meet BoA private institute", shot: "15 seconds · Logo opening, then a team member speaking to camera.", script: "Welcome to BoA private institute. BoA stands for Business of Associations. Follow this page for our updates and practical money-safety tips. Never share your password or PIN in comments or messages.", caption: "Meet BoA private institute — Business of Associations. Follow for updates and money-safety tips. #BoAPrivateInstitute #BusinessOfAssociations #MoneySafety" },
  { title: "Three details to keep private", shot: "20 seconds · Presenter with three text overlays: Password. PIN. Verification code.", script: "Three things to keep out of comments and direct messages: your password, your PIN, and your verification codes. If someone asks for them, stop and check through your account's support page. Protect your information before you respond.", caption: "Your password, PIN, and verification codes stay private. Stop and verify before you respond. #MoneySafety #OnlineSafety #BoAPrivateInstitute" },
  { title: "Pending does not mean completed", shot: "20 seconds · Use a staged screen with fictional data; show Pending, Processing, Completed.", script: "A transfer request and a completed transfer are not the same thing. Check the status in your account, and contact support if something looks wrong. Never post account numbers, balances, or transaction details in public comments.", caption: "Check the status, not just the screenshot. Keep personal transaction details out of public comments. #TransferSafety #MoneySafety #BoAPrivateInstitute" },
];

export function TikTokProfileKit() {
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Copied."); }
    catch { toast.error("Could not copy. Please select and copy the text."); }
  };
  return <section className="space-y-8 pt-6">
    <div className="flex items-start gap-5">
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="BoA private institute bank logo" className="h-24 w-24 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 space-y-2"><h2 className="text-xl font-semibold">Public profile starter kit</h2><p className="text-sm text-muted-foreground">BoA private institute · @bprivate.banking</p><Button asChild size="sm" variant="outline"><a href={`${import.meta.env.BASE_URL}logo.png`} download="BoA-private-institute-logo.png"><Download className="mr-2 h-4 w-4" />Logo</a></Button></div>
    </div>
    <div className="space-y-3 border-y py-5">
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Profile bio</h3><Button size="sm" variant="outline" onClick={() => void copy(bio)}><Copy className="mr-2 h-4 w-4" />Copy bio</Button></div>
      <p className="whitespace-pre-line text-sm">{bio}</p>
      <p className="text-xs text-muted-foreground">{bio.length} characters · Suggested display name: BoA private institute</p>
    </div>
    <div className="space-y-6"><h3 className="text-xl font-semibold">First three posts</h3>
      {posts.map((post, i) => <article key={post.title} className="space-y-3 border-b pb-6">
        <h4 className="font-semibold"><span className="mr-2 text-primary">0{i + 1}</span>{post.title}</h4>
        <p className="text-sm text-muted-foreground">{post.shot}</p>
        <p className="text-sm leading-relaxed">{post.script}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{post.caption}</p>
        <Button size="sm" variant="outline" onClick={() => void copy(`${post.script}\n\n${post.caption}`)}><Copy className="mr-2 h-4 w-4" />Copy script & caption</Button>
      </article>)}
    </div>
    <p className="text-sm text-muted-foreground">Drafts for review. No profile changes or posts have been published. Change your photo and bio in TikTok → Profile → Edit profile. Add a website link if your account offers that option.</p>
  </section>;
}