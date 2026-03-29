import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Trash2, Users, Loader2, AlertCircle } from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import { toast } from 'sonner';

export const UserManagement: React.FC = () => {
    const { activeAccount } = useAccount();
    const [searchEmail, setSearchEmail] = useState('');
    const [contact, setContact] = useState<any | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeAccount || !searchEmail.trim()) return;

        setIsSearching(true);
        setContact(null);
        try {
            const res = await fetch(`/api/loops/contacts/find?accountId=${activeAccount.id}&email=${encodeURIComponent(searchEmail)}`);
            const data = await res.json();
            
            if (Array.isArray(data) && data.length > 0) {
                setContact(data[0]);
            } else {
                toast.error("Contact not found in audience.");
            }
        } catch (error) {
            toast.error("Error searching for contact.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleDelete = async () => {
        if (!activeAccount || !contact) return;
        if (!confirm(`Are you sure you want to permanently delete ${contact.email}?`)) return;

        setIsDeleting(true);
        try {
            const res = await fetch('/api/loops/contacts/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: activeAccount.id, email: contact.email })
            });
            const data = await res.json();

            if (data.success) {
                toast.success("Contact deleted successfully.");
                setContact(null);
                setSearchEmail('');
            } else {
                toast.error(data.message || "Failed to delete contact.");
            }
        } catch (error) {
            toast.error("Error deleting contact.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="p-6 max-w-3xl mx-auto animate-fade-in mt-10">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg"><Users className="h-6 w-6 text-primary" /></div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Audience Search</h1>
                    <p className="text-sm text-muted-foreground">Find and manage individual contacts in your Loops audience.</p>
                </div>
            </div>

            <Card className="shadow-sm border-t-4 border-t-primary mb-6">
                <CardHeader>
                    <CardTitle className="text-lg">Find Contact</CardTitle>
                    <CardDescription>Enter an email address to view their details or remove them.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSearch} className="flex gap-3">
                        <Input 
                            type="email" 
                            placeholder="user@domain.com" 
                            value={searchEmail}
                            onChange={(e) => setSearchEmail(e.target.value)}
                            className="flex-1"
                            required
                        />
                        <Button type="submit" disabled={isSearching || !searchEmail}>
                            {isSearching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                            Search
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {contact && (
                <Card className="border-green-200 bg-green-50/30 animate-in slide-in-from-bottom-4">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{contact.firstName} {contact.lastName}</h3>
                                <p className="text-slate-600 font-mono mt-1">{contact.email}</p>
                                
                                <div className="mt-4 space-y-1 text-sm text-slate-600">
                                    <p><strong>ID:</strong> {contact.id}</p>
                                    <p><strong>Source:</strong> {contact.source || 'Unknown'}</p>
                                    <p><strong>Subscribed:</strong> {contact.subscribed ? 'Yes' : 'No'}</p>
                                </div>
                            </div>
                            
                            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                Delete Contact
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};