import { Card, CardContent } from "@/components/ui/card";
import { ArrowRightLeft, FileText, Smartphone, Send } from "lucide-react";

const actions = [
  {
    icon: Send,
    title: "Send with Zelle",
    description: "Send money instantly",
    iconBg: "bg-accent",
  },
  {
    icon: ArrowRightLeft,
    title: "External Transfer",
    description: "Transfer to other banks",
    iconBg: "bg-success",
  },
  {
    icon: Smartphone,
    title: "Mobile Deposit",
    description: "Deposit checks instantly",
    iconBg: "bg-warning",
  },
  {
    icon: FileText,
    title: "Pay Bills",
    description: "Manage bill payments",
    iconBg: "bg-secondary",
  },
];

interface QuickActionsProps {
  onZelleClick?: () => void;
  onTransferClick?: () => void;
  onMobileDepositClick?: () => void;
  onPayBillsClick?: () => void;
}

export const QuickActions = ({ onZelleClick, onTransferClick, onMobileDepositClick, onPayBillsClick }: QuickActionsProps) => {
  const handleActionClick = (title: string) => {
    if (title === "Send with Zelle") onZelleClick?.();
    else if (title === "External Transfer") onTransferClick?.();
    else if (title === "Mobile Deposit") onMobileDepositClick?.();
    else if (title === "Pay Bills") onPayBillsClick?.();
  };
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Card
            key={action.title}
            className="group cursor-pointer overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg"
            onClick={() => handleActionClick(action.title)}
          >
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div
                className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${action.iconBg} text-white shadow-lg transition-transform group-hover:scale-110`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mb-1 font-semibold text-secondary">{action.title}</h3>
              <p className="text-sm text-muted-foreground">{action.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
