import { MainLayout } from "@/components/layout/main-layout";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { LeadsTable } from "@/components/dashboard/leads-table";

export default function Dashboard() {
  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <StatsCards />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RevenueChart />
          <RecentActivity />
        </div>

        <LeadsTable />
      </div>
    </MainLayout>
  );
}
