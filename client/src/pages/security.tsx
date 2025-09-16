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
import { Switch } from '@/components/ui/switch';
import { 
  Shield, 
  Key, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  lastUsed: string;
  createdAt: string;
  isActive: boolean;
}

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  result: 'success' | 'failure';
}

interface SecuritySetting {
  id: string;
  name: string;
  description: string;
  value: boolean;
  category: 'authentication' | 'authorization' | 'data' | 'network';
}

export default function SecurityPage() {
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState<{ [key: string]: boolean }>({});
  const [isCreateKeyDialogOpen, setIsCreateKeyDialogOpen] = useState(false);
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    permissions: ['read']
  });

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    try {
      const [apiKeysRes, auditLogsRes, settingsRes] = await Promise.all([
        fetch('/api/security/api-keys'),
        fetch('/api/security/audit-logs'),
        fetch('/api/security/settings')
      ]);

      if (apiKeysRes.ok) {
        const keysData = await apiKeysRes.json();
        setApiKeys(keysData);
      }

      if (auditLogsRes.ok) {
        const logsData = await auditLogsRes.json();
        setAuditLogs(logsData);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSecuritySettings(settingsData);
      }
    } catch (error) {
      console.error('Error fetching security data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async () => {
    try {
      const response = await fetch('/api/security/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKeyData)
      });

      if (response.ok) {
        const newKey = await response.json();
        setApiKeys([...apiKeys, newKey]);
        setIsCreateKeyDialogOpen(false);
        setNewKeyData({ name: '', permissions: ['read'] });
        toast({
          title: "API Key Created",
          description: "Your new API key has been created successfully.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create API key.",
        variant: "destructive",
      });
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;

    try {
      const response = await fetch(`/api/security/api-keys/${keyId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setApiKeys(apiKeys.filter(key => key.id !== keyId));
        toast({
          title: "API Key Revoked",
          description: "The API key has been revoked successfully.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to revoke API key.",
        variant: "destructive",
      });
    }
  };

  const handleToggleSetting = async (settingId: string, value: boolean) => {
    try {
      const response = await fetch(`/api/security/settings/${settingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });

      if (response.ok) {
        setSecuritySettings(settings.map(setting => 
          setting.id === settingId ? { ...setting, value } : setting
        ));
        toast({
          title: "Setting Updated",
          description: "Security setting has been updated.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update security setting.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard.",
    });
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowKey(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const getSecurityScore = () => {
    const enabledSettings = securitySettings.filter(s => s.value).length;
    const totalSettings = securitySettings.length;
    return Math.round((enabledSettings / totalSettings) * 100);
  };

  const getSecurityStatus = (score: number) => {
    if (score >= 80) return { color: 'text-green-600', icon: CheckCircle, text: 'Excellent' };
    if (score >= 60) return { color: 'text-yellow-600', icon: AlertTriangle, text: 'Good' };
    return { color: 'text-red-600', icon: XCircle, text: 'Needs Improvement' };
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div>Loading security settings...</div>
        </div>
      </MainLayout>
    );
  }

  const securityScore = getSecurityScore();
  const securityStatus = getSecurityStatus(securityScore);
  const StatusIcon = securityStatus.icon;

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Security Settings</h1>
            <p className="text-muted-foreground">Manage your organization's security configuration</p>
          </div>
        </div>

        {/* Security Score Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>Security Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-3xl font-bold">{securityScore}%</div>
                <div>
                  <div className={`flex items-center space-x-1 ${securityStatus.color}`}>
                    <StatusIcon className="w-4 h-4" />
                    <span className="font-medium">{securityStatus.text}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {securitySettings.filter(s => s.value).length} of {securitySettings.length} settings enabled
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={fetchSecurityData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="settings">Security Settings</TabsTrigger>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <div className="grid gap-6">
              {['authentication', 'authorization', 'data', 'network'].map(category => (
                <Card key={category}>
                  <CardHeader>
                    <CardTitle className="capitalize">{category} Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {securitySettings
                      .filter(setting => setting.category === category)
                      .map(setting => (
                        <div key={setting.id} className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="font-medium">{setting.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {setting.description}
                            </div>
                          </div>
                          <Switch
                            checked={setting.value}
                            onCheckedChange={(checked) => handleToggleSetting(setting.id, checked)}
                          />
                        </div>
                      ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="api-keys">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>API Keys</CardTitle>
                  <Dialog open={isCreateKeyDialogOpen} onOpenChange={setIsCreateKeyDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Key className="w-4 h-4 mr-2" />
                        Create API Key
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New API Key</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="key-name">Key Name</Label>
                          <Input
                            id="key-name"
                            value={newKeyData.name}
                            onChange={(e) => setNewKeyData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Integration Key, Mobile App Key"
                          />
                        </div>
                        <div>
                          <Label>Permissions</Label>
                          <div className="space-y-2 mt-2">
                            {['read', 'write', 'admin'].map(permission => (
                              <div key={permission} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`permission-${permission}`}
                                  checked={newKeyData.permissions.includes(permission)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNewKeyData(prev => ({
                                        ...prev,
                                        permissions: [...prev.permissions, permission]
                                      }));
                                    } else {
                                      setNewKeyData(prev => ({
                                        ...prev,
                                        permissions: prev.permissions.filter(p => p !== permission)
                                      }));
                                    }
                                  }}
                                />
                                <Label htmlFor={`permission-${permission}`} className="capitalize">
                                  {permission}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" onClick={() => setIsCreateKeyDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleCreateApiKey}>
                            Create Key
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((apiKey) => (
                      <TableRow key={apiKey.id}>
                        <TableCell className="font-medium">{apiKey.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                              {showKey[apiKey.id] ? apiKey.key : apiKey.key.slice(0, 8) + '...'}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleKeyVisibility(apiKey.id)}
                            >
                              {showKey[apiKey.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(apiKey.key)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {apiKey.permissions.map(permission => (
                              <Badge key={permission} variant="outline" className="text-xs">
                                {permission}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {apiKey.lastUsed ? new Date(apiKey.lastUsed).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={apiKey.isActive ? 'default' : 'secondary'}>
                            {apiKey.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeKey(apiKey.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit-logs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Audit Logs</CardTitle>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Filter className="w-4 h-4 mr-2" />
                      Filter
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.slice(0, 50).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>{log.userName}</TableCell>
                        <TableCell className="font-mono text-sm">{log.action}</TableCell>
                        <TableCell>{log.resource}</TableCell>
                        <TableCell className="font-mono text-sm">{log.ipAddress}</TableCell>
                        <TableCell>
                          <Badge variant={log.result === 'success' ? 'default' : 'destructive'}>
                            {log.result}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Compliance Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { name: 'GDPR', status: 'compliant', description: 'General Data Protection Regulation' },
                      { name: 'CCPA', status: 'compliant', description: 'California Consumer Privacy Act' },
                      { name: 'SOC 2', status: 'in-progress', description: 'Service Organization Control 2' },
                      { name: 'ISO 27001', status: 'not-compliant', description: 'Information Security Management' }
                    ].map(compliance => (
                      <div key={compliance.name} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium">{compliance.name}</div>
                          <div className="text-sm text-muted-foreground">{compliance.description}</div>
                        </div>
                        <Badge variant={
                          compliance.status === 'compliant' ? 'default' :
                          compliance.status === 'in-progress' ? 'secondary' : 'destructive'
                        }>
                          {compliance.status.replace('-', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Security Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { priority: 'high', title: 'Enable Two-Factor Authentication', description: 'Add an extra layer of security to user accounts' },
                      { priority: 'medium', title: 'Review API Key Permissions', description: 'Ensure API keys have minimal required permissions' },
                      { priority: 'low', title: 'Update Security Policies', description: 'Review and update security documentation' }
                    ].map(rec => (
                      <div key={rec.title} className="flex items-start space-x-3 p-3 border rounded-lg">
                        <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
                          {rec.priority}
                        </Badge>
                        <div className="flex-1">
                          <div className="font-medium">{rec.title}</div>
                          <div className="text-sm text-muted-foreground">{rec.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}