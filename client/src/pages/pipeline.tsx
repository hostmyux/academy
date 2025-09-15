import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings } from "lucide-react";

export default function Pipeline() {
  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pipeline</h1>
            <p className="text-muted-foreground">Manage your sales pipeline</p>
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" data-testid="button-pipeline-settings">
              <Settings className="w-4 h-4 mr-2" />
              Configure Pipeline
            </Button>
            <Button data-testid="button-add-stage">
              <Plus className="w-4 h-4 mr-2" />
              Add Stage
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {['New Leads', 'Qualified', 'Proposal Sent', 'Closed Won'].map((stage, index) => (
            <Card key={stage} data-testid={`pipeline-stage-${index}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  {stage}
                  <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-xs">
                    0
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No items in this stage
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
