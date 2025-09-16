import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Building2, Plus, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Tenant {
  id: string;
  name: string;
  domain?: string;
  branding?: {
    logo?: string;
    colors?: { primary: string; secondary: string };
  };
}

interface SubAccount {
  id: string;
  name: string;
  tenantId: string;
  isActive: boolean;
}

// API functions
const fetchTenants = async (): Promise<Tenant[]> => {
  // Mock data - in production this would fetch from API
  return [
    {
      id: "1",
      name: "Global Education Partners",
      domain: "globaledu.com",
      branding: {
        logo: "",
        colors: { primary: "#3b82f6", secondary: "#1e40af" }
      }
    },
    {
      id: "2", 
      name: "International Student Services",
      domain: "intstudents.com",
      branding: {
        logo: "",
        colors: { primary: "#10b981", secondary: "#047857" }
      }
    }
  ];
};

const fetchSubAccounts = async (tenantId: string): Promise<SubAccount[]> => {
  // Mock data - in production this would fetch from API
  return [
    { id: "1", name: "NYC Branch", tenantId: "1", isActive: true },
    { id: "2", name: "LA Branch", tenantId: "1", isActive: true },
    { id: "3", name: "Chicago Office", tenantId: "1", isActive: true },
    { id: "4", name: "London Branch", tenantId: "2", isActive: true },
    { id: "5", name: "Manchester Office", tenantId: "2", isActive: true }
  ];
};

export function TenantSwitcher() {
  const { user } = useAuth();
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [currentSubAccount, setCurrentSubAccount] = useState<SubAccount | null>(null);
  
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: fetchTenants
  });

  const { data: subAccounts = [] } = useQuery({
    queryKey: ['subAccounts', currentTenant?.id],
    queryFn: () => currentTenant ? fetchSubAccounts(currentTenant.id) : Promise.resolve([])
  });

  useEffect(() => {
    // Initialize with first tenant and sub-account
    if (tenants.length > 0 && !currentTenant) {
      setCurrentTenant(tenants[0]);
    }
    
    if (subAccounts.length > 0 && !currentSubAccount) {
      setCurrentSubAccount(subAccounts[0]);
    }
  }, [tenants, subAccounts, currentTenant, currentSubAccount]);

  const handleTenantChange = (tenant: Tenant) => {
    setCurrentTenant(tenant);
    setCurrentSubAccount(null); // Reset sub-account when tenant changes
    // In production, this would make an API call to switch tenant context
  };

  const handleSubAccountChange = (subAccount: SubAccount) => {
    setCurrentSubAccount(subAccount);
    // In production, this would make an API call to switch sub-account context
  };

  const getTenantInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!currentTenant) {
    return (
      <Button variant="outline" disabled>
        <Building2 className="w-4 h-4 mr-2" />
        Loading...
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full justify-between text-left bg-muted hover:bg-accent"
          data-testid="tenant-switcher"
        >
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-bold"
                 style={{ backgroundColor: currentTenant.branding?.colors?.primary || '#3b82f6' }}>
              {getTenantInitials(currentTenant.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{currentTenant.name}</div>
              {user?.role !== 'tenant_admin' && currentSubAccount && (
                <div className="text-xs text-muted-foreground truncate">{currentSubAccount.name}</div>
              )}
            </div>
          </div>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="start">
        {/* Tenant Selection */}
        <div className="p-2">
          <div className="text-xs font-medium text-muted-foreground mb-2">Organizations</div>
          {tenants.map((tenant) => (
            <DropdownMenuItem
              key={tenant.id}
              onClick={() => handleTenantChange(tenant)}
              className={`flex items-center space-x-2 ${currentTenant.id === tenant.id ? 'bg-accent' : ''}`}
            >
              <div className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                   style={{ backgroundColor: tenant.branding?.colors?.primary || '#3b82f6' }}>
                {getTenantInitials(tenant.name)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{tenant.name}</div>
                <div className="text-xs text-muted-foreground">{tenant.domain}</div>
              </div>
              {currentTenant.id === tenant.id && (
                <div className="w-2 h-2 bg-primary rounded-full"></div>
              )}
            </DropdownMenuItem>
          ))}
        </div>

        {user?.role !== 'tenant_admin' && subAccounts.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {/* Sub-Account Selection */}
            <div className="p-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-muted-foreground">Locations</div>
                <Button variant="ghost" size="sm" className="h-6 text-xs">
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
              {subAccounts
                .filter(sa => sa.tenantId === currentTenant.id)
                .map((subAccount) => (
                <DropdownMenuItem
                  key={subAccount.id}
                  onClick={() => handleSubAccountChange(subAccount)}
                  className={`flex items-center space-x-2 ${currentSubAccount?.id === subAccount.id ? 'bg-accent' : ''}`}
                >
                  <Building2 className="w-4 h-4" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{subAccount.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {subAccount.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  {currentSubAccount?.id === subAccount.id && (
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                  )}
                </DropdownMenuItem>
              ))}
            </div>
          </>
        )}

        <DropdownMenuSeparator />
        
        {/* Management Actions */}
        {user?.role === 'tenant_admin' && (
          <div className="p-2">
            <DropdownMenuItem className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Organization Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Add New Location</span>
            </DropdownMenuItem>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
