import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Clock, Terminal, FileJson, CheckCircle, XCircle, Info, Upload, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAccount } from '@/contexts/AccountContext';
import { useJob } from '@/contexts/JobContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from '@/components/ui/separator';

type FilterStatus = 'all' | 'success' | 'failed';

const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function BrevoBulkImport() {
    const { activeAccount: selectedAccount } = useAccount();
    const { getActiveJobForAccount, addJob, pauseJob, resumeJob, stopJob } = useJob();

    // --- State ---
    const [emailListInput, setEmailListInput] = useState('');
    const [delayInput, setDelayInput] = useState(1);
    const [defaultName, setDefaultName] = useState('');
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [lists, setLists] = useState<any[]>([]);
    const [isLoadingLists, setIsLoadingLists] = useState(false);
    const [selectedList, setSelectedList] = useState<string | null>(null);
    
    const [viewDetails, setViewDetails] = useState<any | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [now, setNow] = useState(Date.now());

    const currentJob = useMemo(() => {
        if (!selectedAccount) return null;
        return getActiveJobForAccount(selectedAccount.id, 'import');
    }, [selectedAccount, getActiveJobForAccount]);

    const isRunning = currentJob?.status === 'processing';
    const isPaused = currentJob?.status === 'paused';
    const isWorking = isRunning || isPaused;

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    // --- Persistence & Init ---
    useEffect(() => {
        if (selectedAccount?.provider === 'brevo') {
            const savedDraft = sessionStorage.getItem(`brevo_draft_${selectedAccount.id}`);
            if (savedDraft) {
                try {
                    const parsed = JSON.parse(savedDraft);
                    setEmailListInput(parsed.importData || "");
                    setSelectedList(parsed.selectedList || null);
                    if (parsed.delay) setDelayInput(parsed.delay);
                    if (parsed.defaultName) setDefaultName(parsed.defaultName);
                } catch (e) {}
            }
            fetchLists();
        }
    }, [selectedAccount]);

    const saveState = (updates: any) => {
        if (!selectedAccount) return;
        const currentState = { 
            importData: updates.importData !== undefined ? updates.importData : emailListInput,
            selectedList: updates.selectedList !== undefined ? updates.selectedList : selectedList,
            delay: updates.delay !== undefined ? updates.delay : delayInput,
            defaultName: updates.defaultName !== undefined ? updates.defaultName : defaultName
        };
        sessionStorage.setItem(`brevo_draft_${selectedAccount.id}`, JSON.stringify(currentState));
    };

    const fetchLists = async () => {
        if (!selectedAccount) return;
        setIsLoadingLists(true);
        try {
            const res = await fetch('/api/brevo/lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: selectedAccount.apiKey })
            });
            if (res.ok) {
                const data = await res.json();
                setLists(Array.isArray(data) ? data : []);
            }
        } catch (e) { console.error(e); } finally { setIsLoadingLists(false); }
    };

    const handleStartImport = () => {
        if (!selectedAccount || !selectedList || !emailListInput.trim()) {
            toast({ title: "Error", description: "Missing configuration.", variant: "destructive" });
            return;
        }
        
        const contacts = emailListInput.split('\n').filter(l => l.trim()).map(line => {
            const [email, fname, lname] = line.split(',');
            return { 
                email: email.trim(), 
                firstName: fname?.trim() ? fname.trim() : defaultName, 
                lastName: lname?.trim() ? lname.trim() : undefined 
            };
        });

        const apiKey = selectedAccount.apiKey;
        const listId = selectedList;

        addJob({
            title: `Brevo Import (${contacts.length})`,
            type: 'import',
            totalItems: contacts.length,
            data: contacts,
            apiEndpoint: 'brevo-import',
            batchSize: 1,
            processItem: async (contact) => {
                if (delayInput > 0) await new Promise(r => setTimeout(r, delayInput * 1000));
                
                const res = await fetch('/api/brevo/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey, listId, contact })
                });
                
                const data = await res.json();
                
                if (!res.ok) {
                    const msg = data.details?.message || data.error || "Failed";
                    throw new Error(msg);
                }
                return { ...data, email: contact.email };
            }
        }, selectedAccount.id);
        
        toast({ title: "Job Started", description: "Importing contacts to Brevo..." });
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setEmailListInput(val);
        saveState({ importData: val });
    };

    const handleDefaultNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setDefaultName(val);
        saveState({ defaultName: val });
    };

    const elapsedTime = useMemo(() => {
        if (!currentJob) return 0;
        const isDone = ['completed', 'failed', 'stopped'].includes(currentJob.status);
        const endTime = isDone && currentJob.endTime ? currentJob.endTime : now;
        let d = endTime - currentJob.startTime - (currentJob.totalPausedTime || 0);
        if (currentJob.status === 'paused' && currentJob.pauseStartTime) d -= (now - currentJob.pauseStartTime);
        return Math.max(0, Math.floor(d / 1000));
    }, [currentJob, now]);

    const filteredResults = useMemo(() => {
        if (!currentJob) return [];
        if (filter === 'all') return currentJob.results;
        return currentJob.results.filter(r => r.status === filter);
    }, [currentJob, filter]);

    const progress = currentJob && currentJob.totalItems > 0 ? (currentJob.processedItems / currentJob.totalItems) * 100 : 0;
    const { successCount, errorCount } = useMemo(() => {
        if (!currentJob) return { successCount: 0, errorCount: 0 };
        return {
            successCount: currentJob.results.filter(r => r.status === 'success').length,
            errorCount: currentJob.results.filter(r => r.status !== 'success').length,
        };
    }, [currentJob]);

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 h-[calc(100vh-60px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="p-2 bg-primary/10 rounded-lg"><Upload className="h-6 w-6 text-primary" /></div>
                <div><h1 className="text-2xl font-bold tracking-tight">Brevo Import</h1><p className="text-sm text-muted-foreground">Bulk import contacts to specific lists.</p></div>
            </div>

            {!selectedAccount && (
                <Alert variant="destructive" className="mb-6">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>No Account Selected</AlertTitle>
                    <AlertDescription>Please select a Brevo account from the sidebar.</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                {/* LEFT: Config */}
                <Card className="flex flex-col h-full overflow-hidden">
                    <CardHeader className="pb-3 border-b bg-muted/20"><CardTitle className="text-base font-semibold">Configuration</CardTitle></CardHeader>
                    <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
                        
                        <div className="flex-1 flex flex-col min-h-0">
                            <Label className="mb-2 block text-xs uppercase text-muted-foreground">Emails (email,firstname,lastname)</Label>
                            <Textarea 
                                value={emailListInput} 
                                onChange={handleTextareaChange} 
                                className="flex-1 font-mono text-xs resize-none" 
                                placeholder="user@example.com&#10;user2@example.com,John&#10;user3@example.com,Jane,Doe" 
                                disabled={isWorking} 
                            />
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4 shrink-0">
                            <div className="col-span-2">
                                <div className="flex justify-between items-center mb-1">
                                    <Label className="text-xs uppercase text-muted-foreground">Target List</Label>
                                    <Button variant="ghost" size="sm" onClick={fetchLists} disabled={isLoadingLists} className="h-5 w-5 p-0">
                                         <RefreshCw className={isLoadingLists ? "animate-spin w-3 h-3" : "w-3 h-3"} />
                                    </Button>
                                </div>
                                <Select value={selectedList || ""} onValueChange={val => {setSelectedList(val); saveState({selectedList: val})}} disabled={isWorking}>
                                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select List" /></SelectTrigger>
                                    <SelectContent>{lists.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-xs uppercase text-muted-foreground mb-1 block">Default Name</Label>
                                <Input value={defaultName} onChange={handleDefaultNameChange} placeholder="Friend" disabled={isWorking} className="h-8 text-sm" />
                            </div>

                            <div>
                                <Label className="text-xs uppercase text-muted-foreground mb-1 block">Delay (s)</Label>
                                <Input type="number" step="0.1" value={delayInput} onChange={e => {setDelayInput(Number(e.target.value)); saveState({delay: Number(e.target.value)})}} disabled={isWorking} className="h-8 text-sm" />
                            </div>
                        </div>

                        <Button onClick={handleStartImport} disabled={!selectedAccount || isWorking || !selectedList} className="w-full"><Play className="mr-2 h-4 w-4" /> Start Import</Button>
                        {isWorking && (
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => isPaused ? resumeJob(currentJob!.id) : pauseJob(currentJob!.id)} className="flex-1"><Clock className="mr-2 h-4 w-4" /> {isPaused ? "Resume" : "Pause"}</Button>
                                <Button variant="destructive" size="icon" onClick={() => stopJob(currentJob!.id)}><Square className="h-4 w-4" /></Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* RIGHT: Results */}
                <Card className="flex flex-col h-full overflow-hidden border-l-4 border-l-primary/20">
                    <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row justify-between items-center space-y-0">
                        <CardTitle className="text-base font-semibold">Results</CardTitle>
                        <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as FilterStatus)} size="sm">
                            <ToggleGroupItem value="all" className="h-7 text-xs">All</ToggleGroupItem>
                            <ToggleGroupItem value="success" className="h-7 text-xs text-green-600">Success</ToggleGroupItem>
                            <ToggleGroupItem value="failed" className="h-7 text-xs text-red-600">Failed</ToggleGroupItem>
                        </ToggleGroup>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                        <div className="grid grid-cols-3 divide-x border-b bg-muted/10">
                            <div className="p-3 text-center"><div className="text-[10px] uppercase text-muted-foreground font-bold">Time</div><div className="text-lg font-mono font-medium">{formatTime(elapsedTime)}</div></div>
                            <div className="p-3 text-center"><div className="text-[10px] uppercase text-muted-foreground font-bold text-green-600">Success</div><div className="text-lg font-bold text-green-600">{successCount}</div></div>
                            <div className="p-3 text-center"><div className="text-[10px] uppercase text-muted-foreground font-bold text-red-600">Failed</div><div className="text-lg font-bold text-red-600">{errorCount}</div></div>
                        </div>
                        <div className="px-4 py-3 border-b"><Progress value={progress} className="h-1.5" /></div>
                        
                        <div className="flex-1 overflow-auto bg-slate-50/50">
                            <Table>
                                <TableHeader className="bg-background sticky top-0 shadow-sm"><TableRow className="h-9"><TableHead className="w-[50px] text-xs">#</TableHead><TableHead className="text-xs">Email</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-right text-xs">Info</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {filteredResults.length > 0 ? filteredResults.slice().reverse().map((r, i) => (
                                        <TableRow key={i} className="h-9">
                                            <TableCell className="text-xs font-mono text-muted-foreground">{filteredResults.length - i}</TableCell>
                                            <TableCell className="text-xs font-medium">{r.data?.email || 'Unknown'}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={r.status === 'success' ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'}>
                                                    {r.status === 'success' ? 'OK' : 'Fail'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-primary/10" onClick={() => { setViewDetails(r); setIsDetailsOpen(true); }}>
                                                    <Info className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-xs">
                                                {isWorking ? "Waiting for results..." : "No logs available."}
                                            </TableCell>
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
                        <DialogTitle className="flex items-center gap-2"><FileJson className="h-5 w-5 text-primary" /> Log Details</DialogTitle>
                        <DialogDescription>API Response for {viewDetails?.data?.email || 'selected item'}</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[300px] w-full border p-4 bg-slate-950 text-slate-50 rounded-md">
                        <pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(viewDetails || {}, null, 2)}</pre>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}