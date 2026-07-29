import { Navigate } from "react-router-dom";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useDeviceGuard } from "@/hooks/useDeviceGuard";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isReady } = useAuthReady();
  useDeviceGuard(user?.id);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return <>{children}</>;
};
