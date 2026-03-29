import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Trash2, ShieldAlert, AtSign, Loader2, Download, Filter } from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import { toast } from 'sonner';

interface BounceEvent {
    id: string;
    email?: string;
    recipient?: string;    
    event?: string;
    bounceType?: string;   
    reason?: string;
    timestamp?: string;
    createdAt?: string;    
    accountKey?: string;   
    fromAddress?: string;  
}

export const BounceDashboard: React.FC = () => {
    const { activeAccount } = useAccount();
    const [bounces, setBounces] = useState<BounceEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [subAccounts, setSubAccounts] = useState<any[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
    
    // --- FILTERS STATE ---
    const [selectedSubAccount, setSelectedSubAccount] = useState<string>('all');
    const [selectedClassification, setSelectedClassification] = useState<string>('all');

    useEffect(() => {
        if (!activeAccount) return;
        const fetchSubAccounts = async () => {
            setIsLoadingAccounts(true);
            try {
                const res = await fetch(`/api/zohomail/sub-accounts?accountId=${activeAccount.id}`);
                const result = await res.json();
                
                let accountsList = [];
                if (result.data && Array.isArray(result.data)) accountsList = result.data;
                else if (Array.isArray(result)) accountsList = result;
                
                setSubAccounts(accountsList);
            } catch (err) {
                console.error("Failed to fetch sub-accounts", err);
            } finally {
                setIsLoadingAccounts(false);
            }
        };
        fetchSubAccounts();
    }, [activeAccount]);

    const fetchBounces = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/zohomail/bounces');
            const data = await res.json();
            if (Array.isArray(data)) setBounces(data);
        } catch (error) {
            toast.error("Failed to fetch bounce logs.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearBounces = async () => {
        if (!confirm("Are you sure you want to permanently clear all bounce logs?")) return;
        try {
            const res = await fetch('/api/zohomail/bounces', { method: 'DELETE' });
            if (res.ok) {
                toast.success("Bounce logs cleared.");
                setBounces([]);
            }
        } catch (error) {
            toast.error("Failed to clear logs.");
        }
    };

    useEffect(() => {
        fetchBounces();
    }, []);

    // --- APPLY FILTERS TO DATA ---
    const displayedBounces = useMemo(() => {
        return bounces.filter(b => {
            // 1. Account Filter
            let matchesAccount = true;
            if (selectedSubAccount !== 'all') {
                const selectedAccObj = subAccounts.find(a => a.emailAddress === selectedSubAccount);
                const matchKey = selectedAccObj ? selectedAccObj.account_key : null;
                
                matchesAccount = (matchKey && b.accountKey === matchKey) || 
                       b.accountKey === selectedSubAccount || 
                       b.fromAddress === selectedSubAccount || 
                       b.reason?.includes(selectedSubAccount);
            }

            // 2. Classification Filter (Hard Bounce, Soft Bounce, Spam)
            let matchesClass = true;
            if (selectedClassification !== 'all') {
                const displayEvent = (b.event || b.bounceType || 'bounce').toLowerCase();
                if (selectedClassification === 'hard bounce') matchesClass = displayEvent.includes('hard');
                else if (selectedClassification === 'soft bounce') matchesClass = displayEvent.includes('soft');
                else if (selectedClassification === 'spam') matchesClass = displayEvent.includes('spam');
            }

            return matchesAccount && matchesClass;
        });
    }, [bounces, selectedSubAccount, selectedClassification, subAccounts]);

    // --- EXPORT TXT FUNCTION (Uses the filtered list!) ---
    const handleExportTxt = () => {
        if (displayedBounces.length === 0) {
            toast.error("No bounces to export with current filters.");
            return;
        }

        const emails = displayedBounces
            .map(b => b.email || b.recipient || '')
            .filter(e => e.trim() !== '' && e !== 'Unknown');

        const uniqueEmails = [...new Set(emails)];

        if (uniqueEmails.length === 0) {
            toast.error("No valid emails found to export.");
            return;
        }

        const fileContent = uniqueEmails.join('\n');
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        const safeName = selectedSubAccount === 'all' ? 'all' : selectedSubAccount.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const typeName = selectedClassification.replace(/\s+/g, '_');
        link.download = `bounces_${safeName}_${typeName}_${new Date().toISOString().split('T')[0]}.txt`;
        
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Exported ${uniqueEmails.length} unique filtered emails!`);
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-fade-in">
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg"><ShieldAlert className="h-6 w-6 text-red-600" /></div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Bounce & Delivery Dashboard</h1>
                        <p className="text-sm text-muted-foreground">Live webhook logs mapped automatically to bounce classifications.</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    
                    {/* FROM ADDRESS FILTER */}
                    <div className="flex items-center gap-2 bg-muted/30 px-2 py-1 rounded-md border">
                        <AtSign className="h-4 w-4 text-slate-500" />
                        <Select value={selectedSubAccount} onValueChange={setSelectedSubAccount} disabled={isLoadingAccounts || subAccounts.length === 0}>
                            <SelectTrigger className="h-8 w-[220px] border-0 shadow-none bg-transparent focus:ring-0">
                                <SelectValue placeholder={isLoadingAccounts ? "Loading accounts..." : "Filter by Sender..."} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sending Addresses</SelectItem>
                                {subAccounts.map((acc: any, i: number) => (
                                    <SelectItem key={acc.account_key || i} value={acc.emailAddress}>{acc.emailAddress}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* BOUNCE TYPE FILTER */}
                    <div className="flex items-center gap-2 bg-muted/30 px-2 py-1 rounded-md border">
                        <Filter className="h-4 w-4 text-slate-500" />
                        <Select value={selectedClassification} onValueChange={setSelectedClassification}>
                            <SelectTrigger className="h-8 w-[160px] border-0 shadow-none bg-transparent focus:ring-0">
                                <SelectValue placeholder="Filter Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Bounces</SelectItem>
                                <SelectItem value="hard bounce">Hard Bounces</SelectItem>
                                <SelectItem value="soft bounce">Soft Bounces</SelectItem>
                                <SelectItem value="spam">Spam / Complaints</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* EXPORT BUTTON */}
                    <Button variant="secondary" size="sm" onClick={handleExportTxt} className="h-9 border bg-white hover:bg-slate-100" disabled={displayedBounces.length === 0}>
                        <Download className="w-4 h-4 mr-2" /> Export TXT
                    </Button>

                    {bounces.length > 0 && (
                        <Button variant="destructive" size="sm" onClick={handleClearBounces} className="h-9">
                            <Trash2 className="w-4 h-4 mr-2" /> Clear
                        </Button>
                    )}
                    
                    <Button variant="outline" size="sm" onClick={fetchBounces} disabled={isLoading} className="h-9">
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <div className="mb-6">
                <Card className="shadow-sm border-l-4 border-l-red-500 max-w-xs">
                    <CardContent className="p-6 flex flex-col justify-center items-center">
                        <div className="text-sm font-bold uppercase text-muted-foreground tracking-wider mb-2">
                            {selectedSubAccount === 'all' && selectedClassification === 'all' ? 'Total Bounces' : 'Filtered Results'}
                        </div>
                        <div className="text-4xl font-black text-slate-800">{displayedBounces.length}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b bg-muted/20">
                    <CardTitle className="text-base font-semibold">Recent Events</CardTitle>
                    <CardDescription>
                        {selectedSubAccount === 'all' && selectedClassification === 'all' 
                            ? 'All received bounce and spam complaints.' 
                            : 'Showing complaints matching your current filters.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-auto max-h-[600px] bg-slate-50/50">
                        <Table>
                            <TableHeader className="bg-background sticky top-0 shadow-sm z-10">
                                <TableRow className="h-9">
                                    <TableHead className="text-xs w-[200px]">Date</TableHead>
                                    <TableHead className="text-xs">Email</TableHead>
                                    <TableHead className="text-xs">Classification</TableHead>
                                    <TableHead className="text-xs">Raw Server Response</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-xs"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary"/>Loading...</TableCell></TableRow>
                                ) : displayedBounces.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-xs">No bounces match the current filters.</TableCell></TableRow>
                                ) : (
                                    displayedBounces.map((bounce) => {
                                        const displayEmail = bounce.email || bounce.recipient || 'Unknown';
                                        const displayEvent = bounce.event || bounce.bounceType || 'bounce';
                                        const displayTime = bounce.timestamp || bounce.createdAt || new Date().toISOString();
                                        const displayReason = bounce.reason || (bounce.accountKey ? `Account Key: ${bounce.accountKey}` : 'No reason provided');

                                        let badgeColor = "text-slate-600 border-slate-200 bg-slate-50";
                                        if (displayEvent.toLowerCase().includes('hard')) badgeColor = "text-red-700 border-red-200 bg-red-100";
                                        else if (displayEvent.toLowerCase().includes('soft')) badgeColor = "text-orange-600 border-orange-200 bg-orange-50";
                                        else if (displayEvent.toLowerCase().includes('spam')) badgeColor = "text-yellow-700 border-yellow-300 bg-yellow-100";

                                        return (
                                            <TableRow key={bounce.id} className="h-10 hover:bg-muted/50">
                                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {new Date(displayTime).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-sm font-medium">{displayEmail}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={`whitespace-nowrap ${badgeColor}`}>
                                                        {displayEvent.toUpperCase()}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-[500px] truncate" title={displayReason}>
                                                    {displayReason}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};