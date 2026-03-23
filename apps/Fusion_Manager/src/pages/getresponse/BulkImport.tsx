import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Square, Users, Clock, Terminal, Info, Loader2, FileJson } from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import { useBulkJobs } from '@/contexts/BulkJobContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type FilterStatus = 'all' | 'success' | 'error';

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const BulkImport: React.FC = () => {
    const { activeAccount } = useAccount();
    const { getJob, updateJobData, startJob, stopJob } = useBulkJobs();
    
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
    
    // For the Results Table
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [viewDetails, setViewDetails] = useState<any | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    
    const job = activeAccount ? getJob(activeAccount.id) : null;
    const isWorking = job?.status === 'processing' || job?.status === 'waiting';

    useEffect(() => {
        if (!activeAccount) return;
        const fetchCampaigns = async () => {
            setIsLoadingCampaigns(true);
            try {
                const res = await fetch(`/api/getresponse/campaigns?accountId=${activeAccount.id}`);
                const data = await res.json();
                if (Array.isArray(data)) setCampaigns(data);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoadingCampaigns(false);
            }
        };
        fetchCampaigns();
    }, [activeAccount]);

    const filteredResults = useMemo(() => {
        if (!job) return [];
        if (filter === 'all') return job.results;
        return job.results.filter(r => r.status === filter);
    }, [job, filter]);

    const recipientCount = useMemo(() => {
        if (!job?.emailList) return 0;
        return job.emailList.split('\n').map(e => e.trim()).filter(e => e.length > 0).length;
    }, [job?.emailList]);

    if (!activeAccount || !job) {
        return (
            <div className="p-6">
                <Alert variant="destructive"><Terminal className="h-4 w-4" /><AlertTitle>No Account</AlertTitle><AlertDescription>Select a GetResponse account.</AlertDescription></Alert>
            </div>
        );
    }

    const progressPercent = job.progress.total > 0 ? (job.progress.current / job.progress.total) * 100 : 0;

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 h-[calc(100vh-60px)] flex flex-col">
            <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="p-2 bg-primary/10 rounded-lg"><Users className="h-6 w-6 text-primary" /></div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">GetResponse Import</h1>
                    <p className="text-sm text-muted-foreground">Bulk add subscribers to a campaign list.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                
                {/* LEFT: Configuration (Locked to screen, internal scrolling) */}
                <Card className="flex flex-col h-full overflow-hidden shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/20 shrink-0">
                        <CardTitle className="text-base font-semibold">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
                        
                        <div className="space-y-1 shrink-0">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Select Campaign (List)</Label>
                            <Select 
                                disabled={isWorking || isLoadingCampaigns} 
                                value={job.subject} // We map campaignId to subject internally
                                onValueChange={(val) => updateJobData(activeAccount.id, { subject: val, content: 'N/A' })}
                            >
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder={isLoadingCampaigns ? "Loading..." : "Select a list..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {campaigns.map(c => (
                                        <SelectItem key={c.campaignId} value={c.campaignId}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4 shrink-0">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Delay (Seconds)</Label>
                                <Input className="h-9 text-sm" type="number" step="0.1" min="0" value={job.delay} onChange={e => updateJobData(activeAccount.id, { delay: parseFloat(e.target.value) || 0 })} disabled={isWorking} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Stop on Fails</Label>
                                <Input className="h-9 text-sm" type="number" min="0" value={job.stopAfterFails} onChange={e => updateJobData(activeAccount.id, { stopAfterFails: parseInt(e.target.value) || 0 })} disabled={isWorking} />
                            </div>
                        </div>

                        {/* Flex-1 so the Textarea fills the remaining space */}
                        <div className="flex-1 flex flex-col min-h-0 space-y-1">
                            <div className="flex justify-between items-center mb-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Contacts (Name, email@domain.com)</Label>
                                <Badge variant="secondary" className="text-[10px] h-5 px-2 font-mono">{recipientCount} Contacts</Badge>
                            </div>
                            <Textarea 
                                value={job.emailList} 
                                onChange={e => updateJobData(activeAccount.id, { emailList: e.target.value })} 
                                className="flex-1 font-mono text-xs resize-none p-3 leading-relaxed" 
                                placeholder={`John Doe, john@example.com\nJane Doe, jane@example.com\nonly-email@example.com`}
                                disabled={isWorking} 
                            />
                        </div>

                        {/* Button anchored at the bottom */}
                        <div className="pt-2 shrink-0">
                            {!isWorking ? (
                                <Button onClick={() => startJob(activeAccount.id, activeAccount.apiKey, 'getresponse')} className="w-full h-9 text-sm" disabled={!job.subject}>
                                    <Play className="mr-2 h-4 w-4" /> Start Importing
                                </Button>
                            ) : (
                                <Button variant="destructive" onClick={() => stopJob(activeAccount.id)} className="w-full h-9 text-sm">
                                    <Square className="mr-2 h-4 w-4" /> Stop Import
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* RIGHT: Results Card */}
                <Card className="flex flex-col h-full overflow-hidden border-l-4 border-l-primary/20 shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row justify-between items-center space-y-0 shrink-0">
                        <CardTitle className="text-base font-semibold">Import Logs</CardTitle>
                        <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as FilterStatus)} size="sm">
                            <ToggleGroupItem value="all" className="h-7 text-xs">All</ToggleGroupItem>
                            <ToggleGroupItem value="success" className="h-7 text-xs text-green-600">Added</ToggleGroupItem>
                            <ToggleGroupItem value="error" className="h-7 text-xs text-red-600">Failed</ToggleGroupItem>
                        </ToggleGroup>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                        <div className="grid grid-cols-3 divide-x border-b bg-muted/10 shrink-0">
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold">Time</div>
                                <div className="text-lg font-mono font-medium">{formatTime(job.elapsedSeconds)}</div>
                            </div>
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold text-green-600">Added</div>
                                <div className="text-lg font-bold text-green-600">{job.stats.success}</div>
                            </div>
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold text-red-600">Failed</div>
                                <div className="text-lg font-bold text-red-600">{job.stats.fail}</div>
                            </div>
                        </div>
                        <div className="px-4 py-3 border-b shrink-0">
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-muted-foreground">Progress: {job.progress.current} / {job.progress.total}</span>
                            </div>
                            <Progress value={progressPercent} className="h-1.5" />
                        </div>
                        <div className="flex-1 overflow-auto bg-slate-50/50">
                            <Table>
                                <TableHeader className="bg-background sticky top-0 shadow-sm z-10">
                                    <TableRow className="h-9">
                                        <TableHead className="w-[50px] text-xs">#</TableHead>
                                        <TableHead className="text-xs">Contact</TableHead>
                                        <TableHead className="text-xs">Status</TableHead>
                                        <TableHead className="text-right text-xs">Info</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredResults.length > 0 ? filteredResults.slice().reverse().map((r, i) => (
                                        <TableRow key={i} className="h-9 hover:bg-muted/50 transition-colors">
                                            <TableCell className="text-xs font-mono text-muted-foreground">{filteredResults.length - i}</TableCell>
                                            <TableCell className="text-xs font-medium">{r.email}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={r.status === 'success' ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'}>
                                                    {r.status === 'success' ? 'Added' : 'Failed'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-60 hover:opacity-100 transition-opacity" onClick={() => { setViewDetails(r); setIsDetailsOpen(true); }}>
                                                    <Info className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-xs">
                                                {isWorking ? "Importing contacts..." : "No logs available."}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            {/* ADDED INFO DIALOG */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><FileJson className="h-5 w-5 text-primary" /> Response Details</DialogTitle>
                        <DialogDescription>API result for {viewDetails?.email}</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[300px] w-full border p-4 bg-slate-950 text-slate-50 rounded-md">
                        <pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(viewDetails || {}, null, 2)}</pre>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

        </div>
    );
};