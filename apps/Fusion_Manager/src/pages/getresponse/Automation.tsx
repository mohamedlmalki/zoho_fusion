import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, RefreshCw, Loader2, TrendingUp, CheckCircle } from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import { Button } from '@/components/ui/button';

export const Automation: React.FC = () => {
    const { activeAccount } = useAccount();
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchWorkflows = async () => {
        if (!activeAccount) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/getresponse/workflows?accountId=${activeAccount.id}`);
            const data = await res.json();
            if (Array.isArray(data)) setWorkflows(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchWorkflows(); }, [activeAccount]);

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><Activity className="h-6 w-6 text-primary" /></div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Automations</h1>
                        <p className="text-sm text-muted-foreground">Workflow statistics for {activeAccount?.name}.</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={fetchWorkflows} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {workflows.map(wf => (
                        <Card key={wf.workflowId} className="shadow-sm border-t-4 border-t-primary">
                            <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
                                <CardTitle className="text-base font-semibold truncate">{wf.name}</CardTitle>
                                <Badge variant={wf.status === 'published' ? 'default' : 'secondary'}>{wf.status}</Badge>
                            </CardHeader>
                            <CardContent className="p-4">
                                <div className="grid grid-cols-2 gap-4">
                                    {/* --- CORRECTED DATA MAPPING --- */}
                                    <div className="bg-muted/30 p-3 rounded-md text-center">
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <TrendingUp className="w-3 h-3 text-blue-500" />
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase">In Progress</span>
                                        </div>
                                        <div className="text-xl font-bold">
                                            {wf.subscriberStatistics?.inProgressCount || 0}
                                        </div>
                                    </div>
                                    <div className="bg-muted/30 p-3 rounded-md text-center">
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <CheckCircle className="w-3 h-3 text-green-500" />
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase">Completed</span>
                                        </div>
                                        <div className="text-xl font-bold">
                                            {wf.subscriberStatistics?.completedCount || 0}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};