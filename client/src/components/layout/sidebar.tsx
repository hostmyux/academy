import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { getUserInitials } from "@/lib/auth-utils";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  BarChart3,
  Users,
  FileText,
  School,
  GitBranch,
  Bus,
  CreditCard,
  BarChart2,
  Settings,
  Building2,
  LogOut
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const getNavigation = (userRole: string) => {
  const baseNavigation = [
    { name: "Dashboard", href: "/", icon: BarChart3 },
    { name: "Leads & Contacts", href: "/leads", icon: Users },
    { name: "Applications", href: "/applications", icon: FileText },
    { name: "Universities", href: "/universities", icon: School },
    { name: "Pipeline", href: "/pipeline", icon: GitBranch },
    { name: "Agents", href: "/agents", icon: Bus },
    { name: "Billing", href: "/billing", icon: CreditCard },
    { name: "Reports", href: "/reports", icon: BarChart2 },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  // Add sub-accounts navigation for tenant admins
  if (userRole === 'tenant_admin') {
    baseNavigation.splice(6, 0, { name: "Sub-Accounts", href: "/sub-accounts", icon: Building2 });
  }

  return baseNavigation;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  const navigation = getNavigation(user?.role || '');

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <>
      <aside className={cn(
        "bg-card border-r border-border w-64 sidebar-transition flex-shrink-0 sidebar-mobile z-50",
        isOpen ? "open" : ""
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">EduCRM</h1>
                <p className="text-xs text-muted-foreground">Student Consulting</p>
              </div>
            </div>
            
            {/* Tenant/Sub-Account Switcher */}
            <div className="mt-4">
              <TenantSwitcher />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              
              return (
                <Link key={item.name} href={item.href}>
                  <a
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={onClose}
                    data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </a>
                </Link>
              );
            })}
          </nav>

          {/* User profile */}
          <div className="p-4 border-t border-border">
            <div className="bg-muted p-3 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground text-sm font-medium">
                      {getUserInitials(user?.firstName, user?.lastName)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {user?.role?.replace('_', ' ')}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-foreground p-1"
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
