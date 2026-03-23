import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Send, Square, Clock, Terminal, FileJson, CheckCircle, XCircle, Info, RefreshCw, Eye, ImagePlus, Pencil, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAccount } from '@/contexts/AccountContext';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useJob } from '@/contexts/JobContext';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PreviewDialog } from '@/components/PreviewDialog';
import { AddImageDialog } from '@/components/AddImageDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type FilterStatus = 'all' | 'success' | 'failed';
const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function BulkTransactionalSend() {
    const { activeAccount: selectedAccount } = useAccount();
    const { getActiveJobForAccount, addJob, pauseJob, resumeJob, stopJob } = useJob();

    // Config State
    const [recipientList, setRecipientList] = useState("");
    const [subject, setSubject] = useState("");
    const [htmlContent, setHtmlContent] = useState("");
    const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
    const [senders, setSenders] = useState<any[]>([]);
    const [delayInput, setDelayInput] = useState(1);
    const [isLoadingSenders, setIsLoadingSenders] = useState(false);

    // Edit Sender State
    const [isEditSenderOpen, setIsEditSenderOpen] = useState(false);
    const [newSenderName, setNewSenderName] = useState("");
    const [isUpdatingSender, setIsUpdatingSender] = useState(false);

    const htmlContentRef = useRef<HTMLTextAreaElement>(null);

    // View State
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [viewDetails, setViewDetails] = useState<any | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [now, setNow] = useState(Date.now());

    // Job Logic
    const currentJob = useMemo(() => {
        if (!selectedAccount) return null;
        return getActiveJobForAccount(selectedAccount.id, 'send');
    }, [selectedAccount, getActiveJobForAccount]);

    const isRunning = currentJob?.status === 'processing';
    const isPaused = currentJob?.status === 'paused';
    const isWorking = isRunning || isPaused;

    // --- Init & Persistence ---
    useEffect(() => {
        if (selectedAccount) {
            const draft = sessionStorage.getItem(`brevo_send_${selectedAccount.id}`);
            if (draft) {
                try {
                    const p = JSON.parse(draft);
                    setRecipientList(p.recipientList || "");
                    setSubject(p.subject || "");
                    setHtmlContent(p.htmlContent || "");
                    setSelectedSenderId(p.selectedSenderId || null);
                } catch(e) {}
            }
            fetchSenders();
        }
    }, [selectedAccount]);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const saveState = (updates: any) => {
        if (!selectedAccount) return;
        const current = {
            recipientList: updates.recipientList ?? recipientList,
            subject: updates.subject ?? subject,
            htmlContent: updates.htmlContent ?? htmlContent,
            selectedSenderId: updates.selectedSenderId ?? selectedSenderId
        };
        sessionStorage.setItem(`brevo_send_${selectedAccount.id}`, JSON.stringify(current));
    };

    const fetchSenders = async () => {
        if (!selectedAccount) return;
        setIsLoadingSenders(true);
        try {
            const res = await fetch('/api/brevo/senders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: selectedAccount.apiKey })
            });

            if (!res.ok) {
                // Try to parse error details
                const errData = await res.json().catch(() => ({}));
                const msg = errData.details?.message || errData.error || "Unknown Error";
                throw new Error(msg);
            }

            const data = await res.json();
            const active = (Array.isArray(data) ? data : []).filter((s: any) => s.active);
            setSenders(active);
        } catch (e: any) { 
            toast({ title: "Failed to load senders", description: e.message, variant: "destructive" });
        } finally { 
            setIsLoadingSenders(false); 
        }
    };

    // --- NEW: Update Sender Function ---
    const handleUpdateSender = async () => {
        if (!selectedAccount || !selectedSenderId || !newSenderName.trim()) return;

        setIsUpdatingSender(true);
        try {
            const res = await fetch(`/api/brevo/senders/${selectedSenderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    apiKey: selectedAccount.apiKey,
                    name: newSenderName.trim()
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to update");
            }

            toast({ title: "Success", description: "Sender name updated." });
            setIsEditSenderOpen(false);
            fetchSenders(); // Refresh list to show new name
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsUpdatingSender(false);
        }
    };

    const openEditSenderDialog = () => {
        const sender = senders.find(s => String(s.id) === String(selectedSenderId));
        if (sender) {
            setNewSenderName(sender.name);
            setIsEditSenderOpen(true);
        }
    };

    const handleStart = () => {
        if (!selectedAccount || !selectedSenderId || !subject || !htmlContent || !recipientList.trim()) return;

        const sender = senders.find(s => String(s.id) === String(selectedSenderId));
        const recipients = recipientList.split('\n').filter(l => l.trim()).map(line => {
            const [email, name] = line.split(',');
            return { email: email.trim(), name: name?.trim() };
        });

        const apiKey = selectedAccount.apiKey;

        addJob({
            title: `Send: ${subject}`,
            type: 'send', 
            totalItems: recipients.length,
            data: recipients,
            apiEndpoint: 'brevo-send',
            batchSize: 1,
            processItem: async (recipient) => {
                if (delayInput > 0) await new Promise(r => setTimeout(r, delayInput * 1000));
                
                const res = await fetch('/api/brevo/smtp/send-single', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        apiKey,
                        senderId: selectedSenderId,
                        to: recipient,
                        subject,
                        htmlContent
                    })
                });
                
                const data = await res.json();
                if (!res.ok) {
                    const errorDetails = data.details?.message || data.message || data.error || JSON.stringify(data);
                    throw new Error(errorDetails);
                }
                return { ...data, email: recipient.email };
            }
        }, selectedAccount.id);

        toast({ title: "Sending Started", description: `Sending to ${recipients.length} recipients.` });
    };

    const handleInsertImage = (img: string) => {
        setHtmlContent(prev => prev + img);
        saveState({ htmlContent: htmlContent + img });
    };

    const elapsedTime = useMemo(() => {
        if (!currentJob) return 0;
        const isDone = ['completed', 'failed', 'stopped'].includes(currentJob.status);
        const endTime = (isDone && currentJob.endTime) ? currentJob.endTime : now;
        let d = endTime - currentJob.startTime - (currentJob.totalPausedTime || 0);
        if (currentJob.status === 'paused' && currentJob.pauseStartTime) d -= (now - currentJob.pauseStartTime);
        return Math.max(0, Math.floor(d / 1000));
    }, [currentJob, now]);

    const filteredResults = useMemo(() => {
        if (!currentJob) return [];
        if (filter === 'all') return currentJob.results;
        return currentJob.results.filter(r => r.status === filter);
    }, [currentJob, filter]);

    const { successCount, errorCount } = useMemo(() => {
        if (!currentJob) return { successCount: 0, errorCount: 0 };
        return {
            successCount: currentJob.results.filter(r => r.status === 'success').length,
            errorCount: currentJob.results.filter(r => r.status === 'error' || r.status === 'failed').length,
        };
    }, [currentJob]);

    const progress = currentJob && currentJob.totalItems > 0 ? (currentJob.processedItems / currentJob.totalItems) * 100 : 0;
    const recipientCount = recipientList.split('\n').filter(x => x.trim()).length;

    const getDialogContent = () => {
        if (!viewDetails) return "{}";
        if (viewDetails.status === 'failed' || viewDetails.status === 'error') {
            try { return JSON.stringify(JSON.parse(viewDetails.error), null, 2); } 
            catch (e) { return viewDetails.error || "Unknown Error"; }
        }
        return JSON.stringify(viewDetails.data || {}, null, 2);
    };

    return (
        <div className="p-4 max-w-[1400px] mx-auto animate-in fade-in duration-500 h-[calc(100vh-60px)] flex flex-col">
            <div className="flex items-center gap-2 mb-3 shrink-0">
                <div className="p-1.5 bg-primary/10 rounded-lg"><Send className="h-5 w-5 text-primary" /></div>
                <div><h1 className="text-lg font-bold tracking-tight">Bulk Send</h1><p className="text-xs text-muted-foreground">Transactional emails via SMTP.</p></div>
            </div>

            {!selectedAccount && <Alert variant="destructive" className="mb-3 py-2 px-3 shrink-0"><Terminal className="h-4 w-4" /><AlertTitle className="text-sm font-semibold">No Account</AlertTitle><AlertDescription className="text-xs">Select an account.</AlertDescription></Alert>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                {/* LEFT: Config */}
                <Card className="flex flex-col h-full overflow-hidden">
                    <CardHeader className="py-2 px-4 border-b bg-muted/20"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Terminal className="h-3.5 w-3.5" /> Email Configuration</CardTitle></CardHeader>
                    <CardContent className="flex-1 flex flex-col p-3 space-y-3 overflow-y-auto">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2 space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Sender</Label>
                                <div className="flex gap-2">
                                    <Select value={selectedSenderId || ""} onValueChange={(v) => { setSelectedSenderId(v); saveState({ selectedSenderId: v }); }} disabled={isWorking || !selectedAccount}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Sender" /></SelectTrigger>
                                        <SelectContent>{senders.map(s => <SelectItem key={s.id} value={String(s.id)} className="text-xs">{s.name} ({s.email})</SelectItem>)}</SelectContent>
                                    </Select>
                                    
                                    {/* Refresh Button */}
                                    <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => fetchSenders()} disabled={isWorking}><RefreshCw className={`h-3.5 w-3.5 ${isLoadingSenders ? "animate-spin" : ""}`} /></Button>
                                    
                                    {/* --- NEW: Edit Button --- */}
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="h-8 w-8 shrink-0" 
                                        onClick={openEditSenderDialog} 
                                        disabled={!selectedSenderId || isWorking}
                                        title="Rename Sender"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Delay (s)</Label>
                                <Input type="number" className="h-8 text-xs" value={delayInput} onChange={e => setDelayInput(parseFloat(e.target.value))} disabled={isWorking} />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Subject</Label>
                            <Input className="h-8 text-xs" value={subject} onChange={e => { setSubject(e.target.value); saveState({ subject: e.target.value }); }} disabled={isWorking} />
                        </div>

                        <div className="space-y-1 flex-1 flex flex-col min-h-[120px]">
                            <div className="flex justify-between items-center">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">HTML Content</Label>
                                <div className="flex gap-2">
                                    <AddImageDialog onInsertImage={handleInsertImage}><Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 hover:bg-muted"><ImagePlus className="w-3 h-3 mr-1" /> Image</Button></AddImageDialog>
                                    <PreviewDialog htmlContent={htmlContent}><Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 hover:bg-muted"><Eye className="w-3 h-3 mr-1" /> Preview</Button></PreviewDialog>
                                </div>
                            </div>
                            <Textarea ref={htmlContentRef} value={htmlContent} onChange={e => { setHtmlContent(e.target.value); saveState({ htmlContent: e.target.value }); }} className="flex-1 font-mono text-[10px] leading-tight resize-none p-2" disabled={isWorking} />
                        </div>

                        <div className="space-y-1 h-[80px] shrink-0">
                            <div className="flex justify-between items-end">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Recipients (email,name)</Label>
                                <span className="text-[10px] text-muted-foreground">{recipientCount} count</span>
                            </div>
                            <Textarea value={recipientList} onChange={e => { setRecipientList(e.target.value); saveState({ recipientList: e.target.value }); }} className="h-full font-mono text-[10px] leading-tight resize-none p-2" placeholder="user@example.com,John" disabled={isWorking} />
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <Button size="sm" onClick={handleStart} disabled={!selectedAccount || isWorking || !selectedSenderId || !subject} className="w-full h-8 text-xs"><Send className="h-3.5 w-3.5 mr-2" /> Send Emails</Button>
                            {isWorking ? (
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => isPaused ? resumeJob(currentJob!.id) : pauseJob(currentJob!.id)} variant="secondary" className="flex-1 h-8 text-xs"><Clock className="h-3.5 w-3.5 mr-2" /> {isPaused ? 'Resume' : 'Pause'}</Button>
                                    <Button size="sm" onClick={() => stopJob(currentJob!.id)} variant="destructive" className="h-8 w-8 p-0 shrink-0"><Square className="h-3.5 w-3.5" /></Button>
                                </div>
                            ) : <Button size="sm" variant="secondary" disabled className="w-full h-8 text-xs opacity-50"><Clock className="h-3.5 w-3.5 mr-2" /> Stop</Button>}
                        </div>
                    </CardContent>
                </Card>

                {/* RIGHT: Results */}
                <Card className="flex flex-col h-full overflow-hidden border-l-4 border-l-primary/20">
                    <CardHeader className="py-2 px-4 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2"><FileJson className="h-3.5 w-3.5" /> Results</CardTitle>
                        <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as FilterStatus)} size="sm" className="bg-background border rounded-md h-7">
                            <ToggleGroupItem value="all" className="h-6 text-[10px] px-2">All</ToggleGroupItem>
                            <ToggleGroupItem value="success" className="h-6 text-[10px] px-2 text-green-600">Success</ToggleGroupItem>
                            <ToggleGroupItem value="failed" className="h-6 text-[10px] px-2 text-red-600">Failed</ToggleGroupItem>
                        </ToggleGroup>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                        <div className="grid grid-cols-3 divide-x border-b bg-muted/10">
                            <div className="p-2 text-center"><div className="text-[9px] uppercase text-muted-foreground font-bold">Time</div><div className="text-sm font-mono">{formatTime(elapsedTime)}</div></div>
                            <div className="p-2 text-center"><div className="text-[9px] uppercase text-muted-foreground font-bold">Success</div><div className="text-sm font-bold text-green-600">{successCount}</div></div>
                            <div className="p-2 text-center"><div className="text-[9px] uppercase text-muted-foreground font-bold">Failed</div><div className="text-sm font-bold text-red-600">{errorCount}</div></div>
                        </div>

                        <div className="px-3 py-2 border-b">
                            <div className="flex justify-between text-[10px] mb-1.5">
                                <span className="text-muted-foreground">
                                    Progress: <span className="text-foreground font-medium">{currentJob?.processedItems || 0} / {currentJob?.totalItems || 0}</span>
                                </span>
                                {isPaused && <Badge variant="outline" className="text-yellow-600 border-yellow-200 h-4 px-1 text-[9px]">Paused</Badge>}
                            </div>
                            <Progress value={progress} className="h-1" />
                        </div>

                        <div className="flex-1 overflow-auto bg-slate-50/50">
                            <Table>
                                <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                                    <TableRow className="h-8 hover:bg-background">
                                        <TableHead className="w-[40px] text-[10px] h-8">#</TableHead>
                                        <TableHead className="text-[10px] h-8">Email</TableHead>
                                        <TableHead className="w-[80px] text-[10px] h-8">Status</TableHead>
                                        <TableHead className="w-[50px] text-[10px] text-right h-8">Info</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredResults.length > 0 ? filteredResults.slice().reverse().map((r, i) => (
                                        <TableRow key={i} className="h-8">
                                            <TableCell className="text-[10px] text-muted-foreground py-1">{filteredResults.length - i}</TableCell>
                                            <TableCell className="text-[10px] font-medium py-1 truncate max-w-[150px]">{r.data?.email}</TableCell>
                                            <TableCell className="py-1"><Badge variant="outline" className={`text-[9px] h-4 px-1 gap-1 ${r.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{r.status === 'success' ? <CheckCircle className="h-2 w-2" /> : <XCircle className="h-2 w-2" />}{r.status === 'success' ? 'OK' : 'Fail'}</Badge></TableCell>
                                            <TableCell className="text-right py-1"><Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-primary/10" onClick={() => { setViewDetails(r); setIsDetailsOpen(true); }}><Info className="h-3 w-3" /></Button></TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={4} className="h-24 text-center text-[10px] text-muted-foreground">{isWorking ? "Processing..." : "No logs."}</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Response Details</DialogTitle></DialogHeader>
                    <ScrollArea className="h-[300px] w-full border p-4 bg-slate-950 text-slate-50 rounded-md">
                        {/* --- THE FIX: Showing the WHOLE object, not just .data --- */}
                        <pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(viewDetails || {}, null, 2)}</pre>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* --- NEW: Edit Sender Dialog --- */}
            <Dialog open={isEditSenderOpen} onOpenChange={setIsEditSenderOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Sender Name</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="senderName" className="text-right">Name</Label>
                            <Input id="senderName" value={newSenderName} onChange={(e) => setNewSenderName(e.target.value)} className="col-span-3" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditSenderOpen(false)} disabled={isUpdatingSender}>Cancel</Button>
                        <Button onClick={handleUpdateSender} disabled={isUpdatingSender || !newSenderName.trim()}>
                            {isUpdatingSender && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};