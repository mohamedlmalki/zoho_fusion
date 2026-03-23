import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Clock, Terminal, FileJson, CheckCircle, XCircle, Info, ListPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAccount } from '@/contexts/AccountContext';
import { useJob } from '@/contexts/JobContext';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from '@/components/ui/separator';

export default function SendpulseBulkImport() {
    const { activeAccount } = useAccount();
    const { getActiveJobForAccount, addJob, pauseJob, resumeJob, stopJob, drafts, setDraft, updateJob } = useJob();

    const [lists, setLists] = useState<any[]>([]);
    const [selectedList, setSelectedList] = useState('');
    
    // PERSISTENCE: Delay and Email input stored in global context drafts
    const delayInput = Number(drafts[`sp_delay_${activeAccount?.id}`] || 0);
    const setDelayInput = (val: number) => {
        if (activeAccount?.id) setDraft(`sp_delay_${activeAccount.id}`, val.toString());
    };

    const emailListInput = drafts[`sp_import_${activeAccount?.id}`] || '';
    const setEmailListInput = (val: string) => {
        if (activeAccount?.id) setDraft(`sp_import_${activeAccount.id}`, val);
    };

    const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
    const [viewDetails, setViewDetails] = useState<any | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [now, setNow] = useState(Date.now());

    // Update time every second for "Time Elapsed"
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const currentJob = useMemo(() => activeAccount ? getActiveJobForAccount(activeAccount.id, 'sendpulse_import') : null, [activeAccount, getActiveJobForAccount]);
    const isWorking = currentJob?.status === 'processing' || currentJob?.status === 'paused';
    const isPaused = currentJob?.status === 'paused';
    const emailCount = useMemo(() => emailListInput.split(/[\n,]+/).filter(l => l.trim().includes('@')).length, [emailListInput]);

    const stats = useMemo(() => {
        if (!currentJob) return { success: 0, failed: 0, elapsed: "00:00:00" };
        const success = currentJob.processedItems - currentJob.failedItems;
        const failed = currentJob.failedItems;
        
        let diff = (currentJob.endTime || now) - currentJob.startTime - currentJob.totalPausedTime;
        if (currentJob.status === 'paused' && currentJob.pauseStartTime) {
            diff -= (now - currentJob.pauseStartTime);
        }
        
        const seconds = Math.max(0, Math.floor(diff / 1000));
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        
        return { success, failed, elapsed: `${h}:${m}:${s}` };
    }, [currentJob, now]);

    useEffect(() => {
        if (activeAccount?.provider === 'sendpulse') fetchLists();
    }, [activeAccount]);

    const fetchLists = async () => {
        try {
            const res = await fetch('/api/sendpulse/lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: activeAccount?.apiKey, secretId: activeAccount?.apiUrl })
            });
            const data = await res.json();
            if (Array.isArray(data)) setLists(data);
        } catch (e) { toast({ title: "Error", description: "Failed to load lists", variant: "destructive" }); }
    };

    const handleStartImport = () => {
        if (!activeAccount || !selectedList) return toast({ title: 'Error', description: 'Select an account and a list.', variant: "destructive" });
        const contacts = emailListInput.split(/[\n]+/).filter(l => l.trim().includes('@')).map(line => {
            const [email, name] = line.split(',');
            return { email: email?.trim(), variables: { Name: name?.trim() || '' } };
        });

        const jobId = addJob({
            title: `SendPulse Import`,
            type: 'sendpulse_import',
            totalItems: contacts.length,
            data: contacts,
            apiEndpoint: 'sendpulse',
            processItem: async (contact) => {
                // LIVE DELAY LOGIC
                if (delayInput > 0) {
                    for (let i = delayInput; i > 0; i--) {
                        updateJob(jobId, { currentDelay: i });
                        await new Promise(r => setTimeout(r, 1000));
                    }
                    updateJob(jobId, { currentDelay: 0 });
                }

                const res = await fetch('/api/sendpulse/contacts/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientId: activeAccount.apiKey, secretId: activeAccount.apiUrl, addressBookId: selectedList, contacts: [contact] })
                });
                const data = await res.json();
                if (data.failed?.length > 0) throw new Error(JSON.stringify(data.failed[0].error));
                return data.success[0];
            }
        }, activeAccount.id);
    };

    const filteredResults = useMemo(() => currentJob ? (filter === 'all' ? currentJob.results : currentJob.results.filter(r => r.status === (filter === 'failed' ? 'error' : 'success'))) : [], [currentJob, filter]);
    const progress = currentJob && currentJob.totalItems > 0 ? (currentJob.processedItems / currentJob.totalItems) * 100 : 0;

    useEffect(() => {
        setLists([]);
        setSelectedList('');
        if (activeAccount?.id && activeAccount?.provider === 'sendpulse') fetchLists();
    }, [activeAccount?.id]); 

    return (
        <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-60px)] flex flex-col animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="p-2 bg-primary/10 rounded-lg"><ListPlus className="h-6 w-6 text-primary" /></div>
                <div><h1 className="text-2xl font-bold tracking-tight">SendPulse Bulk Import</h1><p className="text-sm text-muted-foreground">Import contacts with live statistics</p></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                <Card className="flex flex-col h-full overflow-hidden">
                    <CardHeader className="pb-3 border-b bg-muted/20"><CardTitle className="text-base font-semibold flex items-center gap-2"><Terminal className="h-4 w-4" /> Import Configuration</CardTitle></CardHeader>
                    <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Address Book (List) *</Label>
                                <Select value={selectedList} onValueChange={setSelectedList} disabled={isWorking}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="Select a list..." /></SelectTrigger>
                                    <SelectContent>{lists.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name} ({l.all_email_qty})</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Delay (Seconds)</Label>
                                <Input type="number" min="0" value={delayInput} onChange={(e) => setDelayInput(Number(e.target.value))} disabled={isWorking} className="h-9" />
                            </div>
                        </div>
                        <div className="space-y-1.5 flex-1 flex flex-col min-h-[100px]">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Recipients (Email,Name)</Label>
                            <Textarea value={emailListInput} onChange={e => setEmailListInput(e.target.value)} disabled={isWorking} className="flex-1 resize-none font-mono text-xs" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button onClick={handleStartImport} disabled={!activeAccount || isWorking || !selectedList} className="w-full h-9"><Play className="h-4 w-4 mr-2" /> Start Import</Button>
                            {isWorking ? (
                                <div className="flex gap-2"><Button onClick={() => isPaused ? resumeJob(currentJob!.id) : pauseJob(currentJob!.id)} variant="secondary" className="flex-1 h-9"><Clock className="h-4 w-4 mr-2" /> {isPaused ? 'Resume' : 'Pause'}</Button><Button onClick={() => stopJob(currentJob!.id)} variant="destructive" size="icon" className="h-9 w-9"><Square className="h-4 w-4" /></Button></div>
                            ) : <Button variant="secondary" disabled className="w-full h-9 opacity-50">Pause / Stop</Button>}
                        </div>
                    </CardContent>
                </Card>

                <Card className="flex flex-col h-full overflow-hidden border-l-4 border-l-primary/20">
                    <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-base font-semibold flex items-center gap-2"><FileJson className="h-4 w-4" /> Import Logs</CardTitle>
                        <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as any)} size="sm" className="bg-background border rounded-md">
                            <ToggleGroupItem value="all" className="h-7 text-xs px-2">All</ToggleGroupItem>
                            <ToggleGroupItem value="success" className="h-7 text-xs px-2 text-green-600">Success</ToggleGroupItem>
                            <ToggleGroupItem value="failed" className="h-7 text-xs px-2 text-red-600">Failed</ToggleGroupItem>
                        </ToggleGroup>
                    </CardHeader>
                    
                    <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                        {/* LIVE STATISTICS DASHBOARD */}
                        <div className="grid grid-cols-4 gap-2 p-4 bg-muted/10 border-b">
                            <div className="bg-background border rounded-md p-2 flex flex-col items-center">
                                <span className="text-[10px] uppercase text-muted-foreground font-bold">Elapsed</span>
                                <span className="text-sm font-mono font-bold text-blue-600">{stats.elapsed}</span>
                            </div>
                            <div className="bg-background border rounded-md p-2 flex flex-col items-center">
                                <span className="text-[10px] uppercase text-muted-foreground font-bold">Success</span>
                                <span className="text-sm font-mono font-bold text-green-600">{stats.success}</span>
                            </div>
                            <div className="bg-background border rounded-md p-2 flex flex-col items-center">
                                <span className="text-[10px] uppercase text-muted-foreground font-bold">Failed</span>
                                <span className="text-sm font-mono font-bold text-red-600">{stats.failed}</span>
                            </div>
                            <div className="bg-background border rounded-md p-2 flex flex-col items-center relative overflow-hidden">
                                <span className="text-[10px] uppercase text-muted-foreground font-bold">Countdown</span>
                                <span className={`text-sm font-mono font-bold ${currentJob?.currentDelay ? 'text-orange-500 animate-pulse' : 'text-muted-foreground'}`}>
                                    {currentJob?.currentDelay || 0}s
                                </span>
                            </div>
                        </div>

                        <div className="px-4 py-3 border-b bg-muted/5">
                            <Progress value={progress} className="h-1.5" />
                        </div>
                        
                        <div className="flex-1 overflow-auto bg-slate-50/50">
                            <Table>
                                <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                                    <TableRow className="h-9 hover:bg-background"><TableHead className="w-[50px] text-xs">#</TableHead><TableHead className="text-xs">Email</TableHead><TableHead className="w-[100px] text-xs">Status</TableHead><TableHead className="w-[60px] text-xs text-right">Info</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredResults.length > 0 ? filteredResults.slice().reverse().map((r, idx) => (
                                        <TableRow key={idx} className="h-9 group">
                                            <TableCell className="text-xs font-mono text-muted-foreground py-1">{filteredResults.length - idx}</TableCell>
                                            <TableCell className="text-xs font-medium py-1">{r.data?.email || 'Unknown'}</TableCell>
                                            <TableCell className="py-1">{r.status === 'success' ? <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 h-5 px-1.5 uppercase">OK</Badge> : <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 h-5 px-1.5 uppercase">Fail</Badge>}</TableCell>
                                            <TableCell className="text-right py-1"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setViewDetails(r); setIsDetailsOpen(true); }}><Info className="h-3.5 w-3.5" /></Button></TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={4} className="h-32 text-center text-xs text-muted-foreground">{isWorking ? "Processing..." : "No logs available."}</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><FileJson className="h-5 w-5 text-primary" /> Log Details</DialogTitle><DialogDescription>API Response</DialogDescription></DialogHeader>
                    <ScrollArea className="h-[300px] w-full border p-4 bg-slate-950 text-slate-50 rounded-md"><pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(viewDetails?.status === 'error' ? { status: "FAILED", api_error: viewDetails.error, data: viewDetails.data } : viewDetails?.data || {}, null, 2)}</pre></ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}