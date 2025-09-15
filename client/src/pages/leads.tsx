import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Lead, InsertLead } from "@shared/schema";

export default function Leads() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads", searchQuery],
  });

  const addLeadMutation = useMutation({
    mutationFn: async (leadData: Partial<InsertLead>) => {
      const res = await apiRequest("POST", "/api/leads", leadData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setIsAddDialogOpen(false);
      toast({
        title: "Lead added successfully",
        description: "The new lead has been added to your pipeline.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add lead",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Leads & Contacts</h1>
            <p className="text-muted-foreground">Manage your prospective students</p>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-lead">
                <Plus className="w-4 h-4 mr-2" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
                <DialogDescription>
                  Enter the details of the prospective student.
                </DialogDescription>
              </DialogHeader>
              <AddLeadForm onSubmit={addLeadMutation.mutate} isLoading={addLeadMutation.isPending} />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Leads</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search leads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 w-64"
                    data-testid="input-search-leads"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading leads...</div>
            ) : leads && leads.length > 0 ? (
              <div className="space-y-4">
                {leads.map((lead) => (
                  <div key={lead.id} className="border rounded-lg p-4 hover:bg-muted/25" data-testid={`lead-card-${lead.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{lead.firstName} {lead.lastName}</h3>
                        <p className="text-sm text-muted-foreground">{lead.email}</p>
                        {lead.programInterest && (
                          <p className="text-sm mt-1">Interest: {lead.programInterest}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-4">
                        <Badge variant="secondary">
                          {lead.status || 'new'}
                        </Badge>
                        {lead.score && (
                          <div className="text-sm">
                            Score: <span className="font-semibold">{lead.score}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No leads found. Add your first lead to get started!
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function AddLeadForm({ onSubmit, isLoading }: { onSubmit: (data: any) => void; isLoading: boolean }) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    programInterest: "",
    targetCountry: "",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            required
            data-testid="input-first-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
            required
            data-testid="input-last-name"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          required
          data-testid="input-email"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          data-testid="input-phone"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="programInterest">Program Interest</Label>
        <Input
          id="programInterest"
          placeholder="e.g., MBA, Computer Science MS"
          value={formData.programInterest}
          onChange={(e) => handleChange("programInterest", e.target.value)}
          data-testid="input-program-interest"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="targetCountry">Target Country</Label>
        <Input
          id="targetCountry"
          placeholder="e.g., United States, United Kingdom"
          value={formData.targetCountry}
          onChange={(e) => handleChange("targetCountry", e.target.value)}
          data-testid="input-target-country"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Additional notes about the lead..."
          value={formData.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          data-testid="textarea-notes"
        />
      </div>
      
      <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-lead">
        {isLoading ? "Adding Lead..." : "Add Lead"}
      </Button>
    </form>
  );
}
