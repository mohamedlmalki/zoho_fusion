import { useState, useEffect } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Trash2, Users, Loader2, AlertTriangle, FileJson, ListPlus } from "lucide-react"; // ListPlus Added
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function SendpulseUserManagement() {
    const { activeAccount } = useAccount();
    const [lists, setLists] = useState<any[]>([]);
    const [selectedList, setSelectedList] = useState("");
    const [subscribers, setSubscribers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const [jobProgress, setJobProgress] = useState({ progress: 0, message: "" });

    useEffect(() => {
        if (activeAccount?.provider === 'sendpulse') fetchLists();
    }, [activeAccount]);

    useEffect(() => {
        if (selectedList) {
            fetchSubscribers();
            setSelectedEmails([]);
        }
    }, [selectedList]);

    const fetchLists = async () => {
        try {
            const res = await fetch('/api/sendpulse/lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: activeAccount?.apiKey, secretId: activeAccount?.apiUrl })
            });
            const data = await res.json();
            if (Array.isArray(data)) setLists(data);
        } catch (e) { 
            toast({ title: "Error", description: "Failed to load lists.", variant: "destructive" }); 
        }
    };

    const fetchSubscribers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/sendpulse/subscribers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: activeAccount?.apiKey, secretId: activeAccount?.apiUrl, addressBookId: selectedList })
            });
            const data = await res.json();
            setSubscribers(data.emails || []);
        } catch (e) {
            toast({ title: "Error", description: "Failed to load subscribers.", variant: "destructive" });
        } finally { setLoading(false); }
    };

    const handleDelete = async (emails: string[]) => {
        if (!confirm(`Are you sure you want to delete ${emails.length} subscriber(s)?`)) return;
        try {
            const res = await fetch('/api/sendpulse/subscribers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: activeAccount?.apiKey, secretId: activeAccount?.apiUrl, addressBookId: selectedList, emails })
            });
            if (res.ok) {
                toast({ title: "Success", description: "Subscribers deleted." });
                setSelectedEmails([]);
                fetchSubscribers();
            }
        } catch (e) { toast({ title: "Error", variant: "destructive" }); }
    };

    const handleBulkDeleteAll = async () => {
        if (!confirm("WARNING: This will delete EVERY subscriber in this list. Proceed?")) return;
        try {
            const res = await fetch(`/api/sendpulse/addressbooks/${selectedList}/all-subscribers`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: activeAccount?.apiKey, secretId: activeAccount?.apiUrl })
            });
            const data = await res.json();
            if (data.jobId) {
                setIsDeletingAll(true);
                pollJobStatus(data.jobId);
            }
        } catch (e) { toast({ title: "Error", variant: "destructive" }); }
    };

    const pollJobStatus = async (jobId: string) => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/jobs/${jobId}/status`);
                const job = await res.json();
                setJobProgress({ progress: job.progress, message: job.message });
                if (job.status === 'completed' || job.status === 'failed') {
                    clearInterval(interval);
                    setIsDeletingAll(false);
                    fetchSubscribers();
                }
            } catch (e) { clearInterval(interval); setIsDeletingAll(false); }
        }, 2000);
    };

    const toggleSelectAll = () => {
        if (selectedEmails.length === subscribers.length) setSelectedEmails([]);
        else setSelectedEmails(subscribers.map(s => s.email));
    };

    const toggleSelectEmail = (email: string) => {
        setSelectedEmails(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-60px)] flex flex-col animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="p-2 bg-primary/10 rounded-lg"><Users className="h-6 w-6 text-primary" /></div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">SendPulse User Management</h1>
                    <p className="text-sm text-muted-foreground">Manage your address books and subscribers.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                <Card className="flex flex-col h-full lg:col-span-1">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                        <CardTitle className="text-base font-semibold flex items-center gap-2"><ListPlus className="h-4 w-4" /> List Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Select Address Book *</Label>
                            <Select value={selectedList} onValueChange={setSelectedList} disabled={loading || isDeletingAll}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Choose a list..." /></SelectTrigger>
                                <SelectContent>{lists.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name} ({l.all_email_qty})</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <Separator className="my-2" />
                        <div className="space-y-3">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bulk Actions</Label>
                            <Button variant="destructive" className="w-full h-9 text-sm" onClick={handleBulkDeleteAll} disabled={!selectedList || isDeletingAll}><AlertTriangle className="h-4 w-4 mr-2" /> Empty Address Book</Button>
                            {isDeletingAll && (
                                <div className="space-y-2 pt-2">
                                    <div className="flex justify-between text-[10px] uppercase font-bold text-red-600"><span>{jobProgress.message}</span><span>{jobProgress.progress}%</span></div>
                                    <Progress value={jobProgress.progress} className="h-1.5 bg-red-100" />
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="flex flex-col h-full lg:col-span-2 overflow-hidden border-l-4 border-l-primary/20">
                    <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-base font-semibold flex items-center gap-2"><FileJson className="h-4 w-4" /> Subscriber List</CardTitle>
                        {selectedEmails.length > 0 && (
                            <Button variant="outline" size="sm" className="h-8 text-xs text-red-600 border-red-200 bg-red-50 hover:bg-red-100" onClick={() => handleDelete(selectedEmails)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Selected ({selectedEmails.length})</Button>
                        )}
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                        <div className="flex-1 overflow-auto bg-slate-50/50">
                            <Table>
                                <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                                    <TableRow className="h-9 hover:bg-background">
                                        <TableHead className="w-[50px]"><Checkbox checked={subscribers.length > 0 && selectedEmails.length === subscribers.length} onCheckedChange={toggleSelectAll} /></TableHead>
                                        <TableHead className="text-xs">Email Address</TableHead>
                                        <TableHead className="w-[120px] text-xs">Status</TableHead>
                                        <TableHead className="w-[60px] text-xs text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={4} className="h-32 text-center text-xs"><Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />Fetching...</TableCell></TableRow>
                                    ) : subscribers.length > 0 ? subscribers.map((sub, idx) => (
                                        <TableRow key={idx} className="h-9 group">
                                            <TableCell className="py-1"><Checkbox checked={selectedEmails.includes(sub.email)} onCheckedChange={() => toggleSelectEmail(sub.email)} /></TableCell>
                                            <TableCell className="text-xs font-medium py-1">{sub.email}</TableCell>
                                            <TableCell className="py-1"><Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 h-5 px-1.5 uppercase">{sub.status === 1 ? "Active" : "Inactive"}</Badge></TableCell>
                                            <TableCell className="text-right py-1"><Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete([sub.email])}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={4} className="h-32 text-center text-xs text-muted-foreground">No subscribers found.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}