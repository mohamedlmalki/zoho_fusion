import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, RefreshCw, AlertCircle, CheckCircle2, XCircle, 
  Clock, Mail, ChevronLeft, ChevronRight, MoreHorizontal, Eye,
  MailOpen, Download, Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
// FIX 1: Use the correct context from your Fusion Manager app
import { useAccount } from '@/contexts/AccountContext'; 
import { toast } from 'sonner';
import { format } from 'date-fns';

const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'; // FIX 2: Matched to your server.js port

interface EmailLog {
  id: string;
  batchId: string;
  to: string;
  from: string;
  subject: string;
  status: 'delivered' | 'failed' | 'pending';
  errorMessage: string | null;
  isOpened: boolean;
  openCount: number;
  sentAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const Analytics: React.FC = () => {
  // FIX 3: Map to activeAccount
  const { activeAccount } = useAccount(); 
  
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 100, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  console.log("Analytics Rendered. Active Account:", activeAccount?.name || "None");

  const stats = useMemo(() => {
    return {
      delivered: logs.filter(l => l.status === 'delivered').length,
      failed: logs.filter(l => l.status === 'failed').length,
      opened: logs.filter(l => l.isOpened).length,
      unopened: logs.filter(l => !l.isOpened).length
    };
  }, [logs]);

  const handleExport = () => {
    if (logs.length === 0) {
      toast.error("No logs to export");
      return;
    }
    const textContent = logs.map(r => r.to).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-export-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${logs.length} emails`);
  };

  const fetchLogs = async (page = 1) => {
    console.log("fetchLogs triggered. Checking activeAccount...");
    if (!activeAccount) {
        console.warn("fetchLogs aborted: No active account.");
        return;
    }

    setIsLoading(true);
    console.log(`Starting fetch for page ${page} with filter '${statusFilter}'`);
    
    try {
      const queryParams = new URLSearchParams({
        secretKey: activeAccount.apiKey, // Sent API key for backend auth
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (statusFilter !== 'all') {
        queryParams.append('status', statusFilter);
      }

      // We map this to your backend route (You will need to create this in routes/plunk.js)
      const fetchUrl = `${apiUrl}/api/plunk/logs?${queryParams}`;
      console.log("Executing fetch to URL:", fetchUrl);

      const response = await fetch(fetchUrl);
      console.log("Fetch response received. Status:", response.status);

      const result = await response.json();
      console.log("Fetch response payload:", result);

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to fetch logs');
      }

      if (result.success || Array.isArray(result.data) || Array.isArray(result)) {
        console.log("Logs successfully retrieved and set to state.");
        setLogs(result.data || result || []);
        if (result.pagination) setPagination(result.pagination);
      } else {
        console.warn("API responded OK but data format was unexpected:", result);
      }
    } catch (err: any) {
      console.error("Fetch error caught in catch block:", err);
      toast.error(`Fetch failed: ${err.message}`);
    } finally {
      setIsLoading(false);
      console.log("Fetch process completed. isLoading set to false.");
    }
  };

  useEffect(() => {
    console.log("useEffect triggered by activeAccount or statusFilter change.");
    if (activeAccount) {
      fetchLogs(1);
    }
  }, [activeAccount?.id, statusFilter]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchLogs(newPage);
    }
  };

  if (!activeAccount) {
    console.log("Rendering empty state because activeAccount is null.");
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center mt-6">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">No Account Selected</h2>
            <p className="text-muted-foreground">Select a Plunk account from the sidebar.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shadow-sm">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Plunk Analytics</h1>
            <p className="text-muted-foreground text-sm">Track delivery status and engagement</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md bg-background">
            <div className="px-2 border-r text-muted-foreground"><Filter className="w-3.5 h-3.5" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] border-0 focus:ring-0">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={handleExport} disabled={isLoading}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>

          <Button variant="outline" onClick={() => fetchLogs(pagination.page)} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-muted/30 border-none shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Delivered</p>
              <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-200" />
          </CardContent>
        </Card>
        <Card className="bg-muted/30 border-none shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-200" />
          </CardContent>
        </Card>
        <Card className="bg-muted/30 border-none shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Opened</p>
              <p className="text-2xl font-bold text-blue-600">{stats.opened}</p>
            </div>
            <MailOpen className="w-8 h-8 text-blue-200" />
          </CardContent>
        </Card>
        <Card className="bg-muted/30 border-none shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unopened</p>
              <p className="text-2xl font-bold text-gray-600">{stats.unopened}</p>
            </div>
            <Mail className="w-8 h-8 text-gray-200" />
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="border-t-4 border-t-primary shadow-md">
        <CardContent className="p-0">
          <div className="rounded-md border-b">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="text-center w-[120px]">Tracking</TableHead>
                  <TableHead className="text-right">Sent At</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" /> Fetching logs from backend...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No logs found or backend route is missing. Check Developer Console!
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                      <TableCell>
                        {log.status === 'delivered' && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Delivered
                          </Badge>
                        )}
                        {log.status === 'failed' && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
                            <XCircle className="w-3 h-3" /> Failed
                          </Badge>
                        )}
                        {log.status === 'pending' && (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 gap-1">
                            <Clock className="w-3 h-3" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate" title={log.subject}>
                        {log.subject}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.to}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.isOpened ? (
                          <div className="flex items-center justify-center text-blue-600" title={`Opened ${log.openCount} times`}>
                            <MailOpen className="w-4 h-4 mr-1.5" />
                            <span className="text-xs font-semibold">Opened ({log.openCount})</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center text-muted-foreground/50">
                            <Mail className="w-4 h-4 mr-1.5" />
                            <span className="text-xs">Unopened</span>
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {log.sentAt ? format(new Date(log.sentAt), 'MMM d, HH:mm') : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between px-4 py-4 border-t bg-muted/20">
            <div className="text-xs text-muted-foreground">
              Showing <strong>{logs.length}</strong> of <strong>{pagination.total}</strong> results
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page <= 1 || isLoading}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <div className="text-xs font-medium px-2">
                Page {pagination.page} of {pagination.totalPages || 1}
              </div>
              <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages || isLoading}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" /> Message Details
            </DialogTitle>
            <DialogDescription>ID: <span className="font-mono text-xs">{selectedLog?.id}</span></DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-sm mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recipient</p>
                  <p className="font-mono bg-muted/50 p-1.5 rounded border">{selectedLog.to}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">From</p>
                  <p className="font-mono bg-muted/50 p-1.5 rounded border">{selectedLog.from}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject</p>
                <p className="font-medium p-1.5">{selectedLog.subject}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};