import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Play, Square, Send, Terminal, Info, FileJson, Clock, ImagePlus, Eye } from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import { useBulkJobs } from '@/contexts/BulkJobContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PreviewDialog } from '@/components/PreviewDialog';
import { AddImageDialog } from '@/components/AddImageDialog';

type FilterStatus = 'all' | 'success' | 'error';
const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const BulkImport: React.FC = () => {
    const { activeAccount } = useAccount();
    const { getJob, updateJobData, startJob, stopJob } = useBulkJobs();
    
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [viewDetails, setViewDetails] = useState<any | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    
    const [subAccounts, setSubAccounts] = useState<any[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

    const job = activeAccount ? getJob(activeAccount.id) : null;
    const isWorking = job?.status === 'processing' || job?.status === 'waiting';

    useEffect(() => {
        if (!activeAccount) return;
        const fetchSubAccounts = async () => {
            setIsLoadingAccounts(true);
            try {
                const res = await fetch(`/api/zohomail/sub-accounts?accountId=${activeAccount.id}`);
                const result = await res.json();
                
                // Safely extract the array
                let accountsList = [];
                if (result.data && Array.isArray(result.data)) {
                    accountsList = result.data;
                } else if (Array.isArray(result)) {
                    accountsList = result;
                }

                setSubAccounts(accountsList);

                // Auto-select the first email if none is currently selected
                if (accountsList.length > 0 && (!job?.fromEmail || !accountsList.find((a: any) => a.emailAddress === job?.fromEmail))) {
                    updateJobData(activeAccount.id, { fromEmail: accountsList[0].emailAddress });
                }
            } catch (err) {
                console.error("Fetch sub-accounts error:", err);
            } finally {
                setIsLoadingAccounts(false);
            }
        };
        fetchSubAccounts();
    }, [activeAccount]);

    const handleInsertImage = (imgHtml: string) => {
        if (!activeAccount) return;
        updateJobData(activeAccount.id, { content: (job?.content || "") + imgHtml });
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

    if (!activeAccount || !job) {
        return (
            <div className="p-6">
                <Alert variant="destructive"><Terminal className="h-4 w-4" /><AlertTitle>No Account</AlertTitle><AlertDescription>Select a Zoho Mail360 account.</AlertDescription></Alert>
            </div>
        );
    }

    const progressPercent = job.progress.total > 0 ? (job.progress.current / job.progress.total) * 100 : 0;

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 min-h-[calc(100vh-60px)] pb-12">
            <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="p-2 bg-primary/10 rounded-lg"><Send className="h-6 w-6 text-primary" /></div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Zoho Mail360 Sender</h1>
                    <p className="text-sm text-muted-foreground">Mass sending using ZeptoMail infrastructure.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <Card className="flex flex-col overflow-hidden shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                        <CardTitle className="text-base font-semibold">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-5">
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">From Name</Label>
                                <Input value={job.fromName || ""} onChange={e => updateJobData(activeAccount.id, { fromName: e.target.value })} disabled={isWorking} className="h-9 text-sm" />
                            </div>
                            
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">From Email</Label>
                                <Select 
                                    disabled={isWorking || isLoadingAccounts} 
                                    value={job.fromEmail || ""}
                                    onValueChange={(val) => updateJobData(activeAccount.id, { fromEmail: val })}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder={isLoadingAccounts ? "Fetching domains..." : "Select sender..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subAccounts.map((acc: any, index: number) => (
                                            <SelectItem key={acc.account_key || index} value={acc.emailAddress}>
                                                {acc.emailAddress}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Delay(s)</Label>
                                <Input type="number" step="0.1" min="0" value={job.delay} onChange={e => updateJobData(activeAccount.id, { delay: parseFloat(e.target.value) || 0 })} disabled={isWorking} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold" title="0 = Infinite">Stop Fails</Label>
                                <Input type="number" min="0" value={job.stopAfterFails} onChange={e => updateJobData(activeAccount.id, { stopAfterFails: parseInt(e.target.value) || 0 })} disabled={isWorking} className="h-9 text-sm" placeholder="0 = Off" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Subject Line</Label>
                            <Input value={job.subject} onChange={e => updateJobData(activeAccount.id, { subject: e.target.value })} disabled={isWorking} className="h-9 text-sm" />
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between items-center mb-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">HTML Content</Label>
                                <div className="flex gap-2">
                                    <AddImageDialog onInsertImage={handleInsertImage}>
                                        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 hover:bg-muted"><ImagePlus className="w-3 h-3 mr-1" /> Image</Button>
                                    </AddImageDialog>
                                    <PreviewDialog htmlContent={job.content}>
                                        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 hover:bg-muted"><Eye className="w-3 h-3 mr-1" /> Preview</Button>
                                    </PreviewDialog>
                                </div>
                            </div>
                            <Textarea value={job.content} onChange={e => updateJobData(activeAccount.id, { content: e.target.value })} className="min-h-[250px] font-mono text-xs resize-y p-3" disabled={isWorking} />
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between items-center mb-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Recipients (one per line)</Label>
                                <Badge variant="secondary" className="text-[10px] h-5 px-2 font-mono">{recipientCount} Emails</Badge>
                            </div>
                            <Textarea value={job.emailList} onChange={e => updateJobData(activeAccount.id, { emailList: e.target.value })} className="min-h-[150px] font-mono text-xs resize-y p-3 leading-relaxed" placeholder="user@example.com" disabled={isWorking} />
                        </div>

                        <div className="pt-4">
                            {!isWorking ? (
                                <Button onClick={() => startJob(activeAccount.id, activeAccount.apiKey, 'zohomail', activeAccount.apiUrl)} className="w-full h-10 text-sm font-semibold" disabled={!job.fromEmail}>
                                    <Play className="mr-2 h-4 w-4" /> Start Bulk Send
                                </Button>
                            ) : (
                                <Button variant="destructive" onClick={() => stopJob(activeAccount.id)} className="w-full h-10 text-sm font-semibold">
                                    <Square className="mr-2 h-4 w-4" /> Stop Campaign
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="flex flex-col h-[600px] lg:h-[calc(100vh-120px)] lg:sticky lg:top-6 overflow-hidden border-l-4 border-l-primary/20 shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row justify-between items-center space-y-0 shrink-0">
                        <CardTitle className="text-base font-semibold">Results</CardTitle>
                        <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as FilterStatus)} size="sm">
                            <ToggleGroupItem value="all" className="h-7 text-xs">All</ToggleGroupItem>
                            <ToggleGroupItem value="success" className="h-7 text-xs text-green-600">Success</ToggleGroupItem>
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
                                <div className="text-[10px] uppercase text-muted-foreground font-bold text-green-600">Success</div>
                                <div className="text-lg font-bold text-green-600">{job.stats.success}</div>
                            </div>
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold text-red-600">Failed</div>
                                <div className="text-lg font-bold text-red-600">{job.stats.fail}</div>
                            </div>
                        </div>
                        <div className="px-4 py-3 border-b shrink-0">
                            <div className="flex justify-between items-center text-[10px] mb-1">
                                <span className="text-muted-foreground flex items-center">
                                    Progress: {job.progress.current} / {job.progress.total}
                                    {job.status === 'waiting' && job.countdown > 0 && (
                                        <Badge variant="outline" className="ml-2 bg-orange-50 text-orange-600 border-orange-200">
                                            <Clock className="w-3 h-3 mr-1" /> Next in {job.countdown}s
                                        </Badge>
                                    )}
                                </span>
                            </div>
                            <Progress value={progressPercent} className="h-1.5" />
                        </div>
                        <div className="flex-1 overflow-auto bg-slate-50/50">
                            <Table>
                                <TableHeader className="bg-background sticky top-0 shadow-sm z-10">
                                    <TableRow className="h-9">
                                        <TableHead className="w-[50px] text-xs">#</TableHead>
                                        <TableHead className="text-xs">Email</TableHead>
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
                                                    {r.status === 'success' ? 'OK' : 'Fail'}
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
                                                {isWorking ? "Sending emails..." : "No logs available."}
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