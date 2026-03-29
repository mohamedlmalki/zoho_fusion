import { useState, useEffect, useCallback } from "react";
import { Workflow, TrendingUp, CheckCircle, Mail, MousePointerClick, BarChart, Users, AlertCircle, UserX, Download, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Automation {
    id: number;
    name: string;
    status: number;
}

interface AutomationStats {
    started: number;
    finished: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    unsubscribed: number;
    spam: number;
    send_error: number;
}

const StatCard = ({ title, value, icon, color, onClick }: { title: string; value: number; icon: React.ReactNode; color: string; onClick?: () => void }) => (
    <Card 
        className={cn("transition-all duration-200", onClick && "cursor-pointer hover:border-primary/50 hover:shadow-md")}
        onClick={onClick}
    >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
            <div className={cn("p-1.5 rounded-md bg-muted/50", color)}>{icon}</div>
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold tracking-tight">{value.toLocaleString()}</div>
        </CardContent>
    </Card>
);

export default function SendpulseAutomation() {
    const { activeAccount } = useAccount();
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [selectedId, setSelectedId] = useState<string>("");
    const [stats, setStats] = useState<AutomationStats | null>(null);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalFilter, setModalFilter] = useState("all");
    const [modalData, setModalData] = useState<any[]>([]);
    const [isModalLoading, setIsModalLoading] = useState(false);

    useEffect(() => {
        if (activeAccount?.provider === 'sendpulse') fetchAutomations();
    }, [activeAccount]);

    useEffect(() => {
        if (selectedId) fetchStats();
    }, [selectedId]);

    const fetchAutomations = async () => {
        try {
            const res = await fetch('/api/sendpulse/automations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: activeAccount?.apiKey, secretId: activeAccount?.apiUrl })
            });
            const data = await res.json();
            if (Array.isArray(data)) setAutomations(data);
        } catch (e) {
            toast({ title: "Error", description: "Failed to load automation list.", variant: "destructive" });
        }
    };

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/sendpulse/automations/${selectedId}/statistics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: activeAccount?.apiKey, secretId: activeAccount?.apiUrl })
            });
            const data = await res.json();
            setStats(data);
        } catch (e) {
            toast({ title: "Error", description: "Failed to load statistics.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const openSubscriberModal = async (filter: string) => {
        setModalFilter(filter);
        setIsModalOpen(true);
        setIsModalLoading(true);
        try {
            const res = await fetch('/api/sendpulse/automations/action-subscribers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    clientId: activeAccount?.apiKey, 
                    secretId: activeAccount?.apiUrl, 
                    automationId: selectedId, 
                    filterType: filter 
                })
            });
            const data = await res.json();
            setModalData(data || []);
        } catch (e) {
            toast({ title: "Error", description: "Failed to load subscribers.", variant: "destructive" });
        } finally {
            setIsModalLoading(false);
        }
    };

    const handleExport = () => {
        if (modalData.length === 0) return;
        const csv = modalData.map(sub => sub.email).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `automation_${selectedId}_${modalFilter}.csv`;
        a.click();
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6 h-[calc(100vh-60px)] flex flex-col animate-in fade-in duration-500">
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><Workflow className="h-6 w-6 text-primary" /></div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Automations (A360)</h1>
                        <p className="text-sm text-muted-foreground">Monitor flow performance and export targeted audiences.</p>
                    </div>
                </div>
                <Select value={selectedId} onValueChange={setSelectedId} disabled={loading}>
                    <SelectTrigger className="w-[300px] h-10">
                        <SelectValue placeholder="Select an Automation Flow" />
                    </SelectTrigger>
                    <SelectContent>
                        {automations.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {stats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                    <StatCard title="Total Started" value={stats.started} icon={<Users className="h-4 w-4" />} color="text-blue-600" onClick={() => openSubscriberModal('all')} />
                    <StatCard title="Delivered" value={stats.delivered} icon={<CheckCircle className="h-4 w-4" />} color="text-green-600" onClick={() => openSubscriberModal('delivered_not_read')} />
                    <StatCard title="Opened" value={stats.opened} icon={<Mail className="h-4 w-4" />} color="text-purple-600" onClick={() => openSubscriberModal('opened')} />
                    <StatCard title="Clicked" value={stats.clicked} icon={<MousePointerClick className="h-4 w-4" />} color="text-orange-600" onClick={() => openSubscriberModal('clicked')} />
                    <StatCard title="Unsubscribed" value={stats.unsubscribed} icon={<UserX className="h-4 w-4" />} color="text-slate-600" />
                    <StatCard title="Marked Spam" value={stats.spam} icon={<AlertCircle className="h-4 w-4" />} color="text-red-500" onClick={() => openSubscriberModal('spam_by_user')} />
                    <StatCard title="Send Errors" value={stats.send_error} icon={<BarChart className="h-4 w-4" />} color="text-red-600" onClick={() => openSubscriberModal('errors')} />
                    <StatCard title="Flow Finished" value={stats.finished} icon={<TrendingUp className="h-4 w-4" />} color="text-indigo-600" />
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl opacity-50">
                    <Workflow className="h-12 w-12 mb-4" />
                    <p className="text-lg font-medium">Select an automation flow to view statistics</p>
                </div>
            )}

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <div className="flex items-center justify-between pr-6">
                            <div>
                                <DialogTitle className="flex items-center gap-2 uppercase tracking-tighter">
                                    <Users className="h-5 w-5 text-primary" /> {modalFilter.replace(/_/g, ' ')} Subscribers
                                </DialogTitle>
                                <DialogDescription>Viewing subscribers matching the selected status.</DialogDescription>
                            </div>
                            {modalData.length > 0 && (
                                <Button size="sm" onClick={handleExport} className="h-8">
                                    <Download className="h-3.5 w-3.5 mr-2" /> Export CSV
                                </Button>
                            )}
                        </div>
                    </DialogHeader>
                    
                    <ScrollArea className="h-[400px] w-full border rounded-md p-0 mt-4 bg-muted/20">
                        {isModalLoading ? (
                            <div className="flex flex-col items-center justify-center h-full space-y-2">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="text-xs text-muted-foreground">Fetching data from SendPulse...</span>
                            </div>
                        ) : modalData.length > 0 ? (
                            <div className="divide-y">
                                {modalData.map((sub, i) => (
                                    <div key={i} className="px-4 py-2 text-sm font-mono flex justify-between items-center bg-background hover:bg-muted/50 transition-colors">
                                        {sub.email}
                                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground">Subscriber</Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full opacity-50">
                                <UserX className="h-8 w-8 mb-2" />
                                <span className="text-sm">No subscribers found for this filter.</span>
                            </div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}