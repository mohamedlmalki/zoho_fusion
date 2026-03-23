import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Play, Pause, Square, Clock, Terminal, Download, CheckCircle, XCircle, Info, FileJson } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAccount } from '@/contexts/AccountContext';
import { useJob } from '@/contexts/JobContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// Types
type FilterStatus = 'all' | 'success' | 'failed';

// Helper to format time
const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const OmnisendBulkImport = () => {
    const { activeAccount: selectedAccount } = useAccount();
    const { getActiveJobForAccount, startJob, addJob, pauseJob, resumeJob, stopJob, removeJob } = useJob();

    // Local State
    const [emailListInput, setEmailListInput] = useState('');
    const [delayInput, setDelayInput] = useState(1);
    const [defaultName, setDefaultName] = useState(''); // <--- NEW STATE
    const [filter, setFilter] = useState<FilterStatus>('all');
    
    // Details Dialog State
    const [viewDetails, setViewDetails] = useState<any | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    
    // Ticker for live time updates
    const [now, setNow] = useState(Date.now());

    // Job Logic
    const currentJob = useMemo(() => {
        if (!selectedAccount) return null;
        return getActiveJobForAccount(selectedAccount.id);
    }, [selectedAccount, getActiveJobForAccount]);

    const isRunning = currentJob?.status === 'processing';
    const isPaused = currentJob?.status === 'paused';
    const isWorking = isRunning || isPaused;

    // --- 1. PERSISTENCE LOGIC ---
    useEffect(() => {
        if (selectedAccount) {
            // Restore Delay if job exists
            if (currentJob && currentJob.delay) { 
                setDelayInput(currentJob.delay);
            }
            
            // Restore draft text & default name from Session Storage
            const savedDraft = sessionStorage.getItem(`omnisend_draft_${selectedAccount.id}`);
            if (savedDraft) {
                try {
                    const parsed = JSON.parse(savedDraft);
                    setEmailListInput(parsed.text || "");
                    if (parsed.defaultName) setDefaultName(parsed.defaultName);
                } catch (e) {
                    // Fallback for old plain text drafts
                    setEmailListInput(savedDraft);
                }
            } else {
                setEmailListInput('');
            }
        } else {
            setEmailListInput('');
        }
    }, [selectedAccount?.id]); 

    // Timer Interval
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    
    // --- 2. FIXED ELAPSED TIME CALCULATION ---
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

    const emailCount = useMemo(() => emailListInput.split(/[\n,;]+/).filter(Boolean).length, [emailListInput]);

    // Handlers
    const saveState = (text: string, name: string) => {
        if (!selectedAccount) return;
        sessionStorage.setItem(`omnisend_draft_${selectedAccount.id}`, JSON.stringify({ 
            text, 
            defaultName: name 
        }));
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setEmailListInput(newValue);
        saveState(newValue, defaultName);
    };

    const handleDefaultNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setDefaultName(newVal);
        saveState(emailListInput, newVal);
    };
    
    const handleStartImport = () => {
        if (!selectedAccount) {
            toast({ title: 'Error', description: 'Please select an account first.', variant: "destructive" });
            return;
        }
        if (!emailListInput.trim()) {
            toast({ title: 'Error', description: 'Please provide at least one email address.', variant: "destructive" });
            return;
        }
        
        // Prepare Data
        const contacts = emailListInput.split('\n').filter(l => l.trim()).map(line => {
            // Supports: email, firstname, lastname
            const parts = line.split(/[,\t;]/).map(s => s.trim());
            const email = parts[0];
            // Use provided name OR fallback to defaultName
            const firstName = parts[1] ? parts[1] : defaultName; 
            const lastName = parts[2] || undefined;

            return { email, firstName, lastName };
        });

        const apiKey = selectedAccount.apiKey;

        addJob({
            title: `Omnisend Import`,
            totalItems: contacts.length,
            data: contacts,
            apiEndpoint: 'omnisend',
            batchSize: 1,
            processItem: async (contact) => {
                if (delayInput > 0) await new Promise(r => setTimeout(r, delayInput * 1000));
                
                const res = await fetch('/api/omnisend/import/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey, contact })
                });
                
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed");
                return { ...data, email: contact.email };
            }
        }, selectedAccount.id);
        
        toast({ title: 'Job Started', description: `Starting import for ${selectedAccount.name}...` });
    };

    const handleStopJob = () => {
        if (!currentJob) return;
        stopJob(currentJob.id);
        toast({ title: 'Job Stopped', description: `Import has been stopped.` });
    };

    const handleExport = () => {
        const emailsToExport = filteredResults.map(result => result.data?.email || result.data?.contact?.email).join('\n');
        if (!emailsToExport) {
            toast({ title: 'Export Failed', description: "No emails to export.", variant: "destructive" });
            return;
        }
        const blob = new Blob([emailsToExport], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `omnisend_export_${selectedAccount?.name}_${filter}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredResults = useMemo(() => {
        if (!currentJob) return [];
        if (filter === 'all') return currentJob.results;
        return currentJob.results.filter(result => result.status === filter);
    }, [currentJob, filter]);

    const { successCount, errorCount } = useMemo(() => {
        if (!currentJob) return { successCount: 0, errorCount: 0 };
        return {
            successCount: currentJob.results.filter(r => r.status === 'success').length,
            errorCount: currentJob.results.filter(r => r.status === 'error' || r.status === 'failed').length,
        };
    }, [currentJob]);

    const progress = currentJob && currentJob.totalItems > 0 ? (currentJob.processedItems / currentJob.totalItems) * 100 : 0;

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 h-[calc(100vh-60px)] flex flex-col">
            <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Omnisend Bulk Import</h1>
                    <p className="text-sm text-muted-foreground">Manage your subscriber imports directly.</p>
                </div>
            </div>

            {!selectedAccount && (
                <Alert variant="destructive" className="mb-6 shrink-0">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>No Account Selected</AlertTitle>
                    <AlertDescription>Please select an account from the sidebar.</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                
                {/* LEFT COLUMN: Input & Configuration */}
                <Card className="flex flex-col h-full overflow-hidden">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Terminal className="h-4 w-4" /> Import Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
                        
                        <div className="space-y-4 shrink-0">
                            {/* SETTINGS GRID */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Default Name Input */}
                                <div>
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">First Name</Label>
                                    <Input
                                        value={defaultName}
                                        onChange={handleDefaultNameChange}
                                        placeholder=""
                                        className="h-9"
                                        disabled={isWorking}
                                    />
                                </div>

                                {/* Delay Input */}
                                <div>
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Delay (s)</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min="0.1"
                                            step="0.1"
                                            value={delayInput}
                                            onChange={(e) => setDelayInput(Math.max(0, parseFloat(e.target.value)))}
                                            className="h-9"
                                            disabled={isWorking}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Textarea Section */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <Label htmlFor="emailList" className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
                                Emails (email, firstname, lastname)
                            </Label>
                            <Textarea
                                id="emailList"
                                placeholder="user1@example.com&#10;user2@example.com,John&#10;user3@example.com,Jane,Doe"
                                className="flex-1 resize-none font-mono text-sm leading-relaxed"
                                value={emailListInput}
                                onChange={handleTextareaChange}
                                disabled={isWorking}
                            />
                            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                                <span>Detected: <strong className="text-foreground">{emailCount}</strong></span>
                                <span>Use new lines for each contact.</span>
                            </div>
                        </div>

                        <Separator />

                        {/* Controls */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button 
                                onClick={handleStartImport} 
                                disabled={!selectedAccount || isWorking} 
                                className="w-full"
                            >
                                <Play className="h-4 w-4 mr-2" /> Start Import
                            </Button>
                            
                            {isWorking ? (
                                <div className="flex gap-2">
                                    <Button 
                                        onClick={() => isPaused ? resumeJob(currentJob!.id) : pauseJob(currentJob!.id)} 
                                        variant="secondary" 
                                        className="flex-1"
                                    >
                                        <Clock className="h-4 w-4 mr-2" /> {isPaused ? 'Resume' : 'Pause'}
                                    </Button>
                                    <Button 
                                        onClick={handleStopJob} 
                                        variant="destructive"
                                        size="icon"
                                    >
                                        <Square className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Button variant="secondary" disabled className="w-full opacity-50 cursor-not-allowed">
                                    <Clock className="h-4 w-4 mr-2" /> Pause / Stop
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* RIGHT COLUMN: Results & Table */}
                <Card className="flex flex-col h-full overflow-hidden border-l-4 border-l-primary/20">
                    <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <FileJson className="h-4 w-4" /> Import Results
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as FilterStatus)} size="sm" className="bg-background border rounded-md">
                                <ToggleGroupItem value="all" className="h-7 text-xs px-2">All</ToggleGroupItem>
                                <ToggleGroupItem value="success" className="h-7 text-xs px-2 text-green-600">Success</ToggleGroupItem>
                                <ToggleGroupItem value="failed" className="h-7 text-xs px-2 text-red-600">Failed</ToggleGroupItem>
                            </ToggleGroup>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleExport}>
                                <Download className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </CardHeader>
                    
                    <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                        
                        {/* Stats Dashboard */}
                        <div className="grid grid-cols-3 divide-x border-b bg-muted/10">
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Time Elapsed</div>
                                <div className="text-lg font-mono font-medium">{formatTime(elapsedTime)}</div>
                            </div>
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Success</div>
                                <div className="text-lg font-bold text-green-600">{successCount}</div>
                            </div>
                            <div className="p-3 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Failed</div>
                                <div className="text-lg font-bold text-red-600">{errorCount}</div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="px-4 py-3 border-b">
                            <div className="flex justify-between text-xs mb-2">
                                <span className="text-muted-foreground">
                                    Progress: <span className="text-foreground font-medium">{currentJob?.processedItems || 0} / {currentJob?.totalItems || 0}</span>
                                </span>
                                {isPaused && <Badge variant="outline" className="text-yellow-600 border-yellow-200 h-5 px-1">Paused</Badge>}
                            </div>
                            <Progress value={progress} className="h-1.5" />
                        </div>

                        {/* Results Table */}
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
                                                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 h-5 px-1.5 gap-1">
                                                        <CheckCircle className="h-2.5 w-2.5" /> OK
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 h-5 px-1.5 gap-1">
                                                        <XCircle className="h-2.5 w-2.5" /> Fail
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right py-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
                                                    onClick={() => { setViewDetails(result); setIsDetailsOpen(true); }}
                                                >
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

            {/* Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileJson className="h-5 w-5 text-primary" /> Response Details
                        </DialogTitle>
                        <DialogDescription>
                            API Response for <b>{viewDetails?.data?.email || 'Contact'}</b>
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-slate-950 text-slate-50">
                        {/* --- FIXED: PRETTY-PRINTING THE ACTUAL API ERROR --- */}
                        <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                            {JSON.stringify(
                                viewDetails?.status === 'error' || viewDetails?.status === 'failed'
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
};

export default OmnisendBulkImport;