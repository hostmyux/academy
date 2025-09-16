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
import { ChevronDown, Building2, Plus, Settings, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface Tenant {
  id: string;
  name: string;
  domain?: string;
  branding?: {
    logo?: string;
    colors?: { primary: string; secondary: string };
    theme?: 'light' | 'dark';
  };
  settings?: {
    allowSubAccounts: boolean;
    maxSubAccounts: number;
  };
}

interface SubAccount {
  id: string;
  name: string;
  tenantId: string;
  isActive: boolean;
  branding?: {
    logo?: string;
    colors?: { primary: string; secondary: string };
  };
}

// API functions
const fetchTenants = async (): Promise<Tenant[]> => {
  const response = await fetch('/api/tenants');
  if (!response.ok) throw new Error('Failed to fetch tenants');
  return response.json();
};

const fetchSubAccounts = async (tenantId: string): Promise<SubAccount[]> => {
  const response = await fetch(`/api/sub-accounts?tenantId=${tenantId}`);
  if (!response.ok) throw new Error('Failed to fetch sub-accounts');
  return response.json();
};

const switchTenant = async (tenantId: string, subAccountId?: string) => {
  const response = await fetch('/api/auth/switch-tenant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, subAccountId })
  });
  if (!response.ok) throw new Error('Failed to switch tenant');
  return response.json();
};

export function TenantSwitcher() {
  const { user, updateUser } = useAuth();
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [currentSubAccount, setCurrentSubAccount] = useState<SubAccount | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: fetchTenants,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: subAccounts = [], isLoading: subAccountsLoading } = useQuery({
    queryKey: ['subAccounts', currentTenant?.id],
    queryFn: () => currentTenant ? fetchSubAccounts(currentTenant.id) : Promise.resolve([]),
    enabled: !!currentTenant,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const switchTenantMutation = useMutation({
    mutationFn: switchTenant,
    onSuccess: (data) => {
      updateUser(data.user);
      toast({
        title: "Switched successfully",
        description: `Switched to ${currentTenant?.name}`,
      });
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
    onError: (error) => {
      toast({
        title: "Switch failed",
        description: "Failed to switch tenant. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSwitching(false);
    }
  });

  // Apply branding to the document
  useEffect(() => {
    if (currentTenant?.branding) {
      const root = document.documentElement;
      const branding = currentTenant.branding;
      
      if (branding.colors) {
        root.style.setProperty('--tenant-primary', branding.colors.primary);
        root.style.setProperty('--tenant-secondary', branding.colors.secondary);
      }
      
      if (branding.theme) {
        root.setAttribute('data-theme', branding.theme);
      }
      
      // Apply favicon if available
      if (branding.logo) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) link.href = branding.logo;
      }
    }
  }, [currentTenant]);

  useEffect(() => {
    // Initialize with user's current tenant and sub-account
    if (user && tenants.length > 0) {
      const userTenant = tenants.find(t => t.id === user.tenantId);
      if (userTenant) {
        setCurrentTenant(userTenant);
      }
    }
  }, [user, tenants]);

  useEffect(() => {
    // Set current sub-account
    if (user?.subAccountId && subAccounts.length > 0) {
      const userSubAccount = subAccounts.find(sa => sa.id === user.subAccountId);
      if (userSubAccount) {
        setCurrentSubAccount(userSubAccount);
      }
    } else if (subAccounts.length > 0 && !currentSubAccount) {
      setCurrentSubAccount(subAccounts[0]);
    }
  }, [subAccounts, user, currentSubAccount]);

  const handleTenantChange = async (tenant: Tenant) => {
    if (tenant.id === currentTenant?.id) return;
    
    setIsSwitching(true);
    setCurrentTenant(tenant);
    setCurrentSubAccount(null); // Reset sub-account when tenant changes
    
    try {
      await switchTenantMutation.mutateAsync(tenant.id);
    } catch (error) {
      // Revert on error
      if (currentTenant) {
        setCurrentTenant(currentTenant);
      }
    }
  };

  const handleSubAccountChange = async (subAccount: SubAccount) => {
    if (subAccount.id === currentSubAccount?.id) return;
    
    setIsSwitching(true);
    setCurrentSubAccount(subAccount);
    
    try {
      await switchTenantMutation.mutateAsync(currentTenant!.id, subAccount.id);
    } catch (error) {
      // Revert on error
      if (currentSubAccount) {
        setCurrentSubAccount(currentSubAccount);
      }
    }
  };

  const getTenantInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (tenantsLoading || !currentTenant) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
          disabled={isSwitching}
        >
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-bold"
                 style={{ backgroundColor: currentTenant.branding?.colors?.primary || '#3b82f6' }}>
              {currentTenant.branding?.logo ? (
                <img 
                  src={currentTenant.branding.logo} 
                  alt={currentTenant.name}
                  className="w-6 h-6 rounded object-cover"
                />
              ) : (
                getTenantInitials(currentTenant.name)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{currentTenant.name}</div>
              {user?.role !== 'tenant_admin' && currentSubAccount && (
                <div className="text-xs text-muted-foreground truncate">{currentSubAccount.name}</div>
              )}
            </div>
            {isSwitching && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>
          {!isSwitching && <ChevronDown className="w-4 h-4" />}
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
              disabled={isSwitching}
              className={`flex items-center space-x-2 ${currentTenant.id === tenant.id ? 'bg-accent' : ''}`}
            >
              <div className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                   style={{ backgroundColor: tenant.branding?.colors?.primary || '#3b82f6' }}>
                {tenant.branding?.logo ? (
                  <img 
                    src={tenant.branding.logo} 
                    alt={tenant.name}
                    className="w-4 h-4 rounded object-cover"
                  />
                ) : (
                  getTenantInitials(tenant.name)
                )}
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
                {subAccountsLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Button variant="ghost" size="sm" className="h-6 text-xs">
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                )}
              </div>
              {subAccounts
                .filter(sa => sa.tenantId === currentTenant.id)
                .map((subAccount) => (
                <DropdownMenuItem
                  key={subAccount.id}
                  onClick={() => handleSubAccountChange(subAccount)}
                  disabled={isSwitching}
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
