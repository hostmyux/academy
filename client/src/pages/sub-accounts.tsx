import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Building2, 
  Settings,
  UserPlus,
  UserMinus
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface SubAccount {
  id: string;
  name: string;
  description: string;
  settings: any;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  subAccountId?: string;
}

export default function SubAccountsPage() {
  const { user } = useAuth();
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubAccount, setSelectedSubAccount] = useState<SubAccount | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    settings: {}
  });

  useEffect(() => {
    fetchSubAccounts();
    fetchUsers();
  }, []);

  const fetchSubAccounts = async () => {
    try {
      const response = await fetch('/api/sub-accounts');
      if (response.ok) {
        const data = await response.json();
        setSubAccounts(data);
      }
    } catch (error) {
      console.error('Error fetching sub-accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreateSubAccount = async () => {
    try {
      const response = await fetch('/api/sub-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchSubAccounts();
        setIsCreateDialogOpen(false);
        setFormData({ name: '', description: '', settings: {} });
      }
    } catch (error) {
      console.error('Error creating sub-account:', error);
    }
  };

  const handleUpdateSubAccount = async () => {
    if (!selectedSubAccount) return;

    try {
      const response = await fetch(`/api/sub-accounts/${selectedSubAccount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchSubAccounts();
        setIsEditDialogOpen(false);
        setSelectedSubAccount(null);
      }
    } catch (error) {
      console.error('Error updating sub-account:', error);
    }
  };

  const handleDeleteSubAccount = async (subAccountId: string) => {
    if (!confirm('Are you sure you want to delete this sub-account?')) return;

    try {
      const response = await fetch(`/api/sub-accounts/${subAccountId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchSubAccounts();
      }
    } catch (error) {
      console.error('Error deleting sub-account:', error);
    }
  };

  const handleAssignUser = async (userId: string, subAccountId: string) => {
    try {
      const response = await fetch(`/api/sub-accounts/${subAccountId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: 'agent' })
      });

      if (response.ok) {
        await fetchUsers();
        await fetchSubAccounts();
      }
    } catch (error) {
      console.error('Error assigning user:', error);
    }
  };

  const handleRemoveUser = async (userId: string, subAccountId: string) => {
    if (!confirm('Are you sure you want to remove this user from the sub-account?')) return;

    try {
      const response = await fetch(`/api/sub-accounts/${subAccountId}/users/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchUsers();
        await fetchSubAccounts();
      }
    } catch (error) {
      console.error('Error removing user:', error);
    }
  };

  const getUsersInSubAccount = (subAccountId: string) => {
    return users.filter(user => user.subAccountId === subAccountId);
  };

  const getAvailableUsers = () => {
    return users.filter(user => !user.subAccountId && user.role !== 'tenant_admin');
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div>Loading...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sub-Accounts</h1>
            <p className="text-muted-foreground">Manage your organization's branches and departments</p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-sub-account">
                <Plus className="w-4 h-4 mr-2" />
                Create Sub-Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Sub-Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Sub-Account Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., NYC Branch, London Office"
                    data-testid="input-sub-account-name"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this sub-account"
                    data-testid="textarea-sub-account-description"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateSubAccount} data-testid="button-confirm-create">
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="sub-accounts" className="space-y-6">
          <TabsList>
            <TabsTrigger value="sub-accounts">Sub-Accounts</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
          </TabsList>

          <TabsContent value="sub-accounts">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subAccounts.map((subAccount) => (
                <Card key={subAccount.id} data-testid={`sub-account-${subAccount.id}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-5 h-5" />
                        <span className="truncate">{subAccount.name}</span>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSubAccount(subAccount);
                            setFormData({
                              name: subAccount.name,
                              description: subAccount.description,
                              settings: subAccount.settings
                            });
                            setIsEditDialogOpen(true);
                          }}
                          data-testid={`button-edit-${subAccount.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSubAccount(subAccount.id)}
                          data-testid={`button-delete-${subAccount.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {subAccount.description || 'No description provided'}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">
                            {getUsersInSubAccount(subAccount.id).length} users
                          </span>
                        </div>
                        <Badge variant="secondary">Active</Badge>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(subAccount.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Sub-Account</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const userSubAccount = subAccounts.find(sa => sa.id === user.subAccountId);
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                                <span className="text-primary-foreground text-sm font-medium">
                                  {user.firstName?.[0]}{user.lastName?.[0]}
                                </span>
                              </div>
                              <span>
                            {user.firstName} {user.lastName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role?.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>
                        {userSubAccount ? (
                          <Badge variant="secondary">{userSubAccount.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {userSubAccount ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveUser(user.id, userSubAccount.id)}
                              data-testid={`button-remove-user-${user.id}`}
                            >
                              <UserMinus className="w-4 h-4" />
                            </Button>
                          ) : (
                            subAccounts.map((subAccount) => (
                              <Button
                                key={subAccount.id}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAssignUser(user.id, subAccount.id)}
                                data-testid={`button-assign-user-${user.id}-to-${subAccount.id}`}
                              >
                                <UserPlus className="w-4 h-4" />
                              </Button>
                            ))
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Sub-Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Sub-Account Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-edit-sub-account-name"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  data-testid="textarea-edit-sub-account-description"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateSubAccount} data-testid="button-confirm-update">
                  Update
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}