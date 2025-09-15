import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Plus } from "lucide-react";
import type { Application } from "@shared/schema";

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-chart-3/10 text-chart-3",
  under_review: "bg-chart-1/10 text-chart-1",
  accepted: "bg-chart-2/10 text-chart-2",
  rejected: "bg-destructive/10 text-destructive",
  withdrawn: "bg-muted text-muted-foreground",
};

export default function Applications() {
  const { data: applications, isLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Applications</h1>
            <p className="text-muted-foreground">Track student applications</p>
          </div>
          
          <Button data-testid="button-add-application">
            <Plus className="w-4 h-4 mr-2" />
            New Application
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Applications</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search applications..."
                    className="pl-10 pr-4 w-64"
                    data-testid="input-search-applications"
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
              <div className="text-center py-8">Loading applications...</div>
            ) : applications && applications.length > 0 ? (
              <div className="space-y-4">
                {applications.map((application) => (
                  <div key={application.id} className="border rounded-lg p-4 hover:bg-muted/25" data-testid={`application-card-${application.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">Application #{application.id.slice(-8)}</h3>
                        <p className="text-sm text-muted-foreground">
                          Program: {application.programId}
                        </p>
                        {application.submittedAt && (
                          <p className="text-sm text-muted-foreground">
                            Submitted: {new Date(application.submittedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-4">
                        <Badge 
                          variant="secondary" 
                          className={statusColors[application.status || 'draft']}
                        >
                          {application.status?.replace('_', ' ') || 'draft'}
                        </Badge>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No applications found. Create your first application to get started!
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
