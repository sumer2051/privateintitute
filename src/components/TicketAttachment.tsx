import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Loader2, ImageIcon } from "lucide-react";

const MAX_MB = 10;
export const MAX_ATTACHMENT_BYTES = MAX_MB * 1024 * 1024;

export function formatBytes(b?: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Uploads a file to the ticket-attachments bucket under `<ticketId>/<uuid>-<name>`.
 * Returns metadata to persist on the ticket_messages row.
 */
export async function uploadTicketAttachment(ticketId: string, file: File) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`File too large (max ${MAX_MB} MB)`);
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const path = `${ticketId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from("ticket-attachments")
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new Error(error.message);
  return {
    attachment_path: path,
    attachment_name: file.name,
    attachment_type: file.type || "application/octet-stream",
    attachment_size: file.size,
  };
}

export function AttachmentPreview({
  path,
  name,
  type,
  size,
}: {
  path: string;
  name?: string | null;
  type?: string | null;
  size?: number | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isImage = (type || "").startsWith("image/");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage
        .from("ticket-attachments")
        .createSignedUrl(path, 60 * 60);
      if (!cancelled) {
        setUrl(data?.signedUrl || null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [path]);

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-md border bg-background/50 px-2 py-1.5 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading attachment…
      </div>
    );
  }
  if (!url) {
    return (
      <div className="mt-2 rounded-md border bg-background/50 px-2 py-1.5 text-xs text-muted-foreground">
        Attachment unavailable
      </div>
    );
  }

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
        <img
          src={url}
          alt={name || "attachment"}
          className="max-h-48 max-w-full rounded-md border object-cover"
        />
        <div className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
          <ImageIcon className="h-3 w-3" /> {name} {size ? `· ${formatBytes(size)}` : ""}
        </div>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={name || undefined}
      className="mt-2 flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs text-foreground hover:bg-muted transition"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{name || "attachment"}</span>
      <span className="opacity-60">{formatBytes(size)}</span>
      <Download className="h-3.5 w-3.5 opacity-70" />
    </a>
  );
}
