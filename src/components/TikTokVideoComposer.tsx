import { useEffect, useRef, useState } from "react";
import { Copy, Download, ExternalLink, Film, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { validateTikTokVideo } from "@/lib/tiktok-video";
import { toast } from "sonner";

export function TikTokVideoComposer() {
  const picker = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  useEffect(() => {
    if (!file) { setUrl(""); return; }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const select = (selected?: File) => {
    if (!selected) return;
    const message = validateTikTokVideo(selected);
    if (message) { setError(message); return; }
    setFile(selected); setError(""); setDuration(null); setCopied(false);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(caption.trim()); setCopied(true); toast.success("Caption copied — nothing posted."); }
    catch { toast.error("Could not copy. Select and copy the caption text."); }
  };
  return <section className="space-y-6 pt-6 min-w-0" aria-label="TikTok video preparation">
    <div className="space-y-2"><h2 className="flex items-center gap-2 text-xl font-semibold"><Film className="h-5 w-5 text-primary" />Prepare a video</h2><Badge variant="secondary">Manual posting</Badge><p className="text-sm text-muted-foreground">Video stays on this device. Choose the same file in TikTok and paste your caption. This draft is not saved when you leave.</p></div>
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <Input ref={picker} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" className="hidden" aria-label="Upload TikTok video" onChange={e => { select(e.target.files?.[0]); e.target.value = ""; }} />
        {url ? <video key={url} src={url} controls playsInline preload="metadata" aria-label="Uploaded video preview" className="w-full aspect-[9/16] max-h-[520px] rounded-lg bg-muted object-contain" onLoadedMetadata={e => { const seconds = e.currentTarget.duration; setDuration(Number.isFinite(seconds) ? seconds : null); }} onError={() => setError("This browser cannot preview the video. Try an MP4 with H.264 video and AAC audio; the original file is unchanged.")} /> : <div className="flex aspect-[9/16] max-h-[520px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/30 p-6 text-center" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); select(e.dataTransfer.files[0]); }}><Film className="h-10 w-10 text-muted-foreground" /><Button onClick={() => picker.current?.click()}><Upload className="mr-2 h-4 w-4" />Upload video</Button><p className="text-xs text-muted-foreground">MP4 · MOV · WebM</p></div>}
        {file && <><p className="break-all text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB{duration !== null ? ` · ${duration.toFixed(1)} seconds` : ""}</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => picker.current?.click()}><Upload className="mr-2 h-4 w-4" />Replace video</Button><Button variant="ghost" size="icon" title="Remove video" aria-label="Remove video" onClick={() => { setFile(null); setError(""); setDuration(null); }}><X className="h-4 w-4" /></Button></div></>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><Label htmlFor="tiktok-video-caption">Caption</Label>{copied && <Badge variant="outline">Copied · Not posted</Badge>}</div>
        <Textarea id="tiktok-video-caption" value={caption} onChange={e => { setCaption(e.target.value); setCopied(false); }} placeholder="Write your caption and hashtags" className="min-h-56" />
        <p className="text-xs text-muted-foreground">{caption.length.toLocaleString()} characters</p>
        <div className="flex flex-wrap gap-2"><Button onClick={() => void copy()} disabled={!caption.trim()}><Copy className="mr-2 h-4 w-4" />Copy caption</Button>{url && file && <Button asChild variant="outline"><a href={url} download={file.name}><Download className="mr-2 h-4 w-4" />Download video</a></Button>}<Button asChild variant="outline"><a href="https://www.tiktok.com/tiktokstudio/upload" target="_blank" rel="noopener noreferrer">Open TikTok upload<ExternalLink className="ml-2 h-4 w-4" /></a></Button></div>
        <div className="border-t pt-4"><p className="text-sm text-muted-foreground">Preview only · No upload to the bank or TikTok · Original video unchanged</p></div>
      </div>
    </div>
  </section>;
}