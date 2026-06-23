import { Bell, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg">
            <span className="text-xl font-bold text-primary-foreground">B</span>
          </div>
          <h1 className="text-xl font-bold text-secondary">BoA private institute</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search accounts, services..."
              className="w-64 pl-10"
            />
          </div>

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs" variant="destructive">
              2
            </Badge>
          </Button>

          <Button variant="ghost" size="icon">
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <nav className="border-t bg-card">
        <div className="container mx-auto flex gap-1 overflow-x-auto px-4">
          {["Overview", "Accounts", "Transfers", "Bill Pay", "Security", "Support"].map((item) => (
            <button
              key={item}
              className="whitespace-nowrap border-b-2 border-transparent px-6 py-3 text-sm font-semibold text-secondary transition-all hover:border-primary hover:text-primary"
            >
              {item}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
};
