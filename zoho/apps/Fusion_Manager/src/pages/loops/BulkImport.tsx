import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Square, Users, Terminal, Info, FileJson, Clock } from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import { useBulkJobs } from '@/contexts/BulkJobContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const BulkImport: React.FC = () => {
    const { activeAccount } = useAccount();
    const { getJob, updateJobData, startJob, stopJob } = useBulkJobs();
    
    // Dialog state for viewing raw API responses
    const [viewDetails, setViewDetails] = useState<any | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const job = activeAccount ? getJob(activeAccount.id) : null;
    const isWorking = job?.status === 'processing' || job?.status === 'waiting';

    const recipientCount = useMemo(() => {
        if (!job?.emailList) return 0;
        return job.emailList.split('\n').map(e => e.trim()).filter(e => e.length > 0).length;
    }, [job?.emailList]);

    if (!activeAccount || !job) {
        return (
            <div className="p-6">
                <Alert variant="destructive"><Terminal className="h-4 w-4" /><AlertTitle>No Account</AlertTitle><AlertDescription>Select a Loops account.</AlertDescription></Alert>
            </div>
        );
    }

    const progressPercent = job.progress.total > 0 ? (job.progress.current / job.progress.total) * 100 : 0;

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 h-[calc(100vh-60px)] flex flex-col">
            <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="p-2 bg-primary/10 rounded-lg"><Users className="h-6 w-6 text-primary" /></div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Loops Audience Import</h1>
                    <p className="text-sm text-muted-foreground">Bulk add subscribers to your main audience.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                <Card className="flex flex-col h-full overflow-hidden shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/20 shrink-0">
                        <CardTitle className="text-base font-semibold">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
                        
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

                        <div className="flex-1 flex flex-col min-h-0 space-y-1">
                            <div className="flex justify-between items-center mb-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Emails (one per line)</Label>
                                <Badge variant="secondary" className="text-[10px] h-5 px-2 font-mono">{recipientCount} Contacts</Badge>
                            </div>
                            <Textarea 
                                value={job.emailList} 
                                onChange={e => updateJobData(activeAccount.id, { emailList: e.target.value })} 
                                className="flex-1 font-mono text-xs resize-none p-3 leading-relaxed" 
                                placeholder={`user@example.com\nanother@example.com`}
                                disabled={isWorking} 
                            />
                        </div>

                        <div className="pt-2 shrink-0">
                            {!isWorking ? (
                                <Button onClick={() => startJob(activeAccount.id, activeAccount.apiKey, 'loops')} className="w-full h-9 text-sm">
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

                <Card className="flex flex-col h-full overflow-hidden border-l-4 border-l-primary/20 shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row justify-between items-center space-y-0 shrink-0">
                        <CardTitle className="text-base font-semibold">Import Logs</CardTitle>
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
                            <div className="flex justify-between items-center text-[10px] mb-1">
                                <span className="text-muted-foreground flex items-center">
                                    Progress: {job.progress.current} / {job.progress.total}
                                    
                                    {/* --- DELAY COUNTDOWN BADGE --- */}
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
                                        <TableHead className="text-xs">Contact</TableHead>
                                        <TableHead className="text-xs">Status</TableHead>
                                        <TableHead className="text-right text-xs">Info</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {job.results.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-xs">
                                                {isWorking ? "Importing contacts..." : "No logs available."}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        job.results.slice().reverse().map((r, i) => (
                                            <TableRow key={i} className="h-9 hover:bg-muted/50 transition-colors">
                                                <TableCell className="text-xs font-mono text-muted-foreground">{job.results.length - i}</TableCell>
                                                <TableCell className="text-xs font-medium">{r.email}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={r.status === 'success' ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'}>
                                                        {r.status === 'success' ? 'Added' : 'Failed'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {/* --- RAW JSON INFO BUTTON --- */}
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-60 hover:opacity-100 transition-opacity" onClick={() => { setViewDetails(r); setIsDetailsOpen(true); }}>
                                                        <Info className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* --- RAW JSON DIALOG --- */}
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