import { useState, useEffect, useCallback } from "react";
import { BarChart2, RefreshCw } from "lucide-react";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { subDays, format } from "date-fns";

export default function EmailStatistics() {
  const { activeAccount } = useAccount();
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 29), to: new Date() });

  const fetchStats = useCallback(async () => {
      if (!activeAccount?.apiKey || activeAccount.status !== 'connected') return;
      setLoading(true);
      try {
          const body: any = { apiKey: activeAccount.apiKey };
          if (dateRange?.from && dateRange?.to) {
              body.startDate = format(dateRange.from, "yyyy-MM-dd");
              body.endDate = format(dateRange.to, "yyyy-MM-dd");
          }
          const response = await fetch('/api/brevo/smtp-stats/aggregated', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          setStats(await response.json());
      } catch (error) { toast({ title: "Error", description: "Failed to load stats", variant: "destructive" }); }
      finally { setLoading(false); }
  }, [activeAccount, dateRange]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const StatCard = ({ title, value }: { title: string, value?: number }) => (
      <Card className="text-center">
          <CardHeader className="pb-2"><CardDescription>{title}</CardDescription></CardHeader>
          <CardContent>{loading ? <Skeleton className="h-8 w-16 mx-auto" /> : <p className="text-2xl font-bold">{value?.toLocaleString() ?? 0}</p>}</CardContent>
      </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2"><BarChart2 className="w-5 h-5 text-primary" /><h1 className="text-2xl font-semibold">Statistics</h1></div>
        <div className="flex gap-2"><DateRangePicker date={dateRange} onDateChange={setDateRange} /><Button variant="outline" size="icon" onClick={fetchStats}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button></div>
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          <StatCard title="Requests" value={stats?.requests} />
          <StatCard title="Delivered" value={stats?.delivered} />
          <StatCard title="Opens" value={stats?.opens} />
          <StatCard title="Clicks" value={stats?.clicks} />
          <StatCard title="Hard Bounces" value={stats?.hardBounces} />
          <StatCard title="Soft Bounces" value={stats?.softBounces} />
          <StatCard title="Blocked" value={stats?.blocked} />
          <StatCard title="Spam Reports" value={stats?.spamReports} />
      </div>
    </div>
  );
}