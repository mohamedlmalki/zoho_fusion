import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Activity, FileJson, Info } from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import { useTrackEvents } from '@/contexts/TrackEventContext';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export const TrackEvent: React.FC = () => {
    const { activeAccount } = useAccount();
    const { getJob, updateJobData, startJob } = useTrackEvents();
    const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
    const [viewDetails, setViewDetails] = useState<any | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const job = activeAccount ? getJob(activeAccount.id) : null;
    const isWorking = job?.status === 'processing';

    useEffect(() => {
        if (activeAccount?.defaultEvent && job && !job.eventName) {
            updateJobData(activeAccount.id, { eventName: activeAccount.defaultEvent });
        }
    }, [activeAccount?.id, job?.id]);

    const filteredResults = useMemo(() => {
        if (!job) return [];
        if (filter === 'all') return job.results;
        return job.results.filter(r => r.status === filter);
    }, [job, filter]);

    // --- RECIPIENT COUNTER LOGIC ---
    const recipientCount = useMemo(() => {
        if (!job?.emailList) return 0;
        return job.emailList.split('\n').map(e => e.trim()).filter(e => e.length > 0).length;
    }, [job?.emailList]);

    if (!activeAccount || !job) return null;
    const progressPercent = job.progress.total > 0 ? (job.progress.current / job.progress.total) * 100 : 0;

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 h-[calc(100vh-60px)] flex flex-col">
            <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="p-2 bg-primary/10 rounded-lg"><Activity className="h-6 w-6 text-primary" /></div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Event Tracking</h1>
                    <p className="text-sm text-muted-foreground">Trigger automated events for your Plunk contacts.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                <Card className="flex flex-col h-full overflow-hidden">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                        <CardTitle className="text-base font-semibold">Event Config</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
                        
                        <div className="grid grid-cols-2 gap-4 shrink-0">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase text-muted-foreground font-bold">Event Name</Label>
                                <Input 
                                    placeholder="product_purchased" 
                                    value={job.eventName} 
                                    onChange={e => updateJobData(activeAccount.id, { eventName: e.target.value })} 
                                    disabled={isWorking} 
                                    className="h-8 text-sm" 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase text-muted-foreground font-bold" title="0 = Infinite">Stop Fails</Label>
                                <Input 
                                    type="number" min="0"
                                    value={job.stopAfterFails} 
                                    onChange={e => updateJobData(activeAccount.id, { stopAfterFails: parseInt(e.target.value) || 0 })} 
                                    disabled={isWorking} 
                                    className="h-8 text-sm"
                                    placeholder="0 = Off"
                                />
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex justify-between items-center mb-2">
                                <Label className="block text-xs uppercase text-muted-foreground font-bold">Target Emails</Label>
                                {/* --- RECIPIENT COUNTER BADGE --- */}
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                                    {recipientCount} Emails
                                </Badge>
                            </div>
                            <Textarea 
                                value={job.emailList} 
                                onChange={e => updateJobData(activeAccount.id, { emailList: e.target.value })} 
                                className="flex-1 font-mono text-xs resize-none" 
                                placeholder="user@example.com"
                                disabled={isWorking} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase text-muted-foreground font-bold">Metadata (JSON)</Label>
                            <Input 
                                value={job.eventData} 
                                onChange={e => updateJobData(activeAccount.id, { eventData: e.target.value })} 
                                disabled={isWorking} 
                                className="h-8 font-mono text-xs" 
                                placeholder='{"plan": "pro"}'
                            />
                        </div>
                        <Button onClick={() => startJob(activeAccount.id, activeAccount.apiKey)} disabled={isWorking} className="w-full">
                            <Play className="mr-2 h-4 w-4" /> Start Tracking
                        </Button>
                    </CardContent>
                </Card>

                {/* RIGHT: Live Logs Card */}
                <Card className="flex flex-col h-full overflow-hidden border-l-4 border-l-primary/20">
                    <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row justify-between items-center space-y-0">
                        <CardTitle className="text-base font-semibold">Live Logs</CardTitle>
                        <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as any)} size="sm">
                            <ToggleGroupItem value="all" className="h-7 text-xs">All</ToggleGroupItem>
                            <ToggleGroupItem value="success" className="h-7 text-xs text-green-600">OK</ToggleGroupItem>
                            <ToggleGroupItem value="error" className="h-7 text-xs text-red-600">Err</ToggleGroupItem>
                        </ToggleGroup>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                        <div className="grid grid-cols-2 divide-x border-b bg-muted/10">
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold text-green-600">Success</div>
                                <div className="text-lg font-bold text-green-600">{job.stats.success}</div>
                            </div>
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold text-red-600">Failed</div>
                                <div className="text-lg font-bold text-red-600">{job.stats.fail}</div>
                            </div>
                        </div>
                        <div className="px-4 py-3 border-b"><Progress value={progressPercent} className="h-1.5" /></div>
                        <div className="flex-1 overflow-auto bg-slate-50/50">
                            <Table>
                                <TableHeader className="bg-background sticky top-0 shadow-sm">
                                    <TableRow className="h-9">
                                        <TableHead className="w-[50px] text-xs">#</TableHead>
                                        <TableHead className="text-xs">Email</TableHead>
                                        <TableHead className="text-xs">Status</TableHead>
                                        <TableHead className="text-right text-xs">Info</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredResults.length > 0 ? filteredResults.slice().reverse().map((r, i) => (
                                        <TableRow key={i} className="h-9">
                                            <TableCell className="text-xs font-mono text-muted-foreground">{filteredResults.length - i}</TableCell>
                                            <TableCell className="text-xs font-medium">{r.email}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={r.status === 'success' ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'}>
                                                    {r.status === 'success' ? 'OK' : 'ERR'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setViewDetails(r); setIsDetailsOpen(true); }}>
                                                    <Info className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-xs">No events logged.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Event Details</DialogTitle>
                        <DialogDescription>API result for {viewDetails?.email}</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[200px] w-full border p-4 bg-slate-950 text-slate-50 rounded-md">
                        <pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(viewDetails || {}, null, 2)}</pre>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
};