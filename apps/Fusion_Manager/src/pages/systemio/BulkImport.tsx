import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Play, Clock, Terminal, Download, CheckCircle, XCircle, Info, FileJson, RefreshCw, Square, Tag } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAccount } from '@/contexts/AccountContext';
import { useJob } from '@/contexts/JobContext'; 
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Types
type FilterStatus = 'all' | 'success' | 'failed';

// Helper to format time
const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const SystemIoBulkImport = () => {
    const { activeAccount: selectedAccount } = useAccount();
    const { getActiveJobForAccount, addJob, pauseJob, resumeJob, stopJob } = useJob();

    // Local State
    const [emailListInput, setEmailListInput] = useState('');
    const [delayInput, setDelayInput] = useState(1);
    const [filter, setFilter] = useState<FilterStatus>('all');
    
    // System.io Specific State
    const [tags, setTags] = useState<any[]>([]);
    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [selectedTag, setSelectedTag] = useState<string>('no-tag');
    const [defaultFirstName, setDefaultFirstName] = useState("");
    
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

    // --- 1. PERSISTENCE & INIT LOGIC ---
    useEffect(() => {
        if (selectedAccount) {
            // Restore from Session Storage
            const savedDraft = sessionStorage.getItem(`sio_draft_${selectedAccount.id}`);
            if (savedDraft) {
                try {
                    const parsed = JSON.parse(savedDraft);
                    setEmailListInput(parsed.importData || "");
                    setSelectedTag(parsed.selectedTag || "no-tag");
                    setDefaultFirstName(parsed.defaultFirstName || "");
                } catch (e) { console.error(e); }
            } else {
                setEmailListInput("");
                setSelectedTag("no-tag");
                setDefaultFirstName("");
            }
            
            // Fetch Tags
            fetchTags();
        } 
    }, [selectedAccount?.id]); 

    // Timer Interval
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    
    // --- 2. ELAPSED TIME CALCULATION ---
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

    const emailCount = useMemo(() => emailListInput.split(/[\n,]+/).filter(l => l.trim()).length, [emailListInput]);

    // --- API HELPERS ---
    const fetchTags = async () => {
        if (!selectedAccount || !selectedAccount.apiKey) return;
        setIsLoadingTags(true);
        try {
          const res = await fetch('/api/systemio/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                apiKey: selectedAccount.apiKey
            })
          });
          
          if (!res.ok) throw new Error("Failed to fetch tags");

          const data = await res.json();
          const rawTags = Array.isArray(data) ? data : (data.items || []);
          
          const normalizedTags = rawTags.map((t: any) => ({
              id: String(t.id),
              name: t.name || "Unnamed Tag"
          }));

          setTags(normalizedTags);
        } catch (error) {
          console.error("Failed to load tags:", error);
          toast({ title: "Error", description: "Could not load tags from System.io.", variant: "destructive" });
        } finally {
            setIsLoadingTags(false);
        }
    };

    // Handlers (with Persistence)
    const saveState = (updates: any) => {
        if (!selectedAccount) return;
        const currentState = { 
            importData: updates.importData !== undefined ? updates.importData : emailListInput,
            selectedTag: updates.selectedTag !== undefined ? updates.selectedTag : selectedTag,
            defaultFirstName: updates.defaultFirstName !== undefined ? updates.defaultFirstName : defaultFirstName
        };
        sessionStorage.setItem(`sio_draft_${selectedAccount.id}`, JSON.stringify(currentState));
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setEmailListInput(val);
        saveState({ importData: val });
    };

    const handleTagChange = (val: string) => {
        setSelectedTag(val);
        saveState({ selectedTag: val });
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setDefaultFirstName(val);
        saveState({ defaultFirstName: val });
    };
    
    const handleStartImport = () => {
        if (!selectedAccount) {
            toast({ title: 'Error', description: 'Please select an account first.', variant: "destructive" });
            return;
        }
        if (!emailListInput.trim()) {
            toast({ title: 'Error', description: 'Please provide emails.', variant: "destructive" });
            return;
        }
        
        const selectedTagName = tags.find(t => String(t.id) === String(selectedTag))?.name || 'No Tag';

        // Prepare Data (parsing "email,name" format)
        const contacts = emailListInput.split(/[\n]+/).filter(l => l.trim()).map(line => {
            const [email, name] = line.split(',');
            return {
                email: email?.trim(),
                firstName: name?.trim() || defaultFirstName,
                tagId: selectedTag // Store intent to tag
            };
        });

        const currentApiKey = selectedAccount.apiKey;
        const currentTagId = selectedTag;

        // Add Job
        addJob({
            title: `System.io Import ${selectedTagName}`,
            totalItems: contacts.length,
            data: contacts,
            apiEndpoint: 'systemio',
            batchSize: 1,
            processItem: async (contact) => {
    if (delayInput > 0) await new Promise(r => setTimeout(r, delayInput * 1000));
    
    const res = await fetch('/api/systemio/import/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            apiKey: currentApiKey,
            tagId: currentTagId,
            contact: {
                email: contact.email,
                firstName: contact.firstName
            }
        })
    });
    
    const data = await res.json();
    
    // Check if the HTTP request failed OR if the API returned success: false
    if (!res.ok || data.success === false) {
         // Throwing an error here is what tells the table to show "Fail"
         throw new Error(JSON.stringify(data.details || data.error || "Failed"));
    }
    
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
        const emailsToExport = filteredResults.map(result => result.data?.email).join('\n');
        if (!emailsToExport) {
            toast({ title: 'Export Failed', description: "No emails to export.", variant: "destructive" });
            return;
        }
        const blob = new Blob([emailsToExport], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `systemio_export_${selectedAccount?.name}_${filter}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filter Logic
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
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">System.io Bulk Import</h1>
                    <p className="text-sm text-muted-foreground">Import contacts and assign optional tags.</p>
                </div>
            </div>

            {!selectedAccount && (
                <Alert variant="destructive" className="mb-6 shrink-0">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>No Account Selected</AlertTitle>
                    <AlertDescription>Please select a System.io account from the sidebar.</AlertDescription>
                </Alert>
            )}

            {/* MAIN TWO-COLUMN LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                
                {/* LEFT COLUMN: Input & Configuration */}
                <Card className="flex flex-col h-full overflow-hidden">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Terminal className="h-4 w-4" /> Import Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
                        
                        {/* Textarea Section */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <Label htmlFor="emailList" className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
                                Paste Emails (CSV or New Line)
                            </Label>
                            <Textarea
                                id="emailList"
                                placeholder="user1@example.com&#10;user2@example.com,John,Doe"
                                className="flex-1 resize-none font-mono text-sm leading-relaxed"
                                value={emailListInput}
                                onChange={handleTextareaChange}
                                disabled={isWorking}
                            />
                            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                                <span>Detected: <strong className="text-foreground">{emailCount}</strong></span>
                                <span>Supported: Email, FirstName</span>
                            </div>
                        </div>

                        <Separator />

                        {/* Settings Section */}
                        <div className="grid grid-cols-2 gap-4 shrink-0">
                            
                            {/* Tag Selector */}
                            <div className="col-span-2">
                                <div className="flex justify-between items-center mb-1">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground block">Assign Tag (Optional)</Label>
                                    <Button variant="ghost" size="sm" onClick={fetchTags} disabled={isLoadingTags} className="h-5 w-5 p-0">
                                         <RefreshCw className={isLoadingTags ? "animate-spin w-3 h-3" : "w-3 h-3"} />
                                    </Button>
                                </div>
                                <Select value={selectedTag} onValueChange={handleTagChange} disabled={!selectedAccount || isWorking}>
                                    <SelectTrigger className="h-8 text-sm">
                                        <SelectValue placeholder={isLoadingTags ? "Loading..." : "Select a tag"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="no-tag">-- No Tag --</SelectItem>
                                        {tags.map((t: any) => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Default First Name */}
                            <div className="col-span-1">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Default First Name</Label>
                                <Input 
                                    value={defaultFirstName} 
                                    onChange={handleNameChange} 
                                    placeholder="Friend" 
                                    disabled={isWorking} 
                                    className="h-8 text-sm"
                                />
                            </div>

                            {/* Delay */}
                            <div className="col-span-1">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Request Delay (s)</Label>
                                <Input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    value={delayInput}
                                    onChange={(e) => setDelayInput(Math.max(0, parseFloat(e.target.value)))}
                                    className="h-8 text-sm"
                                    disabled={isWorking}
                                />
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button 
                                onClick={handleStartImport} 
                                disabled={!selectedAccount || isWorking || !emailListInput.trim()} 
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

export default SystemIoBulkImport;