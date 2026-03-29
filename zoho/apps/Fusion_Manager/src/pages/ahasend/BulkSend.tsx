import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Pause, Square, Send, Info, FileJson, Download, Terminal, ImagePlus, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from "@/contexts/AccountContext";
import { campaignManager, CampaignState, EmailJob } from "@/lib/campaignManager";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// --- IMPORTING THE DIALOGS ---
import { PreviewDialog } from '@/components/PreviewDialog';
import { AddImageDialog } from '@/components/AddImageDialog';

type FilterStatus = "all" | "success" | "failed";

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const BulkSend: React.FC = () => {
  const { activeAccount, campaigns } = useAccount();
  const { toast } = useToast();
  
  const [selectedResponse, setSelectedResponse] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("all");
  
  const currentCampaign = activeAccount ? campaigns.get(activeAccount.id) : undefined;

  useEffect(() => {
    if (activeAccount && !campaigns.get(activeAccount.id)) {
      campaignManager.updateCampaign(activeAccount.id, {});
    }
  }, [activeAccount, campaigns]);

  const filteredJobs = useMemo(() => {
    if (!currentCampaign) return [];
    if (filter === "all") return currentCampaign.processedJobs;
    return currentCampaign.processedJobs.filter(job => job.status === filter);
  }, [currentCampaign, filter]);

  const recipientCount = useMemo(() => {
    if (!currentCampaign?.emailsText) return 0;
    return currentCampaign.emailsText.split('\n').filter(Boolean).length;
  }, [currentCampaign?.emailsText]);

  const handleExport = () => {
    const emailsToExport = filteredJobs.map(job => job.email).join("\n");
    if (!emailsToExport) {
        toast({ title: "No emails to export", variant: "destructive" });
        return;
    }
    const blob = new Blob([emailsToExport], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ahasend-export-${filter}-${new Date().toISOString()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleInputChange = (field: keyof CampaignState, value: string) => {
    if (activeAccount) {
      campaignManager.updateCampaign(activeAccount.id, { [field]: value });
    }
  };

  const handleInsertImage = (imgHtml: string) => {
    if (activeAccount && currentCampaign) {
        handleInputChange('content', currentCampaign.content + imgHtml);
    }
  };

  const handleStartCampaign = () => {
    if (activeAccount) {
      campaignManager.startCampaign(activeAccount.id, activeAccount.defaultFrom || "noreply@domain.com");
    }
  };

  if (!activeAccount) {
    return (
        <div className="p-6">
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>No Account Selected</AlertTitle>
                <AlertDescription>Please select an Ahasend account from the sidebar.</AlertDescription>
            </Alert>
        </div>
    );
  }

  if (!currentCampaign) return null;

  const isFormDisabled = currentCampaign.isRunning;
  const isLaunchDisabled = !currentCampaign.fromName || !currentCampaign.emailsText || !currentCampaign.subject || !currentCampaign.content;
  const progressPercent = currentCampaign.stats.total > 0 ? ((currentCampaign.stats.success + currentCampaign.stats.failed) / currentCampaign.stats.total) * 100 : 0;

  return (
    <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 h-[calc(100vh-60px)] flex flex-col">
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div className="p-2 bg-primary/10 rounded-lg"><Send className="h-6 w-6 text-primary" /></div>
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Ahasend Bulk Send</h1>
            <p className="text-sm text-muted-foreground">Mass mailing with custom delay and content.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* LEFT: Configuration */}
        <Card className="flex flex-col h-full overflow-hidden shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-base font-semibold">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-3 gap-4 shrink-0">
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">From Name</Label>
                  <Input value={currentCampaign.fromName} onChange={e => handleInputChange('fromName', e.target.value)} disabled={isFormDisabled} className="h-8 text-sm" placeholder="Your Name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Delay (Sec)</Label>
                  <Input type="number" value={currentCampaign.delay} onChange={e => handleInputChange('delay', e.target.value)} disabled={isFormDisabled} className="h-8 text-sm" />
                </div>
            </div>

            <div className="space-y-1 shrink-0">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Subject Line</Label>
              <Input value={currentCampaign.subject} onChange={e => handleInputChange('subject', e.target.value)} disabled={isFormDisabled} className="h-8 text-sm" placeholder="Campaign Subject" />
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center mb-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">HTML Content</Label>
                  
                  {/* --- IMAGE & PREVIEW BUTTONS --- */}
                  <div className="flex gap-2">
                      <AddImageDialog onInsertImage={handleInsertImage}>
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 hover:bg-muted" disabled={isFormDisabled}>
                              <ImagePlus className="w-3 h-3 mr-1" /> Image
                          </Button>
                      </AddImageDialog>
                      <PreviewDialog htmlContent={currentCampaign.content}>
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 hover:bg-muted">
                              <Eye className="w-3 h-3 mr-1" /> Preview
                          </Button>
                      </PreviewDialog>
                  </div>
              </div>
              <Textarea value={currentCampaign.content} onChange={e => handleInputChange('content', e.target.value)} disabled={isFormDisabled} className="flex-1 font-mono text-xs resize-none p-2" placeholder="<h1>Hello</h1>..." />
            </div>

            <div className="space-y-1 h-[120px] shrink-0">
              <div className="flex justify-between items-center mb-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Recipients</Label>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">{recipientCount} Emails</Badge>
              </div>
              <Textarea value={currentCampaign.emailsText} onChange={e => handleInputChange('emailsText', e.target.value)} disabled={isFormDisabled} className="h-full font-mono text-xs resize-none p-2" placeholder="user@domain.com" />
            </div>

            <div className="pt-2 flex gap-2">
              {!currentCampaign.isRunning ? (
                <Button onClick={handleStartCampaign} disabled={isLaunchDisabled} className="w-full h-9">
                  <Play className="mr-2 h-4 w-4" /> Start Bulk Send
                </Button>
              ) : (
                <>
                  <Button onClick={() => currentCampaign.isPaused ? campaignManager.resumeCampaign(activeAccount.id) : campaignManager.pauseCampaign(activeAccount.id)} variant="outline" className="flex-1 h-9">
                    {currentCampaign.isPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                    {currentCampaign.isPaused ? "Resume" : "Pause"}
                  </Button>
                  <Button onClick={() => campaignManager.stopCampaign(activeAccount.id)} variant="destructive" className="flex-1 h-9">
                    <Square className="mr-2 h-4 w-4" /> Stop
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Results */}
        <Card className="flex flex-col h-full overflow-hidden border-l-4 border-l-primary/20 shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row justify-between items-center space-y-0">
            <CardTitle className="text-base font-semibold">Results</CardTitle>
            <div className="flex items-center gap-2">
                <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as FilterStatus)} size="sm">
                    <ToggleGroupItem value="all" className="h-7 text-xs">All</ToggleGroupItem>
                    <ToggleGroupItem value="success" className="h-7 text-xs text-green-600">Success</ToggleGroupItem>
                    <ToggleGroupItem value="failed" className="h-7 text-xs text-red-600">Failed</ToggleGroupItem>
                </ToggleGroup>
                <Button variant="outline" size="sm" onClick={handleExport} className="h-7 text-xs px-2">
                    <Download className="h-3.5 w-3.5" />
                </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            <div className="grid grid-cols-3 divide-x border-b bg-muted/10">
                <div className="p-3 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground font-bold">Time</div>
                    <div className="text-lg font-mono font-medium">{formatTime(currentCampaign.timeElapsed)}</div>
                </div>
                <div className="p-3 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground font-bold text-green-600">Success</div>
                    <div className="text-lg font-bold text-green-600">{currentCampaign.stats.success}</div>
                </div>
                <div className="p-3 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground font-bold text-red-600">Failed</div>
                    <div className="text-lg font-bold text-red-600">{currentCampaign.stats.failed}</div>
                </div>
            </div>
            <div className="px-4 py-3 border-b relative">
                <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Progress: {(currentCampaign.stats.success + currentCampaign.stats.failed)} / {currentCampaign.stats.total}</span>
                    {currentCampaign.isRunning && !currentCampaign.isPaused && currentCampaign.nextEmailIn > 0 && (
                        <span className="text-primary font-mono animate-pulse">Next in {currentCampaign.nextEmailIn}s...</span>
                    )}
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
                  {filteredJobs.length > 0 ? filteredJobs.map((job) => (
                    <TableRow key={job.id} className="h-9">
                      <TableCell className="text-xs font-mono text-muted-foreground">{job.id}</TableCell>
                      <TableCell className="text-xs font-medium">{job.email}</TableCell>
                      <TableCell>
                        {job.status === 'success' && <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">OK</Badge>}
                        {job.status === 'failed' && <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">Fail</Badge>}
                        {job.status === 'sending' && <Badge variant="outline" className="text-primary bg-primary/10 border-primary/20 animate-pulse">Sending</Badge>}
                        {job.status === 'pending' && <Badge variant="outline" className="text-muted-foreground bg-muted border-muted-foreground/20">Pending</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {job.response && (
                           <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedResponse(job.response); setIsDetailsOpen(true); }}>
                             <Info className="h-3.5 w-3.5" />
                           </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-xs">
                            {currentCampaign.isRunning ? "Processing queue..." : "No deployment logs."}
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
                  <DialogTitle className="flex items-center gap-2"><FileJson className="h-5 w-5 text-primary" /> API Response</DialogTitle>
                  <DialogDescription>Raw response details</DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[300px] w-full border p-4 bg-slate-950 text-slate-50 rounded-md">
                  <pre className="text-xs font-mono whitespace-pre-wrap">{selectedResponse}</pre>
              </ScrollArea>
          </DialogContent>
      </Dialog>
    </div>
  );
};