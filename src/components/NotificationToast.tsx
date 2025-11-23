import { useEffect } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationToastProps {
  show: boolean;
  title: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  onClose: () => void;
}

export const NotificationToast = ({ show, title, message, type, onClose }: NotificationToastProps) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-success" />,
    error: <AlertCircle className="h-5 w-5 text-destructive" />,
    warning: <AlertCircle className="h-5 w-5 text-warning" />,
    info: <Info className="h-5 w-5 text-secondary" />,
  };

  const borderColors = {
    success: "border-l-success",
    error: "border-l-destructive",
    warning: "border-l-warning",
    info: "border-l-secondary",
  };

  return (
    <div
      className={cn(
        "fixed right-5 top-5 z-[1000] flex max-w-sm items-center gap-3 rounded-lg border-l-4 bg-card p-4 shadow-lg transition-transform duration-300",
        borderColors[type],
        show ? "translate-x-0" : "translate-x-[150%]"
      )}
    >
      {icons[type]}
      <div className="flex-1">
        <div className="font-semibold text-secondary">{title}</div>
        <div className="text-sm text-muted-foreground">{message}</div>
      </div>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
