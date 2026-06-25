import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, HelpCircle, Phone, MapPin, Wrench } from "lucide-react";

interface SupportPageProps {
  onNotify: (title: string, message: string, type: "success" | "info") => void;
  onOpenDevTools: () => void;
}

export const SupportPage = ({ onNotify, onOpenDevTools }: SupportPageProps) => {
  const supportOptions = [
    {
      icon: MessageCircle,
      title: "Live Chat",
      description: "Chat with our AI assistant — escalates to a specialist when needed",
      action: () => {
        window.dispatchEvent(new Event("open-ai-chat"));
        onNotify("Live Chat", "Opening AI assistant...", "info");
      },
    },
    {
      icon: Phone,
      title: "Contact Support",
      description: "Speak with our support team",
      action: () => {
        onNotify("Contact Support", "Connecting you to customer service...", "info");
        setTimeout(() => {
          onNotify("Support", "Customer service representative will be with you shortly", "success");
        }, 2000);
      },
    },
    {
      icon: HelpCircle,
      title: "FAQ",
      description: "Browse frequently asked questions",
      action: () => {
        onNotify("FAQ", "Opening frequently asked questions...", "info");
      },
    },
    {
      icon: MapPin,
      title: "Visit Branch",
      description: "Find a branch location near you",
      action: () => {
        onNotify("Branch Locator", "Finding branches near you...", "info");
        setTimeout(() => {
          onNotify("Branch Found", "Nearest branch: 123 Main St (0.5 miles away)", "success");
        }, 1500);
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-3xl font-bold text-secondary">Support Center</h2>
        <p className="text-muted-foreground">Get help with your account and banking needs</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {supportOptions.map((option) => {
          const Icon = option.icon;
          return (
            <Card key={option.title} className="transition-all hover:-translate-y-1 hover:shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-secondary">{option.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button onClick={option.action} className="w-full">
                  Get Help
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-t-4 border-t-accent">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent/80 text-white shadow-lg">
            <Wrench className="h-8 w-8" />
          </div>
          <div>
            <h3 className="mb-2 text-xl font-bold text-secondary">Developer Tools</h3>
            <p className="mb-4 text-sm text-muted-foreground">Add funds to your account for testing purposes</p>
          </div>
          <Button onClick={onOpenDevTools} className="bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70">
            <Wrench className="mr-2 h-4 w-4" />
            Open Developer Tools
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
