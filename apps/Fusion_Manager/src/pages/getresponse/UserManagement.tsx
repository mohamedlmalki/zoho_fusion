import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import { toast } from 'sonner';

export const UserManagement: React.FC = () => {
    const { activeAccount } = useAccount();
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState('');
    const [contacts, setContacts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // --- NEW: SELECTION STATE ---
    const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

    useEffect(() => {
        if (!activeAccount) return;
        fetch(`/api/getresponse/campaigns?accountId=${activeAccount.id}`)
            .then(res => res.json())
            .then(data => { if (Array.isArray(data)) setCampaigns(data); });
    }, [activeAccount]);

    const fetchContacts = async () => {
        if (!activeAccount || !selectedCampaign) return;
        setIsLoading(true);
        setSelectedEmails([]); // Clear selection on refresh
        try {
            const res = await fetch(`/api/getresponse/contacts?accountId=${activeAccount.id}&campaignId=${selectedCampaign}&limit=100`);
            const data = await res.json();
            setContacts(data.contacts || []);
        } catch (error) {
            toast.error("Failed to fetch contacts");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (selectedCampaign) fetchContacts();
    }, [selectedCampaign]);

    // --- NEW: BULK DELETE LOGIC ---
    const handleBulkDelete = async () => {
        if (!activeAccount || selectedEmails.length === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedEmails.length} contacts?`)) return;
        
        try {
            const res = await fetch('/api/getresponse/contacts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    accountId: activeAccount.id, 
                    campaignId: selectedCampaign, 
                    emails: selectedEmails 
                })
            });
            if (res.ok) {
                toast.success(`${selectedEmails.length} contacts deleted successfully`);
                fetchContacts();
            } else {
                toast.error("Failed to delete contacts");
            }
        } catch (e) {
            toast.error("Error connecting to server");
        }
    };

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedEmails(contacts.map(c => c.email));
        } else {
            setSelectedEmails([]);
        }
    };

    const toggleSelectOne = (email: string, checked: boolean) => {
        if (checked) {
            setSelectedEmails(prev => [...prev, email]);
        } else {
            setSelectedEmails(prev => prev.filter(e => e !== email));
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><Users className="h-6 w-6 text-primary" /></div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
                        <p className="text-sm text-muted-foreground">Manage subscribers for {activeAccount?.name}.</p>
                    </div>
                </div>
                
                {/* --- NEW: BULK DELETE BUTTON --- */}
                {selectedEmails.length > 0 && (
                    <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="animate-in slide-in-from-right-2">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Selected ({selectedEmails.length})
                    </Button>
                )}
            </div>

            <Card className="shadow-sm border-t-4 border-t-primary">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-muted/20">
                    <CardTitle className="text-base font-semibold">Campaign Contacts</CardTitle>
                    <div className="flex items-center gap-2">
                        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                            <SelectTrigger className="w-[200px] h-9 bg-background"><SelectValue placeholder="Select a list..." /></SelectTrigger>
                            <SelectContent>
                                {campaigns.map(c => <SelectItem key={c.campaignId} value={c.campaignId}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={fetchContacts} disabled={!selectedCampaign || isLoading}>
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-background sticky top-0 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox 
                                        checked={selectedEmails.length === contacts.length && contacts.length > 0}
                                        onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                                    />
                                </TableHead>
                                <TableHead className="text-xs">Name</TableHead>
                                <TableHead className="text-xs">Email</TableHead>
                                <TableHead className="text-xs">Added On</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={4} className="h-32 text-center text-xs">Loading...</TableCell></TableRow>
                            ) : (
                                contacts.map((contact) => (
                                    <TableRow key={contact.contactId} className="h-9">
                                        <TableCell>
                                            <Checkbox 
                                                checked={selectedEmails.includes(contact.email)}
                                                onCheckedChange={(checked) => toggleSelectOne(contact.email, !!checked)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-sm font-medium">{contact.name || 'N/A'}</TableCell>
                                        <TableCell className="text-xs font-mono text-muted-foreground">{contact.email}</TableCell>
                                        <TableCell className="text-xs">{new Date(contact.createdOn).toLocaleDateString()}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};