import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useDeviceGuard } from "@/hooks/useDeviceGuard";
import { supabase } from "@/integrations/supabase/client";

// Routes that regular users can access (non-staff pages).
const USER_ROUTES = ["/accounts", "/cards", "/transfers", "/billpay", "/support", "/overview", "/settings"];

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isReady } = useAuthReady();
  const location = useLocation();
  useDeviceGuard(user?.id);

  const [roles, setRoles] = useState<string[] | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!user?.id) { setRoles(null); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (mounted) setRoles(((data as any[]) || []).map((r) => r.role));
      });
    return () => { mounted = false; };
  }, [user?.id]);

  if (!isReady || (user && roles === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const isAdmin = roles?.includes("admin");
  const isSupport = roles?.includes("support");
  const isTxSupport = roles?.includes("tx_support");
  const staffOnly = !isAdmin && (isSupport || isTxSupport);

  if (staffOnly) {
    const path = location.pathname;
    const landing = isSupport ? "/admin/support" : "/admin/transactions";
    // Restrict staff-only accounts to their staff routes + settings.
    if (USER_ROUTES.some((p) => path === p || path.startsWith(p + "/"))) {
      return <Navigate to={landing} replace />;
    }
    if (path === "/") {
      return <Navigate to={landing} replace />;
    }
    // Guard cross-role staff pages: support cannot open admin/transactions and vice versa.
    if (isSupport && !isTxSupport && path.startsWith("/admin/transactions")) {
      return <Navigate to="/admin/support" replace />;
    }
    if (isTxSupport && !isSupport && path.startsWith("/admin/support")) {
      return <Navigate to="/admin/transactions" replace />;
    }
  }

  return <>{children}</>;
};
