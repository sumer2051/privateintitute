import { useEffect } from "react";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { viewAs } from "@/lib/view-as";

/** Shown only inside the admin's member-view frame. */
export function ViewAsBanner() {
  useEffect(() => {
    if (!viewAs) return;
    const blocked = () => toast.info("View only — admin preview. Nothing was changed.", { id: "view-as-blocked" });
    window.addEventListener("view-as-blocked", blocked);
    return () => window.removeEventListener("view-as-blocked", blocked);
  }, []);
  if (!viewAs) return null;
  return <div role="status" className="sticky top-0 z-[100] flex items-center justify-center gap-1 bg-secondary px-2 py-1 text-xs text-secondary-foreground">
    <Eye className="h-3 w-3" /> Viewing as {viewAs.name} · view only
  </div>;
}
