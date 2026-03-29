import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// --- ADDED Send TO IMPORTS HERE ---
import { Loader2, AlertCircle, Calendar as CalendarIcon, Download, ChevronLeft, ChevronRight, Eye, MoreHorizontal, BarChart3, CheckCircle2, XCircle, MailOpen, Mail, Send } from "lucide-react";

import { useAccount } from "@/contexts/AccountContext";
import { useToast } from "@/hooks/use-toast";

const COLORS = ["hsl(var(--primary))", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F"];
const valueToPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export const Statistics: React.FC = () => {
    const { activeAccount } = useAccount();
    const { toast } = useToast();
    
    const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 29),
        to: new Date(),
    });
    const [messageStatusFilter, setMessageStatusFilter] = useState<string>("all");
    const [selectedMessageContent, setSelectedMessageContent] = useState<string | null>(null);

    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [history, setHistory] = useState<Array<string | undefined>>([]);

    const fetchStats = async (reportType: string) => {
        if (!activeAccount) return null;
        const params = new URLSearchParams({ accountId: activeAccount.id });
        if (groupBy) params.append('group_by', groupBy);
        if (dateRange?.from) params.append('from_time', dateRange.from.toISOString());
        if (dateRange?.to) params.append('to_time', dateRange.to.toISOString());

        const response = await fetch(`/api/ahasend/statistics/${reportType}?${params.toString()}`);
        if (!response.ok) throw new Error(`Failed to fetch ${reportType}`);
        return response.json();
    };
    
    const fetchMessages = async () => {
        if (!activeAccount) return null;
        const params = new URLSearchParams({ accountId: activeAccount.id, limit: '100' });
        if (cursor) {
            params.append('cursor', cursor);
        } else {
            if (dateRange?.from) params.append('from_time', dateRange.from.toISOString());
            if (dateRange?.to) params.append('to_time', dateRange.to.toISOString());
            if (messageStatusFilter !== 'all') params.append('status', messageStatusFilter);
        }
        const response = await fetch(`/api/ahasend/messages?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        return response.json();
    }

    const fetchMessageDetails = async (messageId: string) => {
        if (!activeAccount) return;
        try {
            const response = await fetch(`/api/ahasend/messages/${messageId}?accountId=${activeAccount.id}`);
            if (!response.ok) throw new Error("Failed to fetch message details.");
            const data = await response.json();
            setSelectedMessageContent(JSON.stringify(data, null, 2));
        } catch (error) {
            toast({ title: "Error", description: "Failed to load details.", variant: "destructive"});
        }
    }

    const { data: deliverabilityData, isLoading: isLoadingDeliverability } = useQuery({
        queryKey: ['ahasend_deliverability', activeAccount?.id, dateRange, groupBy],
        queryFn: () => fetchStats('deliverability'),
        enabled: !!activeAccount,
    });

    const { data: bounceData } = useQuery({
        queryKey: ['ahasend_bounce', activeAccount?.id, dateRange, groupBy],
        queryFn: () => fetchStats('bounce'),
        enabled: !!activeAccount,
    });

    const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
        queryKey: ['ahasend_messages', activeAccount?.id, dateRange, messageStatusFilter, cursor],
        queryFn: fetchMessages,
        enabled: !!activeAccount,
    });
    
    useEffect(() => {
        setCursor(undefined);
        setHistory([]);
    }, [messageStatusFilter, dateRange, activeAccount]);

    const handleExport = () => {
        if (!messagesData?.data?.length) {
            toast({ title: "No Messages to Export", variant: "destructive" });
            return;
        }
        const emailsToExport = messagesData.data.map((m: any) => m.recipient).join("\n");
        const blob = new Blob([emailsToExport], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `exported-ahasend-${messageStatusFilter}-${new Date().toISOString()}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const chartData = useMemo(() => {
        if (!deliverabilityData?.data || !Array.isArray(deliverabilityData.data)) return [];
        return deliverabilityData.data.map((d: any) => ({ 
            ...d, 
            name: format(new Date(d.from_timestamp), "MMM d") 
        }));
    }, [deliverabilityData]);
    
    const totalStats = useMemo(() => {
        if (!deliverabilityData?.data || !Array.isArray(deliverabilityData.data)) return null;
        
        const totals = deliverabilityData.data.reduce((acc: any, curr: any) => {
            Object.keys(acc).forEach(key => acc[key] += curr[key] || 0);
            return acc;
        }, { reception_count: 0, delivered_count: 0, opened_count: 0, clicked_count: 0, bounced_count: 0 });
        
        return { 
            ...totals, 
            open_rate: totals.delivered_count ? totals.opened_count / totals.delivered_count : 0, 
            click_rate: totals.opened_count ? totals.clicked_count / totals.opened_count : 0 
        };
    }, [deliverabilityData]);

    const bounceChartData = useMemo(() => {
        if (!bounceData?.data || !Array.isArray(bounceData.data)) return [];
        
        const bounceMap = new Map<string, number>();
        bounceData.data.forEach((d: any) => {
            if (Array.isArray(d.bounces)) {
                d.bounces.forEach((b: any) => bounceMap.set(b.classification, (bounceMap.get(b.classification) || 0) + b.count));
            }
        });
        
        return Array.from(bounceMap, ([name, value]) => ({ name, value }));
    }, [bounceData]);

    if (!activeAccount) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-60px)]">
                <Card className="w-full max-w-md shadow-sm">
                    <CardContent className="p-6 text-center mt-6">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <h2 className="text-lg font-semibold mb-2">No Account Selected</h2>
                        <p className="text-muted-foreground">Select an Ahasend account from the sidebar.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 animate-fade-in max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shadow-sm">
                        <BarChart3 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Ahasend Analytics</h1>
                        <p className="text-muted-foreground text-sm">Performance metrics and engagement</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[260px] justify-start text-left font-normal bg-background">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>) : (format(dateRange.from, "LLL dd, y"))) : (<span>Pick a date</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end"><Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} /></PopoverContent>
                    </Popover>
                    <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
                        <SelectTrigger className="w-[120px] bg-background"><SelectValue placeholder="Group by" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="day">Daily</SelectItem>
                            <SelectItem value="week">Weekly</SelectItem>
                            <SelectItem value="month">Monthly</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Quick Stats */}
            {totalStats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-muted/30 border-none shadow-sm">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Sent</p>
                                <p className="text-2xl font-bold text-foreground">{totalStats.reception_count.toLocaleString()}</p>
                            </div>
                            <Send className="w-8 h-8 text-muted-foreground/30" />
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/30 border-none shadow-sm">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Delivered</p>
                                <p className="text-2xl font-bold text-green-600">{valueToPercent(totalStats.reception_count ? totalStats.delivered_count / totalStats.reception_count : 0)}</p>
                            </div>
                            <CheckCircle2 className="w-8 h-8 text-green-200" />
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/30 border-none shadow-sm">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Rate</p>
                                <p className="text-2xl font-bold text-blue-600">{valueToPercent(totalStats.open_rate)}</p>
                            </div>
                            <MailOpen className="w-8 h-8 text-blue-200" />
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/30 border-none shadow-sm">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Click Rate</p>
                                <p className="text-2xl font-bold text-primary">{valueToPercent(totalStats.click_rate)}</p>
                            </div>
                            <BarChart3 className="w-8 h-8 text-primary/20" />
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="flex items-center justify-center h-24 text-muted-foreground">
                    {isLoadingDeliverability ? <Loader2 className="h-6 w-6 animate-spin mr-2"/> : "No data available for the selected period."}
                </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Deliverability Over Time</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {isLoadingDeliverability ? (
                            <div className="flex justify-center items-center h-full"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                        ) : chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))"/>
                                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false}/>
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false}/>
                                    <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }}/>
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                                    <Bar dataKey="delivered_count" name="Delivered" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="opened_count" name="Opened" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="clicked_count" name="Clicked" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex justify-center items-center h-full text-muted-foreground text-sm">No deliverability data found.</div>
                        )}
                    </CardContent>
                </Card>
                
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Bounce Breakdown</CardTitle>
                        <CardDescription>Total Bounces: {totalStats?.bounced_count || 0}</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                        {bounceChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={bounceChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>
                                        {bounceChartData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }}/>
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex justify-center items-center h-full text-muted-foreground text-sm">No bounces recorded.</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card className="border-t-4 border-t-primary shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/20 border-b">
                    <div>
                        <CardTitle className="text-base font-semibold">Message Log</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={messageStatusFilter} onValueChange={setMessageStatusFilter}>
                            <SelectTrigger className="w-[140px] h-8 text-xs bg-background">
                                <SelectValue placeholder="Filter status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="Delivered">Delivered</SelectItem>
                                <SelectItem value="Bounced">Bounced</SelectItem>
                                <SelectItem value="Deferred">Deferred</SelectItem>
                                <SelectItem value="Failed">Failed</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button onClick={handleExport} variant="outline" size="sm" className="h-8">
                            <Download className="mr-2 h-3.5 w-3.5" /> Export
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-auto bg-background">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[120px]">Status</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Recipient</TableHead>
                                    <TableHead className="text-right">Sent At</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingMessages ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" /> Fetching logs...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : !messagesData?.data?.length ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-sm">
                                            No messages found for the selected filter.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    messagesData.data.map((message: any) => (
                                        <TableRow key={message.id} className="group hover:bg-muted/50">
                                            <TableCell>
                                                {message.status === 'Delivered' && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1"><CheckCircle2 className="w-3 h-3" /> Delivered</Badge>}
                                                {(message.status === 'Failed' || message.status === 'Bounced') && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1"><XCircle className="w-3 h-3" /> {message.status}</Badge>}
                                                {message.status !== 'Delivered' && message.status !== 'Failed' && message.status !== 'Bounced' && <Badge variant="outline" className="bg-muted text-muted-foreground">{message.status}</Badge>}
                                            </TableCell>
                                            <TableCell className="font-medium text-sm truncate max-w-[250px]">{message.subject}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{message.recipient}</TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                                                {format(new Date(message.sent_at), "MMM d, HH:mm")}
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => fetchMessageDetails(message.id)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    
                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                        <div className="text-xs text-muted-foreground">
                            Logs sorted by newest first
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm" onClick={() => {
                                const newHistory = [...history];
                                const prevCursor = newHistory.pop();
                                setHistory(newHistory);
                                setCursor(prevCursor);
                            }} disabled={history.length === 0 || isLoadingMessages}>
                                <ChevronLeft className="h-4 w-4" /> Prev
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => {
                                if (messagesData?.pagination?.has_more) {
                                    setHistory(prev => [...prev, cursor]);
                                    setCursor(messagesData.pagination.next_cursor);
                                }
                            }} disabled={!messagesData?.pagination?.has_more || isLoadingMessages}>
                                Next <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!selectedMessageContent} onOpenChange={(open) => !open && setSelectedMessageContent(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-primary" /> API Response Details</DialogTitle>
                        <DialogDescription>Raw message details from Ahasend</DialogDescription>
                    </DialogHeader>
                    <Textarea
                        readOnly
                        value={selectedMessageContent || "Loading..."}
                        className="min-h-[350px] font-mono text-xs bg-slate-950 text-slate-50 border-0 rounded-md p-4 mt-2"
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
};