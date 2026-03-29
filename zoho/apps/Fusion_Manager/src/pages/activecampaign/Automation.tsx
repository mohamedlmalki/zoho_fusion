import { useState, useEffect } from "react";
import { Workflow, BarChart2 } from "lucide-react";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Automation {
  workflowId: string;
  name: string;
  status: string;
}

interface SubscriberStatistics {
  totalEntrants: number;
  inProgressCount: number;
  completedCount: number;
}

const StatCard = ({ title, value, isLoading }: { title: string; value: number | string; isLoading: boolean }) => (
    <div className="text-center p-4 border rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground">{title}</p>
        {isLoading ? (
            <Skeleton className="h-8 w-16 mx-auto mt-1" />
        ) : (
            <p className="text-2xl font-bold">{value}</p>
        )}
    </div>
);

export default function Automation() {
  const { activeAccount } = useAccount();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [selectedAutomation, setSelectedAutomation] = useState<string | null>(null);
  const [stats, setStats] = useState<SubscriberStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    const fetchAutomations = async () => {
      if (activeAccount) {
        setLoading(true);
        setStats(null);
        setSelectedAutomation(null);
        try {
          const response = await fetch('/api/activecampaign/automations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: activeAccount.apiKey, apiUrl: activeAccount.apiUrl }),
          });
          if (!response.ok) throw new Error('Failed to fetch automations');
          const data = await response.json();
          setAutomations(data);
        } catch (error) {
          toast({ title: "Error", description: "Could not fetch automations.", variant: "destructive" });
        } finally {
          setLoading(false);
        }
      }
    };
    fetchAutomations();
  }, [activeAccount]);

  const fetchStatistics = async () => {
    if (!activeAccount || !selectedAutomation) return;
    setLoadingStats(true);
    try {
      const response = await fetch(`/api/activecampaign/automations/${selectedAutomation}/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: activeAccount.apiKey, apiUrl: activeAccount.apiUrl }),
      });
      if (!response.ok) throw new Error('Failed to fetch statistics');
      const data = await response.json();
      setStats(data.subscriberStatistics);
    } catch (error) {
      toast({ title: "Error", description: "Could not fetch statistics.", variant: "destructive" });
    } finally {
      setLoadingStats(false);
    }
  };
  
  const selectedAutomationName = automations.find(a => a.workflowId === selectedAutomation)?.name;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Workflow className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Automation Reports</h1>
          <p className="text-muted-foreground">View statistics for your automations.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select an Automation</CardTitle>
          <CardDescription>Choose a workflow to see its performance report.</CardDescription>
          <div className="pt-4 flex flex-col md:flex-row gap-4">
             <Select onValueChange={setSelectedAutomation} disabled={!activeAccount || loading} value={selectedAutomation ?? ""}>
                <SelectTrigger className="w-full md:w-auto md:min-w-80">
                    <SelectValue placeholder="Select an automation..." />
                </SelectTrigger>
                <SelectContent>
                    {automations.map(auto => (
                        <SelectItem key={auto.workflowId} value={auto.workflowId}>{auto.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button onClick={fetchStatistics} disabled={!selectedAutomation || loadingStats}>
                <BarChart2 className={cn("h-4 w-4 mr-2", loadingStats && "animate-spin")} />
                Fetch Statistics
            </Button>
          </div>
        </CardHeader>
        <CardContent>
            {selectedAutomation && (
                <div>
                    <h3 className="text-lg font-semibold mb-4">Report for: <span className="text-primary">{selectedAutomationName}</span></h3>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard title="Total Entrants" value={stats?.totalEntrants ?? '...'} isLoading={loadingStats} />
                        <StatCard title="In Progress" value={stats?.inProgressCount ?? '...'} isLoading={loadingStats} />
                        <StatCard title="Completed" value={stats?.completedCount ?? '...'} isLoading={loadingStats} />
                    </div>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}