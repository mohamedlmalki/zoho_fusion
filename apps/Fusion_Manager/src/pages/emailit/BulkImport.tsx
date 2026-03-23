import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Users, Info, CheckCircle2, XCircle, Loader2, 
  Pause, Play, Square, Image as ImageIcon, Eye, Clock, Check, AlertTriangle,
  Download, Timer
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress'; 
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from '@/contexts/AccountContext'; 
import { useBulkJobs } from '@/contexts/BulkJobContext';
import { toast } from 'sonner';

export const BulkImport: React.FC = () => {
  const { activeAccount: currentAccount } = useAccount(); 
  const { getJob, updateJobData, startJob, pauseJob, resumeJob, stopJob } = useBulkJobs();
  
  const job = currentAccount ? getJob(currentAccount.id) : null;

  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const [detailsDialog, setDetailsDialog] = useState<{ open: boolean, data: string | null }>({ open: false, data: null });
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  
  const [imageUrl, setImageUrl] = useState('');
  const [imageLink, setImageLink] = useState('');
  const [imageSize, setImageSize] = useState('100%');
  const [imageAlign, setImageAlign] = useState('center');

  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (currentAccount && job && !job.fromEmail) {
      if (currentAccount.defaultFrom) {
        updateJobData(currentAccount.id, { fromEmail: currentAccount.defaultFrom });
      }
    }
  }, [currentAccount, job?.fromEmail]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredResults = job ? job.results.filter(result => {
    if (filter === 'all') return true;
    return result.status === filter;
  }) : [];

  const handleExport = () => {
    if (filteredResults.length === 0) {
      toast.error("No emails to export based on current filter");
      return;
    }
    const textContent = filteredResults.map(r => r.email).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `emails-${filter}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredResults.length} emails`);
  };

  const handleInsertImage = () => {
    if (!imageUrl) {
        toast.error("Image URL is required");
        return;
    }
    if (!currentAccount || !job) return;

    let imgTag = `<img src="${imageUrl}" alt="Image" style="max-width: 100%; width: ${imageSize}; height: auto;" />`;
    if (imageLink) {
        imgTag = `<a href="${imageLink}" target="_blank">${imgTag}</a>`;
    }
    const imageHtml = `<div style="text-align: ${imageAlign}; margin: 10px 0;">${imgTag}</div>`;

    let updatedContent = job.content;
    if (contentRef.current) {
        const start = contentRef.current.selectionStart;
        const end = contentRef.current.selectionEnd;
        updatedContent = job.content.substring(0, start) + imageHtml + job.content.substring(end);
    } else {
        updatedContent += imageHtml;
    }

    if (!updatedContent.toLowerCase().includes('<html')) {
        updatedContent = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n</head>\n<body>\n${updatedContent}\n</body>\n</html>`;
    }

    updateJobData(currentAccount.id, { content: updatedContent });

    setImageUrl('');
    setImageLink('');
    setImageSize('100%');
    setImageAlign('center');
    setIsImageDialogOpen(false);
    toast.success("Image added (Wrapped in HTML)");
  };

  const onStart = () => {
    if (!currentAccount) return;
    startJob(currentAccount.id, currentAccount.apiKey || '', 'emailit');
  };

  const onPauseToggle = () => {
    if (!currentAccount || !job) return;
    if (job.status === 'paused') {
      resumeJob(currentAccount.id);
    } else {
      pauseJob(currentAccount.id);
    }
  };

  const onStop = () => {
    if (!currentAccount) return;
    stopJob(currentAccount.id);
  };

  if (!currentAccount || !job) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <Card className="w-full max-w-md shadow-sm">
          <CardContent className="p-6 text-center mt-6">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">No Account Selected</h2>
            <p className="text-muted-foreground">Select an account from the sidebar.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isJobActive = job.status === 'processing' || job.status === 'paused' || job.status === 'waiting';
  const progressPercent = job.progress.total > 0 ? (job.progress.current / job.progress.total) * 100 : 0;

  return (
    <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 h-[calc(100vh-60px)] flex flex-col">
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div className="p-2 bg-primary/10 rounded-lg"><Users className="h-6 w-6 text-primary" /></div>
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Emailit Bulk Send</h1>
            <p className="text-sm text-muted-foreground">Mass mailing with custom delay and HTML content.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* LEFT: Configuration */}
        <Card className="flex flex-col h-full overflow-hidden shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20 shrink-0">
            <CardTitle className="text-base font-semibold">Configuration</CardTitle>
            <CardDescription>Enter recipients and content</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
            
            <div className="grid grid-cols-1 gap-4 shrink-0">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="fromName" className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                            From Name
                        </Label>
                        <Input 
                            id="fromName" 
                            placeholder="My Brand" 
                            value={job.fromName || ''}
                            onChange={(e) => updateJobData(currentAccount.id, { fromName: e.target.value })}
                            disabled={isJobActive}
                            className="h-8 text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="delay" className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                            Delay (sec)
                        </Label>
                        <Input 
                            id="delay" 
                            type="number"
                            min="0"
                            value={job.delay}
                            onChange={(e) => updateJobData(currentAccount.id, { delay: parseInt(e.target.value) || 0 })}
                            disabled={isJobActive}
                            className="h-8 text-sm"
                        />
                    </div>
                </div>
                
                <div className="space-y-1">
                    <Label htmlFor="from" className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                        From Email
                    </Label>
                    <Input 
                        id="from" 
                        placeholder="opt@..." 
                        value={job.fromEmail || ''}
                        onChange={(e) => updateJobData(currentAccount.id, { fromEmail: e.target.value })}
                        disabled={isJobActive}
                        className="h-8 text-sm"
                    />
                </div>
            </div>

            <div className="space-y-1 shrink-0">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Subject Line</Label>
              <Input 
                placeholder="Newsletter Subject" 
                value={job.subject}
                onChange={(e) => updateJobData(currentAccount.id, { subject: e.target.value })}
                disabled={isJobActive}
                className="h-8 text-sm"
              />
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center mb-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Content (HTML)</Label>
                <div className="flex space-x-1">
                    <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" disabled={isJobActive}>
                                <ImageIcon className="w-3 h-3 mr-1" /> Image
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                             <DialogHeader>
                                <DialogTitle>Insert Image</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label>Image URL</Label>
                                    <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Link URL (Optional)</Label>
                                    <Input value={imageLink} onChange={(e) => setImageLink(e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Size</Label>
                                        <Input value={imageSize} onChange={(e) => setImageSize(e.target.value)} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Alignment</Label>
                                        <Select value={imageAlign} onValueChange={setImageAlign}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="left">Left</SelectItem>
                                                <SelectItem value="center">Center</SelectItem>
                                                <SelectItem value="right">Right</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <Button onClick={handleInsertImage} className="mt-2">Save & Insert</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" disabled={isJobActive}>
                                <Eye className="w-3 h-3 mr-1" /> Preview
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                             <DialogHeader>
                                <DialogTitle>Email Preview</DialogTitle>
                            </DialogHeader>
                            <div className="border rounded-md p-4 mt-2 min-h-[200px] prose max-w-none bg-white text-black">
                                {job.content ? (
                                    <div dangerouslySetInnerHTML={{ __html: job.content }} />
                                ) : (
                                    <p className="text-gray-400 italic text-center">No content to preview</p>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
              </div>
              <Textarea 
                ref={contentRef}
                placeholder="<h1>Hello!</h1>" 
                className="flex-1 font-mono text-xs resize-none p-2"
                value={job.content}
                onChange={(e) => updateJobData(currentAccount.id, { content: e.target.value })}
                disabled={isJobActive}
              />
            </div>

            <div className="space-y-1 h-[120px] shrink-0">
                <div className="flex justify-between items-center mb-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Recipients</Label>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                      {job.emailList.split('\n').filter(e => e.trim()).length} Emails
                  </Badge>
                </div>
                <Textarea 
                  placeholder={`user1@domain.com\nuser2@domain.com`}
                  className="h-full font-mono text-xs resize-none p-2 leading-relaxed"
                  value={job.emailList}
                  onChange={(e) => updateJobData(currentAccount.id, { emailList: e.target.value })}
                  disabled={isJobActive}
                />
            </div>

            <div className="pt-2 shrink-0">
                {!isJobActive ? (
                    <Button className="w-full h-9" onClick={onStart}>
                      <Send className="w-4 h-4 mr-2" /> 
                      {job.status === 'completed' || job.status === 'stopped' ? "Restart Job" : "Start Bulk Send"}
                    </Button>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        <Button 
                            variant={job.status === 'paused' ? "default" : "secondary"}
                            className={job.status === 'paused' ? "bg-yellow-500 hover:bg-yellow-600 text-white h-9" : "h-9"}
                            onClick={onPauseToggle}
                        >
                            {job.status === 'paused' ? (
                                <> <Play className="w-4 h-4 mr-2" /> Resume </>
                            ) : (
                                <> <Pause className="w-4 h-4 mr-2" /> Pause </>
                            )}
                        </Button>
                        
                        <Button variant="destructive" className="h-9" onClick={onStop}>
                            <Square className="w-4 h-4 mr-2 fill-current" /> Stop
                        </Button>
                    </div>
                )}
            </div>

          </CardContent>
        </Card>

        {/* RIGHT: Results Table & Stats */}
        <Card className="flex flex-col h-full overflow-hidden border-l-4 border-l-primary/20 shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row justify-between items-center space-y-0 shrink-0">
             <CardTitle className="text-base font-semibold">Live Results</CardTitle>
             <div className="flex items-center gap-2">
                <Select value={filter} onValueChange={(val: any) => setFilter(val)}>
                    <SelectTrigger className="h-7 w-[100px] bg-background text-xs">
                        <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="success" className="text-green-600">Success</SelectItem>
                        <SelectItem value="error" className="text-red-600">Failed</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={handleExport} className="h-7 text-xs px-2">
                    <Download className="h-3.5 w-3.5 mr-1" /> Export
                </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            <div className="grid grid-cols-3 divide-x border-b bg-muted/10 shrink-0">
                <div className="p-3 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground font-bold flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-blue-500" /> Time
                    </div>
                    <div className="text-lg font-mono font-medium">{formatTime(job.elapsedSeconds)}</div>
                </div>
                <div className="p-3 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground font-bold flex items-center justify-center gap-1 text-green-600">
                        <Check className="w-3 h-3" /> Success
                    </div>
                    <div className="text-lg font-bold text-green-600">{job.stats.success}</div>
                </div>
                <div className="p-3 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground font-bold flex items-center justify-center gap-1 text-red-600">
                        <AlertTriangle className="w-3 h-3" /> Failed
                    </div>
                    <div className="text-lg font-bold text-red-600">{job.stats.fail}</div>
                </div>
            </div>
            
            <div className="px-4 py-3 border-b relative shrink-0">
                <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Progress: {job.progress.current} / {job.progress.total}</span>
                    {job.status === 'waiting' && job.countdown > 0 && (
                        <span className="text-primary font-mono animate-pulse">Next in {job.countdown}s...</span>
                    )}
                </div>
                <Progress value={progressPercent} className="h-1.5" />
            </div>

            <div className="flex-1 overflow-auto bg-slate-50/50">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow className="h-9">
                    <TableHead className="w-[50px] text-center text-xs">#</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="w-[100px] text-center text-xs">Status</TableHead>
                    <TableHead className="w-[50px] text-center text-xs">Log</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-40 text-muted-foreground">
                        <div className="flex flex-col items-center justify-center space-y-2 opacity-50">
                            <Send className="w-6 h-6" />
                            <span className="text-xs">No deployment logs.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredResults.map((result) => (
                      <TableRow key={result.id} className="h-9 group hover:bg-muted/50">
                        <TableCell className="font-mono text-muted-foreground text-xs text-center">{result.id}</TableCell>
                        <TableCell className="font-medium font-mono text-xs">{result.email}</TableCell>
                        <TableCell className="text-center">
                          {result.status === 'success' ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              <XCircle className="w-3 h-3 mr-1" /> Fail
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setDetailsDialog({ open: true, data: result.response })}
                          >
                            <Info className="w-3.5 h-3.5" />
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

      {/* ORIGINAL RESULTS DIALOG */}
      <Dialog open={detailsDialog.open} onOpenChange={(open) => setDetailsDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-lg">
            <DialogHeader>
            <DialogTitle>Response Details</DialogTitle>
            <DialogDescription>Raw server response.</DialogDescription>
          </DialogHeader>
          <div className="bg-slate-950 text-slate-50 p-4 rounded-md overflow-auto max-h-[400px] font-mono text-xs border border-slate-800">
            <pre>{detailsDialog.data}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};