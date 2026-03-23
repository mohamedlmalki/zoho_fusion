import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, RefreshCw, AlertCircle, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight, MoreHorizontal, MailOpen, MousePointer2, Ban, Download, Terminal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAccount } from '@/contexts/AccountContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface EmailLog {
  id: string; type: string; to: string; from: string; subject: string;
  status: 'delivered' | 'failed' | 'processing' | 'opened' | 'clicked' | 'spam' | 'delayed';
  detailedStatus: string; errorMessage: string | null; sentAt: string;
}

export default function MailersendAnalytics() {
  const { activeAccount } = useAccount();
  
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  const stats = useMemo(() => {
    return {
      delivered: logs.filter(l => l.status === 'delivered').length,
      failed: logs.filter(l => l.status === 'failed').length,
      opened: logs.filter(l => l.status === 'opened').length,
      clicked: logs.filter(l => l.status === 'clicked').length,
      issues: logs.filter(l => l.status === 'spam' || l.status === 'delayed').length
    };
  }, [logs]);

  const handleExport = () => {
    if (logs.length === 0) return toast({ title: "Error", description: "No logs to export", variant: "destructive" });
    const textContent = logs.map(r => `${r.sentAt},${r.to},${r.detailedStatus}`).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mailersend_logs_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
  };

  const fetchLogs = async () => {
    if (!activeAccount) return;
    setIsLoading(true);
    try {
      // Remove domainId: activeAccount.apiUrl from this line
const params = new URLSearchParams({ apiKey: activeAccount.apiKey, limit: '25', page: page.toString() });
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/mailersend/email/log?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setLogs(result.data);
      } else {
        toast({ title: "Error", description: "Failed to fetch data", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeAccount, page, statusFilter]);

  const getStatusBadge = (log: EmailLog) => {
    switch (log.status) {
      case 'delivered': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1"><CheckCircle2 className="w-3 h-3" /> Sent</Badge>;
      case 'opened': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1"><MailOpen className="w-3 h-3" /> Opened</Badge>;
      case 'clicked': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1"><MousePointer2 className="w-3 h-3" /> Clicked</Badge>;
      case 'failed': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1"><XCircle className="w-3 h-3" /> {log.detailedStatus}</Badge>;
      case 'spam': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 gap-1"><Ban className="w-3 h-3" /> Spam</Badge>;
      default: return <Badge variant="outline" className="text-muted-foreground gap-1"><Clock className="w-3 h-3" /> {log.detailedStatus}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 flex flex-col h-[calc(100vh-60px)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics Log</h1>
            <p className="text-muted-foreground text-sm">Account: {activeAccount?.name || 'None'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
             <Select value={statusFilter} onValueChange={(val) => { setPage(1); setStatusFilter(val); }} disabled={!activeAccount || isLoading}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                    <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="delivered">Sent</SelectItem>
                    <SelectItem value="opened">Opened</SelectItem>
                    <SelectItem value="clicked">Clicked</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!activeAccount || isLoading}>
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => fetchLogs()} disabled={!activeAccount || isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
        </div>
      </div>

      {!activeAccount && (
        <Alert variant="destructive" className="mb-6 shrink-0">
            <Terminal className="h-4 w-4" />
            <AlertTitle>No Account Selected</AlertTitle>
            <AlertDescription>Please select a MailerSend account from the sidebar.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 shrink-0">
        <StatCard title="Sent" value={stats.delivered} icon={CheckCircle2} color="text-green-600" />
        <StatCard title="Opens" value={stats.opened} icon={MailOpen} color="text-blue-600" />
        <StatCard title="Clicks" value={stats.clicked} icon={MousePointer2} color="text-purple-600" />
        <StatCard title="Failed" value={stats.failed} icon={XCircle} color="text-red-600" />
        <StatCard title="Issues" value={stats.issues} icon={AlertCircle} color="text-orange-600" />
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-sm">
        <CardContent className="p-0 flex flex-col h-full">
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[160px]">Event</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading Data...</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No events found.</TableCell></TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="cursor-pointer hover:bg-muted/30 h-12" onClick={() => setSelectedLog(log)}>
                      <TableCell>{getStatusBadge(log)}</TableCell>
                      <TableCell className="font-mono text-xs">{log.to}</TableCell>
                      <TableCell className="text-sm truncate max-w-[300px]">{log.subject}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {format(new Date(log.sentAt), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end p-3 border-t bg-muted/10 shrink-0">
             <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
             </Button>
             <span className="text-xs font-medium mx-4 text-muted-foreground">Page {page}</span>
             <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)} disabled={logs.length < 25 || isLoading}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
             </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Event Details</DialogTitle>
                <DialogDescription className="font-mono text-xs">{selectedLog?.id}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-muted-foreground text-xs uppercase font-semibold block mb-1">Recipient</span>
                        <div className="font-medium font-mono bg-muted/50 p-2 rounded border">{selectedLog?.to}</div>
                    </div>
                    <div>
                         <span className="text-muted-foreground text-xs uppercase font-semibold block mb-1">From</span>
                        <div className="font-medium font-mono bg-muted/50 p-2 rounded border">{selectedLog?.from}</div>
                    </div>
                </div>
                <div>
                    <span className="text-muted-foreground text-xs uppercase font-semibold block mb-1">Subject</span>
                    <div className="text-sm border p-2 rounded bg-muted/20">{selectedLog?.subject}</div>
                </div>
                {selectedLog?.errorMessage && (
                    <div className="p-3 bg-red-50 text-red-800 rounded-md border border-red-200 text-xs font-mono break-all">
                        <span className="font-bold">API Error: </span>{selectedLog.errorMessage}
                    </div>
                )}
                <div className="pt-2 text-xs flex justify-between items-center border-t mt-4">
                    <Badge variant="secondary" className="font-mono uppercase">{selectedLog?.type}</Badge>
                    <span className="text-muted-foreground">{selectedLog && format(new Date(selectedLog.sentAt), 'PPpp')}</span>
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <Card className="shadow-sm">
    <CardContent className="p-4 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
      <div className={`p-2 rounded-full bg-muted/50`}>
        <Icon className={`w-5 h-5 opacity-80 ${color}`} />
      </div>
    </CardContent>
  </Card>
);