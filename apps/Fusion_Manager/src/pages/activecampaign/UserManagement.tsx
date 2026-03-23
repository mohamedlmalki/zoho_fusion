import { useState, useEffect, useCallback } from "react";
import { Users, Trash2, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

const PAGE_SIZE = 10;

interface List {
    listId: string;
    name: string;
}

interface Subscriber {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    cdate: string;
    contactListId?: string;
}

export default function UserManagement() {
  const { activeAccount } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [lists, setLists] = useState<List[]>([]);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [selectedContacts, setSelectedContacts] = useState<Subscriber[]>([]);

  const totalPages = Math.ceil(totalSubscribers / PAGE_SIZE);

  const fetchSubscribers = useCallback(async (listId: string, page: number) => {
    if (!activeAccount) return;
    setIsLoading(true);
    setSelectedContacts([]);
    try {
        const response = await fetch('/api/activecampaign/contacts-by-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: activeAccount.apiKey,
                apiUrl: activeAccount.apiUrl,
                listId: listId,
                page: page,
                perPage: PAGE_SIZE
            })
        });
        if (!response.ok) throw new Error("Failed to fetch subscribers");
        const data = await response.json();
        setSubscribers(data.contacts || []);
        setTotalSubscribers(data.total || 0);
    } catch (error) {
        toast({ title: "Error", description: "Could not fetch subscribers.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [activeAccount]);

  useEffect(() => {
    const fetchLists = async () => {
        if (activeAccount) {
            try {
                const response = await fetch('/api/activecampaign/lists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: activeAccount.apiKey, apiUrl: activeAccount.apiUrl })
                });
                if (!response.ok) throw new Error("Failed to fetch");
                const data = await response.json();
                setLists(data);
                setSelectedList(null);
                setSubscribers([]);
                setTotalSubscribers(0);
                setCurrentPage(1);
            } catch (error) {
                toast({ title: "Error", description: "Could not fetch lists.", variant: "destructive" });
            }
        }
    };
    fetchLists();
  }, [activeAccount]);

  useEffect(() => {
    if (selectedList) {
        fetchSubscribers(selectedList, currentPage);
    }
  }, [selectedList, currentPage, fetchSubscribers]);
  
  const handleListChange = (listId: string) => {
    setSelectedList(listId);
    setCurrentPage(1);
  };
  
  const handleBulkUnsubscribe = async () => {
    if(!activeAccount || !selectedList || selectedContacts.length === 0) return;
    try {
         const response = await fetch('/api/activecampaign/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: activeAccount.apiKey,
                apiUrl: activeAccount.apiUrl,
                contacts: selectedContacts
            })
        });
        if (!response.ok) throw new Error("Failed to unsubscribe");
        toast({ title: "Success", description: `${selectedContacts.length} subscriber(s) have been unsubscribed.` });
        if (selectedList) fetchSubscribers(selectedList, currentPage);
    } catch (error) {
         toast({ title: "Error", description: "Could not unsubscribe subscribers.", variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    if(!activeAccount || selectedContacts.length === 0) return;
    try {
        const contactIds = selectedContacts.map(c => c.id);
        const response = await fetch('/api/activecampaign/delete-contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: activeAccount.apiKey,
                apiUrl: activeAccount.apiUrl,
                contactIds: contactIds
            })
        });
        if (!response.ok) throw new Error("Failed to delete contacts");
        toast({ title: "Success", description: `${selectedContacts.length} subscriber(s) have been permanently deleted.` });
        if (selectedList) fetchSubscribers(selectedList, currentPage);
    } catch (error) {
        toast({ title: "Error", description: "Could not delete subscribers.", variant: "destructive" });
    }
  };

  const toggleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked === true) {
        setSelectedContacts(subscribers);
    } else {
        setSelectedContacts([]);
    }
  };
  
  const toggleSelectOne = (contact: Subscriber, checked: boolean) => {
    if (checked) {
        setSelectedContacts(prev => [...prev, contact]);
    } else {
        setSelectedContacts(prev => prev.filter(c => c.id !== contact.id));
    }
  };

  const isAllSelected = selectedContacts.length === subscribers.length && subscribers.length > 0;
  const isSomeSelected = selectedContacts.length > 0 && selectedContacts.length < subscribers.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-muted-foreground">View and manage subscribers in your lists.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscribers ({totalSubscribers} Total)</CardTitle>
          <CardDescription>Select a list to view the subscribers within it.</CardDescription>
          <div className="pt-4 flex flex-wrap gap-4 items-center">
            <Select onValueChange={handleListChange} disabled={!activeAccount} value={selectedList ?? ""}>
                <SelectTrigger className="w-full md:w-auto md:min-w-64">
                    <SelectValue placeholder="Select a list..." />
                </SelectTrigger>
                <SelectContent>
                    {lists.map(list => (
                        <SelectItem key={list.listId} value={list.listId}>{list.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {selectedContacts.length > 0 && (
                <div className="flex gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                               <UserX className="h-4 w-4 mr-2" />
                               Unsubscribe ({selectedContacts.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will unsubscribe <strong>{selectedContacts.length} subscriber(s)</strong> from this list. They will remain in your account.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBulkUnsubscribe} className={buttonVariants({ variant: 'destructive' })}>
                              Confirm Unsubscribe
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                               <Trash2 className="h-4 w-4 mr-2" />
                               Delete ({selectedContacts.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will <strong className="text-destructive-foreground">permanently delete</strong> {selectedContacts.length} subscriber(s) from your entire ActiveCampaign account. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBulkDelete} className={buttonVariants({ variant: 'destructive' })}>
                              Confirm Permanent Deletion
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox 
                                    onCheckedChange={toggleSelectAll}
                                    checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
                                    aria-label="Select all rows on this page"
                                />
                            </TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Added Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>
                        ) : subscribers.length > 0 ? (
                            subscribers.map(sub => (
                                <TableRow key={sub.id}>
                                    <TableCell>
                                        <Checkbox 
                                            onCheckedChange={(checked) => toggleSelectOne(sub, !!checked)}
                                            checked={selectedContacts.some(c => c.id === sub.id)}
                                            aria-label={`Select row for ${sub.email}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{sub.email}</TableCell>
                                    <TableCell>{`${sub.firstName} ${sub.lastName}`.trim() || '-'}</TableCell>
                                    <TableCell>{new Date(sub.cdate).toLocaleDateString()}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow><TableCell colSpan={4} className="text-center">No subscribers found in this list.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    disabled={currentPage === 1}
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage >= totalPages || totalPages === 0}
                >
                    Next
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}