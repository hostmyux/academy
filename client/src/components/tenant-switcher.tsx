import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Building2 } from "lucide-react";

export function TenantSwitcher() {
  const { user } = useAuth();
  const [currentTenant] = useState("Global Education Partners");
  const [currentSubAccount] = useState("NYC Branch");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full justify-between text-left bg-muted hover:bg-accent"
          data-testid="tenant-switcher"
        >
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4" />
            <div>
              <div className="font-medium text-sm">{currentTenant}</div>
              {user?.role !== 'tenant_admin' && (
                <div className="text-xs text-muted-foreground">{currentSubAccount}</div>
              )}
            </div>
          </div>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem>
          <Building2 className="w-4 h-4 mr-2" />
          Global Education Partners
        </DropdownMenuItem>
        {user?.role !== 'tenant_admin' && (
          <>
            <DropdownMenuItem>
              NYC Branch
            </DropdownMenuItem>
            <DropdownMenuItem>
              LA Branch
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
