import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

export function RevenueChart() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Revenue Trends</CardTitle>
          <div className="flex space-x-2">
            <Button variant="default" size="sm">7D</Button>
            <Button variant="outline" size="sm">30D</Button>
            <Button variant="outline" size="sm">90D</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-center justify-center bg-muted rounded-md" data-testid="revenue-chart-placeholder">
          <div className="text-center text-muted-foreground">
            <TrendingUp className="w-12 h-12 mx-auto mb-2" />
            <p className="font-medium">Revenue Chart</p>
            <p className="text-sm">Chart visualization will be implemented here</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
