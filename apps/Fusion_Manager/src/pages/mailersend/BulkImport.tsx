import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Send, Play, Clock, Terminal, Download, CheckCircle, XCircle, Info, FileJson, Square, Image as ImageIcon, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAccount } from '@/contexts/AccountContext';
import { useJob } from '@/contexts/JobContext'; 
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FilterStatus = 'all' | 'success' | 'error';

const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function MailersendBulkImport() {
    const { activeAccount } = useAccount();
    const { getActiveJobForAccount, addJob, pauseJob, resumeJob, stopJob } = useJob();

    // Local State
    const [emailListInput, setEmailListInput] = useState('');
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [fromEmail, setFromEmail] = useState('');
    const [fromName, setFromName] = useState('');
    
    // Delay and Error Threshold State
    const [delayInput, setDelayInput] = useState(1);
    const [errorThreshold, setErrorThreshold] = useState(10); 

    const [filter, setFilter] = useState<FilterStatus>('all');
    
    // Details & Preview Dialogs
    const [viewDetails, setViewDetails] = useState<any | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    
    // Image Insert Dialog
    const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [imageLink, setImageLink] = useState('');
    const [imageSize, setImageSize] = useState('100%');
    const [imageAlign, setImageAlign] = useState('center');
    const contentRef = useRef<HTMLTextAreaElement>(null);

    const [now, setNow] = useState(Date.now());

    // Sync defaults and CLEAR form when switching accounts
    useEffect(() => {
        // Wipe the form fields clean
        setEmailListInput('');
        setSubject('');
        setContent('');
        setFromName('');
        
        // Set default from email if the new account has one, otherwise clear it
        if (activeAccount?.defaultFrom) {
            setFromEmail(activeAccount.defaultFrom);
        } else {
            setFromEmail('');
        }
    }, [activeAccount?.id]); // This ensures it runs every time the Account ID changes

    // Job Logic
    const currentJob = useMemo(() => {
        if (!activeAccount) return null;
        return getActiveJobForAccount(activeAccount.id, 'mailersend_bulk');
    }, [activeAccount, getActiveJobForAccount]);

    const isWorking = currentJob?.status === 'processing' || currentJob?.status === 'paused';
    const isPaused = currentJob?.status === 'paused';

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    
    const elapsedTime = useMemo(() => {
        if (!currentJob) return 0;
        const isDone = ['completed', 'failed', 'stopped'].includes(currentJob.status);
        const endTime = (isDone && currentJob.endTime) ? currentJob.endTime : now;
        let duration = endTime - currentJob.startTime;
        duration -= (currentJob.totalPausedTime || 0);
        if (currentJob.status === 'paused' && currentJob.pauseStartTime) {
            duration -= (now - currentJob.pauseStartTime);
        }
        return Math.max(0, Math.floor(duration / 1000));
    }, [currentJob, now]);

    const emailCount = useMemo(() => emailListInput.split(/[\n,]+/).filter(l => l.trim().includes('@')).length, [emailListInput]);

    const handleInsertImage = () => {
        if (!imageUrl) return toast({ title: "Error", description: "Image URL is required", variant: "destructive" });
        let imgTag = `<img src="${imageUrl}" alt="Image" style="max-width: 100%; width: ${imageSize}; height: auto;" />`;
        if (imageLink) imgTag = `<a href="${imageLink}" target="_blank">${imgTag}</a>`;
        const wrapper = `<div style="text-align: ${imageAlign}; margin: 10px 0;">${imgTag}</div>`;

        if (contentRef.current) {
            const start = contentRef.current.selectionStart;
            const end = contentRef.current.selectionEnd;
            setContent(content.substring(0, start) + wrapper + content.substring(end));
        } else {
            setContent(prev => prev + wrapper);
        }
        setIsImageDialogOpen(false);
    };

    const handleStartImport = () => {
        if (!activeAccount) return toast({ title: 'Error', description: 'Select an account.', variant: "destructive" });
        if (!emailListInput.trim() || !subject || !content || !fromEmail) {
            return toast({ title: 'Error', description: 'Please fill all required fields.', variant: "destructive" });
        }
        
        const contacts = emailListInput.split(/[\n]+/).filter(l => l.trim().includes('@')).map(line => {
            const [email, name] = line.split(',');
            return { email: email?.trim(), name: name?.trim() || '' };
        });

        const currentApiKey = activeAccount.apiKey;

        addJob({
            title: `MailerSend Bulk Campaign`,
            type: 'mailersend_bulk',
            totalItems: contacts.length,
            data: contacts,
            apiEndpoint: 'mailersend',
            batchSize: 1,
            errorThreshold: errorThreshold, 
            processItem: async (contact) => {
                if (delayInput > 0) await new Promise(r => setTimeout(r, delayInput * 1000));
                
                const res = await fetch('/api/mailersend/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        apiKey: currentApiKey,
                        to: contact.email,
                        subject: subject,
                        content: content,
                        fromEmail: fromEmail,
                        fromName: fromName
                    })
                });
                
                const data = await res.json();
                if (!res.ok || data.success === false) throw new Error(JSON.stringify(data.details || data.error || "Failed"));
                return { ...data, email: contact.email };
            }
        }, activeAccount.id);
        
        toast({ title: 'Job Started', description: `Sending campaign via ${activeAccount.name}...` });
    };

    const handleExport = () => {
        const emailsToExport = filteredResults.map(result => result.data?.email).join('\n');
        if (!emailsToExport) return toast({ title: 'Export Failed', description: "No emails to export.", variant: "destructive" });
        const blob = new Blob([emailsToExport], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `mailersend_export_${activeAccount?.name}_${filter}.txt`;
        document.body.appendChild(link);
        link.click();
    };

    const filteredResults = useMemo(() => {
        if (!currentJob) return [];
        if (filter === 'all') return currentJob.results;
        return currentJob.results.filter(result => result.status === filter);
    }, [currentJob, filter]);

    const progress = currentJob && currentJob.totalItems > 0 ? (currentJob.processedItems / currentJob.totalItems) * 100 : 0;

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 h-[calc(100vh-60px)] flex flex-col">
            <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <Send className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">MailerSend Bulk Campaign</h1>
                    <p className="text-sm text-muted-foreground">Send bulk emails dynamically.</p>
                </div>
            </div>

            {!activeAccount && (
                <Alert variant="destructive" className="mb-6 shrink-0">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>No Account Selected</AlertTitle>
                    <AlertDescription>Please select a MailerSend account from the sidebar.</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                <Card className="flex flex-col h-full overflow-hidden">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Terminal className="h-4 w-4" /> Campaign Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">From Name</Label>
                                <Input value={fromName} onChange={e => setFromName(e.target.value)} disabled={isWorking} className="h-8 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">From Email *</Label>
                                <Input value={fromEmail} onChange={e => setFromEmail(e.target.value)} disabled={isWorking} className="h-8 text-sm" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Delay (Seconds)</Label>
                                <Input type="number" min="0" value={delayInput} onChange={e => setDelayInput(Number(e.target.value))} disabled={isWorking} className="h-8 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Stop After X Fails</Label>
                                <Input type="number" min="0" value={errorThreshold} onChange={e => setErrorThreshold(Number(e.target.value))} disabled={isWorking} className="h-8 text-sm" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Subject *</Label>
                            <Input value={subject} onChange={e => setSubject(e.target.value)} disabled={isWorking} className="h-8 text-sm" />
                        </div>

                        <div className="space-y-1.5 flex-1 flex flex-col min-h-[150px]">
                            <div className="flex justify-between items-center mb-1">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">HTML Content *</Label>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => setIsImageDialogOpen(true)} disabled={isWorking}>
                                        <ImageIcon className="w-3 h-3 mr-1" /> Image
                                    </Button>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" disabled={isWorking}>
                                                <Eye className="w-3 h-3 mr-1" /> Preview
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-white text-black">
                                            <div dangerouslySetInnerHTML={{ __html: content }} />
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                            <Textarea ref={contentRef} value={content} onChange={e => setContent(e.target.value)} disabled={isWorking} className="flex-1 resize-none font-mono text-xs" />
                        </div>

                        <div className="space-y-1.5 flex-1 flex flex-col min-h-[100px]">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Recipients (Email,Name)</Label>
                            <Textarea value={emailListInput} onChange={e => setEmailListInput(e.target.value)} disabled={isWorking} className="flex-1 resize-none font-mono text-xs" />
                            <div className="text-xs text-muted-foreground">Detected: {emailCount} emails</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button onClick={handleStartImport} disabled={!activeAccount || isWorking} className="w-full">
                                <Play className="h-4 w-4 mr-2" /> Start Campaign
                            </Button>
                            {isWorking ? (
                                <div className="flex gap-2">
                                    <Button onClick={() => isPaused ? resumeJob(currentJob!.id) : pauseJob(currentJob!.id)} variant="secondary" className="flex-1">
                                        <Clock className="h-4 w-4 mr-2" /> {isPaused ? 'Resume' : 'Pause'}
                                    </Button>
                                    <Button onClick={() => stopJob(currentJob!.id)} variant="destructive" size="icon">
                                        <Square className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Button variant="secondary" disabled className="w-full opacity-50"> Pause / Stop </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Right Column: Results Table (Same as System.io layout) */}
                <Card className="flex flex-col h-full overflow-hidden border-l-4 border-l-primary/20">
                    <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <FileJson className="h-4 w-4" /> Sending Logs
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as FilterStatus)} size="sm" className="bg-background border rounded-md">
                                <ToggleGroupItem value="all" className="h-7 text-xs px-2">All</ToggleGroupItem>
                                <ToggleGroupItem value="success" className="h-7 text-xs px-2 text-green-600">Success</ToggleGroupItem>
                                <ToggleGroupItem value="error" className="h-7 text-xs px-2 text-red-600">Failed</ToggleGroupItem>
                            </ToggleGroup>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleExport}>
                                <Download className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </CardHeader>
                    
                    <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                        <div className="grid grid-cols-3 divide-x border-b bg-muted/10">
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Time Elapsed</div>
                                <div className="text-lg font-mono font-medium">{formatTime(elapsedTime)}</div>
                            </div>
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Success</div>
                                <div className="text-lg font-bold text-green-600">{currentJob?.processedItems! - currentJob?.failedItems! || 0}</div>
                            </div>
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Failed</div>
                                <div className="text-lg font-bold text-red-600">{currentJob?.failedItems || 0}</div>
                            </div>
                        </div>

                        <div className="px-4 py-3 border-b">
                            <div className="flex justify-between text-xs mb-2">
                                <span className="text-muted-foreground">Progress: <span className="text-foreground font-medium">{currentJob?.processedItems || 0} / {currentJob?.totalItems || 0}</span></span>
                            </div>
                            <Progress value={progress} className="h-1.5" />
                        </div>

                        <div className="flex-1 overflow-auto bg-slate-50/50">
                            <Table>
                                <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                                    <TableRow className="h-9 hover:bg-background">
                                        <TableHead className="w-[50px] text-xs">#</TableHead>
                                        <TableHead className="text-xs">Email</TableHead>
                                        <TableHead className="w-[100px] text-xs">Status</TableHead>
                                        <TableHead className="w-[60px] text-xs text-right">Info</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredResults.length > 0 ? filteredResults.slice().reverse().map((result, idx) => (
                                        <TableRow key={idx} className="h-9">
                                            <TableCell className="text-xs font-mono text-muted-foreground py-1">{filteredResults.length - idx}</TableCell>
                                            <TableCell className="text-xs font-medium py-1">{result.data?.email || 'Unknown'}</TableCell>
                                            <TableCell className="py-1">
                                                {result.status === 'success' ? (
                                                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 h-5 px-1.5"><CheckCircle className="h-2.5 w-2.5 mr-1" /> OK</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 h-5 px-1.5"><XCircle className="h-2.5 w-2.5 mr-1" /> Fail</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right py-1">
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setViewDetails(result); setIsDetailsOpen(true); }}>
                                                    <Info className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-xs">{isWorking ? "Waiting for results..." : "No logs available."}</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Dialogs */}
            <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Insert Image</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Input placeholder="Image URL" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
                        <Input placeholder="Link URL (Optional)" value={imageLink} onChange={e => setImageLink(e.target.value)} />
                        <div className="grid grid-cols-2 gap-4">
                            <Input placeholder="Size (e.g. 100%)" value={imageSize} onChange={e => setImageSize(e.target.value)} />
                            <Select value={imageAlign} onValueChange={setImageAlign}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleInsertImage}>Insert</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Response Details</DialogTitle></DialogHeader>
                    <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-slate-950 text-slate-50">
                        {/* --- FIXED: PRETTY-PRINTING THE ACTUAL API ERROR --- */}
                        <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                            {JSON.stringify(
                                viewDetails?.status === 'error' 
                                  ? { 
                                      status: "FAILED", 
                                      api_error: (() => {
                                          try { return JSON.parse(viewDetails.error); } 
                                          catch { return viewDetails.error; }
                                      })(),
                                      recipient: viewDetails.data 
                                    } 
                                  : viewDetails?.data || {}, 
                                null, 
                                2
                            )}
                        </pre>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}