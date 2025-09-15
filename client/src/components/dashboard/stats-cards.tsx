import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, FileText, CheckCircle, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStats {
  leads: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
  };
  applications: {
    total: number;
    draft: number;
    submitted: number;
    underReview: number;
    accepted: number;
    rejected: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    pending: number;
  };
}

export function StatsCards() {
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <div className="text-destructive text-sm">Failed to load stats</div>
          </Card>
        ))}
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="w-12 h-12 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const monthlyGrowth = stats.revenue.lastMonth > 0 
    ? Math.round(((stats.revenue.thisMonth - stats.revenue.lastMonth) / stats.revenue.lastMonth) * 100)
    : 0;

  const cards = [
    {
      title: "Total Leads",
      value: stats.leads.total.toLocaleString(),
      change: "+12% from last month",
      icon: Users,
      iconColor: "text-chart-1",
      iconBg: "bg-chart-1/10",
      testId: "stat-total-leads"
    },
    {
      title: "Active Applications",
      value: stats.applications.submitted + stats.applications.underReview,
      change: "+5% from last month",
      icon: FileText,
      iconColor: "text-chart-2",
      iconBg: "bg-chart-2/10",
      testId: "stat-active-applications"
    },
    {
      title: "Acceptances",
      value: stats.applications.accepted,
      change: "+18% from last month",
      icon: CheckCircle,
      iconColor: "text-chart-2",
      iconBg: "bg-chart-2/10",
      testId: "stat-acceptances"
    },
    {
      title: "Revenue",
      value: `$${stats.revenue.thisMonth.toLocaleString()}`,
      change: `${monthlyGrowth >= 0 ? '+' : ''}${monthlyGrowth}% from last month`,
      icon: DollarSign,
      iconColor: "text-chart-3",
      iconBg: "bg-chart-3/10",
      testId: "stat-revenue"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} data-testid={card.testId}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {card.value}
                  </p>
                  <p className="text-sm text-chart-2">{card.change}</p>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${card.iconBg}`}>
                  <Icon className={`w-6 h-6 ${card.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
