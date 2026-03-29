import { useState, useEffect, useCallback } from "react";
import { Users, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button"; 
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 10;

export default function UserManagement() {
  const { activeAccount } = useAccount();
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [lists, setLists] = useState<any[]>([]);
  const [selectedList, setSelectedList] = useState<string | null>(null);

  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSubscribersInList, setTotalSubscribersInList] = useState(0);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const totalPages = Math.ceil(totalSubscribersInList / PAGE_SIZE);

  const fetchSubscribers = useCallback(async (listId: string, page: number) => {
    if (!activeAccount || !listId) return;
    setIsLoadingContacts(true);
    setSelectedEmails([]);
    setSubscribers([]);
    try {
        const response = await fetch('/api/brevo/list-contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: activeAccount.apiKey,
                listId: listId,
                page: page,
                perPage: PAGE_SIZE
            })
        });
        if (!response.ok) throw new Error("Failed to fetch subscribers");
        const data = await response.json();
        setSubscribers(data.contacts || []);
        setTotalSubscribersInList(data.total || 0);
    } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
        setIsLoadingContacts(false);
    }
  }, [activeAccount]);

  useEffect(() => {
    const fetchLists = async () => {
        if (activeAccount && activeAccount.apiKey && activeAccount.status === 'connected') {
            setIsLoadingLists(true);
            try {
                const response = await fetch('/api/brevo/lists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: activeAccount.apiKey })
                });
                const data = await response.json();
                setLists(Array.isArray(data) ? data : []);
            } catch (error) { setLists([]); } 
            finally { setIsLoadingLists(false); }
        }
    };
    fetchLists();
  }, [activeAccount]);

  useEffect(() => {
    if (selectedList && activeAccount?.status === 'connected') {
        fetchSubscribers(selectedList, currentPage);
    }
  }, [selectedList, currentPage, fetchSubscribers]);

  const handleBulkDelete = async () => {
    if(!activeAccount || !selectedList || selectedEmails.length === 0) return;
    setIsDeleting(true);
    try {
         const response = await fetch('/api/brevo/delete-contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: activeAccount.apiKey, emails: selectedEmails })
        });
        await response.json();
        toast({ title: "Success", description: "Selected subscribers deleted." });
        fetchSubscribers(selectedList, currentPage);
    } catch (error) {
         toast({ title: "Error", description: "Deletion failed.", variant: "destructive" });
    } finally {
        setIsDeleting(false);
    }
  };

  const toggleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked === true) setSelectedEmails(subscribers.map(s => s.email));
    else setSelectedEmails([]);
  };
  const toggleSelectOne = (email: string, checked: boolean) => {
    if (checked) setSelectedEmails(prev => [...prev, email]);
    else setSelectedEmails(prev => prev.filter(e => e !== email));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" /><div><h1 className="text-2xl font-semibold">User Management</h1><p className="text-muted-foreground">Manage Brevo subscribers.</p></div></div>
      <Card>
        <CardHeader>
          <CardTitle>Subscribers {selectedList ? `(${totalSubscribersInList})` : ''}</CardTitle>
          <div className="pt-4 flex flex-wrap gap-4 items-center">
            <Select onValueChange={(v) => { setSelectedList(v); setCurrentPage(1); }} disabled={!activeAccount} value={selectedList ?? ""}>
                <SelectTrigger className="w-full md:w-auto md:min-w-64"><SelectValue placeholder="Select a list..." /></SelectTrigger>
                <SelectContent>{lists.map(list => <SelectItem key={list.id} value={list.id.toString()}>{list.name}</SelectItem>)}</SelectContent>
            </Select>
            {selectedEmails.length > 0 && (
                 <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive" size="sm" disabled={isDeleting}><Trash2 className="h-4 w-4 mr-2" /> Delete ({selectedEmails.length})</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>Permanently delete {selectedEmails.length} subscribers?</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDelete} className={buttonVariants({ variant: "destructive" })}>Confirm</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border">
                <Table>
                    <TableHeader><TableRow><TableHead className="w-12"><Checkbox onCheckedChange={toggleSelectAll} /></TableHead><TableHead>Email</TableHead><TableHead>First Name</TableHead><TableHead>Last Name</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoadingContacts ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell></TableRow>) : subscribers.map(sub => (
                            <TableRow key={sub.id}>
                                <TableCell><Checkbox checked={selectedEmails.includes(sub.email)} onCheckedChange={(c) => toggleSelectOne(sub.email, !!c)} /></TableCell>
                                <TableCell>{sub.email}</TableCell><TableCell>{sub.attributes?.FIRSTNAME || '-'}</TableCell><TableCell>{sub.attributes?.LASTNAME || '-'}</TableCell><TableCell>{new Date(sub.createdAt).toLocaleDateString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {totalPages > 1 && <div className="flex justify-end gap-2 py-4"><Button variant="outline" size="sm" onClick={()=>setCurrentPage(p=>p-1)} disabled={currentPage===1}>Prev</Button><Button variant="outline" size="sm" onClick={()=>setCurrentPage(p=>p+1)} disabled={currentPage>=totalPages}>Next</Button></div>}
        </CardContent>
      </Card>
    </div>
  );
}