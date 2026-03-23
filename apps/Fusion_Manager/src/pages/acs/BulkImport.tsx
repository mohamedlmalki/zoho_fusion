import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Square, FileJson, Info, ImagePlus, Eye, CloudUpload, RefreshCw } from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import { useBulkJobs } from '@/contexts/BulkJobContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PreviewDialog } from '@/components/PreviewDialog';
import { AddImageDialog } from '@/components/AddImageDialog';
import { useToast } from '@/hooks/use-toast';

type FilterStatus = 'all' | 'success' | 'error';
const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const BulkImport: React.FC = () => {
    const { activeAccount } = useAccount();
    const { getJob, updateJobData, startJob, stopJob } = useBulkJobs();
    const { toast } = useToast();
    
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [viewDetails, setViewDetails] = useState<any | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    
    // Azure Loading States
    const [isUpdatingName, setIsUpdatingName] = useState(false);
    const [isFetchingName, setIsFetchingName] = useState(false);
    
    const job = activeAccount ? getJob(activeAccount.id) : null;
    const isWorking = job?.status === 'processing' || job?.status === 'waiting';

    // --- NEW: EXTRACTED FETCH FUNCTION FOR MANUAL CLICKS ---
    const fetchCurrentAzureName = async (forceSync = false) => {
        if (!activeAccount || activeAccount.provider !== 'acs' || !activeAccount.credentials?.clientSecret) return;
        
        // If not forcing a manual sync, and we already have a name, skip fetching.
        if (job?.fromName && !forceSync) return; 

        setIsFetchingName(true);
        try {
            const res = await fetch('http://localhost:3001/api/acs/get-name', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${activeAccount.credentials.clientSecret}`
                }
            });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);

            if (data.displayName) {
                updateJobData(activeAccount.id, { fromName: data.displayName });
                if (forceSync) {
                    toast({ title: "Name Synced", description: "Successfully fetched the latest name from Azure." });
                }
            }
        } catch (error: any) {
            console.error("Could not fetch Azure name:", error);
            if (forceSync) {
                toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
            }
        } finally {
            setIsFetchingName(false);
        }
    };

    // Auto-fetch on initial load
    useEffect(() => {
        fetchCurrentAzureName();

        // Lock the from email address
        if (activeAccount?.credentials?.senderAddress && job && !job.fromEmail) {
            updateJobData(activeAccount.id, { fromEmail: activeAccount.credentials.senderAddress });
        }
    }, [activeAccount, job?.id]);

    const handleInsertImage = (imgHtml: string) => {
        if (!activeAccount) return;
        updateJobData(activeAccount.id, { content: (job?.content || "") + imgHtml });
    };

    // --- AZURE UPDATE NAME FUNCTION ---
    const handleUpdateName = async () => {
        if (!activeAccount || !job?.fromName) return;
        setIsUpdatingName(true);
        try {
            const res = await fetch('http://localhost:3001/api/acs/update-name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    newName: job.fromName,
                    credentials: activeAccount.credentials
                })
            });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);
            
            toast({
                title: "Azure Updated",
                description: `Display Name successfully changed to "${data.displayName}"`,
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Update Failed",
                description: error.message,
            });
        } finally {
            setIsUpdatingName(false);
        }
    };

    const filteredResults = useMemo(() => {
        if (!job) return [];
        if (filter === 'all') return job.results;
        return job.results.filter(r => r.status === filter);
    }, [job, filter]);

    const recipientCount = useMemo(() => {
        if (!job?.emailList) return 0;
        return job.emailList.split('\n').map(e => e.trim()).filter(e => e.length > 0).length;
    }, [job?.emailList]);

    if (!activeAccount || !job) return null;

    const progressPercent = job.progress.total > 0 ? (job.progress.current / job.progress.total) * 100 : 0;

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 h-[calc(100vh-60px)] flex flex-col">
            <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="p-2 bg-[#0078D4]/10 rounded-lg"><CloudUpload className="h-6 w-6 text-[#0078D4]" /></div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Azure ACS Bulk Send</h1>
                    <p className="text-sm text-muted-foreground">Manage your display name and blast emails via Azure.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                <Card className="flex flex-col h-full overflow-hidden border-t-4 border-t-[#0078D4]">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                        <CardTitle className="text-base font-semibold">Campaign Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
                        
                        <div className="grid grid-cols-2 gap-4 shrink-0">
                            {/* --- AZURE CUSTOM FROM NAME FIELD WITH CLICKABLE REFRESH --- */}
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Azure Display Name</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input 
                                            value={job.fromName || ""} 
                                            onChange={e => updateJobData(activeAccount.id, { fromName: e.target.value })} 
                                            placeholder={isFetchingName ? "Fetching from Azure..." : "My Brand"}
                                            disabled={isWorking || isUpdatingName || isFetchingName} 
                                            className="h-8 text-sm w-full pr-8"
                                        />
                                        <button 
                                            onClick={() => fetchCurrentAzureName(true)}
                                            disabled={isWorking || isUpdatingName || isFetchingName}
                                            className="absolute right-2 top-2 text-muted-foreground hover:text-[#0078D4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Manually sync name from Azure"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${isFetchingName ? 'animate-spin text-[#0078D4]' : ''}`} />
                                        </button>
                                    </div>
                                    <Button 
                                        size="sm" 
                                        variant="secondary" 
                                        className="h-8 text-xs px-2 whitespace-nowrap bg-[#0078D4]/10 text-[#0078D4] hover:bg-[#0078D4]/20" 
                                        onClick={handleUpdateName}
                                        disabled={isWorking || isUpdatingName || !job.fromName || isFetchingName}
                                    >
                                        {isUpdatingName ? "Pushing..." : "Update Azure"}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">From Email (Locked)</Label>
                                <Input 
                                    value={activeAccount?.credentials?.senderAddress || ""} 
                                    disabled 
                                    className="h-8 text-sm bg-muted/50"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Delay(s)</Label>
                                <Input 
                                    type="number" step="0.1" min="0"
                                    value={job.delay} 
                                    onChange={e => updateJobData(activeAccount.id, { delay: parseFloat(e.target.value) || 0 })} 
                                    disabled={isWorking} 
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold" title="0 = Infinite">Stop Fails</Label>
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

                        <div className="space-y-1 shrink-0">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Subject Line</Label>
                            <Input 
                                value={job.subject} 
                                onChange={e => updateJobData(activeAccount.id, { subject: e.target.value })} 
                                disabled={isWorking} 
                                className="h-8 text-sm" 
                            />
                        </div>

                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex justify-between items-center mb-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">HTML Content</Label>
                                <div className="flex gap-2">
                                    <AddImageDialog onInsertImage={handleInsertImage}>
                                        <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 hover:bg-muted">
                                            <ImagePlus className="w-3 h-3 mr-1" /> Image
                                        </Button>
                                    </AddImageDialog>
                                    <PreviewDialog htmlContent={job.content}>
                                        <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 hover:bg-muted">
                                            <Eye className="w-3 h-3 mr-1" /> Preview
                                        </Button>
                                    </PreviewDialog>
                                </div>
                            </div>
                            <Textarea 
                                value={job.content} 
                                onChange={e => updateJobData(activeAccount.id, { content: e.target.value })} 
                                className="flex-1 font-mono text-xs resize-none p-2"
                                disabled={isWorking} 
                            />
                        </div>

                        <div className="space-y-1 h-[120px] shrink-0">
                            <div className="flex justify-between items-center mb-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Recipients (one per line)</Label>
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                                    {recipientCount} Emails
                                </Badge>
                            </div>
                            <Textarea 
                                value={job.emailList} 
                                onChange={e => updateJobData(activeAccount.id, { emailList: e.target.value })} 
                                className="h-full font-mono text-xs resize-none p-2" 
                                placeholder="user@example.com"
                                disabled={isWorking} 
                            />
                        </div>

                        <div className="pt-2">
                            {!isWorking ? (
                                <Button onClick={() => startJob(activeAccount.id, activeAccount.credentials?.clientSecret || activeAccount.apiKey, 'acs')} className="w-full h-9 bg-[#0078D4] hover:bg-[#0078D4]/90">
                                    <Play className="mr-2 h-4 w-4" /> Start Bulk Send
                                </Button>
                            ) : (
                                <Button variant="destructive" onClick={() => stopJob(activeAccount.id)} className="w-full h-9">
                                    <Square className="mr-2 h-4 w-4" /> Stop Campaign
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="flex flex-col h-full overflow-hidden">
                    <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row justify-between items-center space-y-0">
                        <CardTitle className="text-base font-semibold">Live Results</CardTitle>
                        <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as FilterStatus)} size="sm">
                            <ToggleGroupItem value="all" className="h-7 text-xs">All</ToggleGroupItem>
                            <ToggleGroupItem value="success" className="h-7 text-xs text-green-600">Success</ToggleGroupItem>
                            <ToggleGroupItem value="error" className="h-7 text-xs text-red-600">Failed</ToggleGroupItem>
                        </ToggleGroup>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                        <div className="grid grid-cols-3 divide-x border-b bg-muted/10">
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold">Time</div>
                                <div className="text-lg font-mono font-medium">{formatTime(job.elapsedSeconds)}</div>
                            </div>
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold text-green-600">Success</div>
                                <div className="text-lg font-bold text-green-600">{job.stats.success}</div>
                            </div>
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold text-red-600">Failed</div>
                                <div className="text-lg font-bold text-red-600">{job.stats.fail}</div>
                            </div>
                        </div>
                        <div className="px-4 py-3 border-b">
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-muted-foreground">Progress: {job.progress.current} / {job.progress.total}</span>
                            </div>
                            <Progress value={progressPercent} className="h-1.5 [&>div]:bg-[#0078D4]" />
                        </div>
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
                                                    {r.status === 'success' ? 'OK' : 'Fail'}
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
                                            <TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-xs">
                                                {isWorking ? "Sending emails via Azure..." : "No logs available."}
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
                        <DialogTitle className="flex items-center gap-2"><FileJson className="h-5 w-5 text-[#0078D4]" /> Response Details</DialogTitle>
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