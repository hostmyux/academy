import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Bell, Plus, Menu } from "lucide-react";

interface HeaderProps {
  onMenuClick: () => void;
}

const pageConfig = {
  "/": { title: "Dashboard", description: "Overview of your consulting business" },
  "/leads": { title: "Leads & Contacts", description: "Manage your prospective students" },
  "/applications": { title: "Applications", description: "Track student applications" },
  "/universities": { title: "Universities", description: "Browse universities and programs" },
  "/pipeline": { title: "Pipeline", description: "Manage your sales pipeline" },
  "/agents": { title: "Agents", description: "Manage your team members" },
  "/billing": { title: "Billing", description: "Manage payments and invoicing" },
  "/reports": { title: "Reports", description: "Analytics and reporting" },
  "/settings": { title: "Settings", description: "Account and system settings" },
  "/student-portal": { title: "Student Portal", description: "Student self-service portal" },
};

export function Header({ onMenuClick }: HeaderProps) {
  const [location] = useLocation();
  const config = pageConfig[location as keyof typeof pageConfig] || pageConfig["/"];

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden text-muted-foreground hover:text-foreground"
            onClick={onMenuClick}
            data-testid="button-menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold">{config.title}</h2>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="relative text-muted-foreground hover:text-foreground"
            data-testid="button-notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-xs text-destructive-foreground flex items-center justify-center">
              3
            </span>
          </Button>
          <Button
            className="text-sm font-medium"
            data-testid="button-add-lead"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>
    </header>
  );
}
