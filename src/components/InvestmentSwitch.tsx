import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const InvestmentIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={`investment-fox ${className}`} aria-hidden="true">
    <path className="investment-fox-main" fill="currentColor" d="M3 3 14 8 18 8 29 3 26 19 21 27 16 30 11 27 6 19Z" />
    <path className="investment-fox-light" fill="currentColor" d="m3 3 5 13 8 6-5 5-5-8Zm26 0-5 13-8 6 5 5 5-8Z" />
    <path className="investment-fox-dark" fill="currentColor" d="m7 15 7 3-3 3Zm18 0-7 3 3 3Zm-12 9h6l-3 6Z" />
  </svg>
);

export const InvestmentSwitch = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "checking" | "soon" | "switching" | "error">("idle");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    if (state !== "switching") return;
    const timer = window.setTimeout(() => navigate("/investment"), 800);
    return () => window.clearTimeout(timer);
  }, [state, navigate]);

  const switchAccount = async () => {
    setState("checking");
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Authentication required");
      const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (error) throw error;
      if (active.current) setState(data === true ? "switching" : "soon");
    } catch {
      if (active.current) setState("error");
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 md:h-10 md:w-10" aria-label="Investment account" title="Investment account" disabled={state === "checking" || state === "switching"} onClick={switchAccount}>
        {state === "checking" ? <Loader2 className="h-5 w-5 animate-spin" /> : <InvestmentIcon />}
      </Button>
      <Dialog open={["soon", "switching", "error"].includes(state)} onOpenChange={(open) => { if (!open && state !== "switching") setState("idle"); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mb-3 flex justify-center"><InvestmentIcon className="h-12 w-12" /></div>
            <DialogTitle>{state === "switching" ? "Switching to investment account" : state === "error" ? "Unable to switch" : "Feature coming soon"}</DialogTitle>
            <DialogDescription>{state === "switching" ? "Opening your investment account…" : state === "error" ? "We couldn't verify your access. Please try again." : "Investment accounts are not available yet."}</DialogDescription>
          </DialogHeader>
          {state === "switching" ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /> : <Button onClick={() => setState("idle")}>Close</Button>}
        </DialogContent>
      </Dialog>
    </>
  );
};