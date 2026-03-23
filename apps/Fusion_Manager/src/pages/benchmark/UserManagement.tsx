import { useState, useEffect, useCallback } from "react";
import { Users, Trash2, RefreshCw, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react"; 

const PAGE_SIZE = 20;

interface BenchmarkList {
    listId: string;
    name: string;
    count?: string;
}

interface BenchmarkContact {
    id: string; // Internal ID
    email: string;
    firstName: string;
    lastName: string;
    status: string; 
    dateAdded: string;
}

export default function UserManagement() {
  const { activeAccount } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lists, setLists] = useState<BenchmarkList[]>([]);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  
  const [subscribers, setSubscribers] = useState<BenchmarkContact[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const totalPages = Math.ceil(totalSubscribers / PAGE_SIZE);

  // Fetch Subscribers
  const fetchSubscribers = useCallback(async (listId: string, page: number) => {
    if (!activeAccount) return;
    setIsLoading(true);
    setSelectedContactIds([]); 
    
    try {
        const response = await fetch(`/api/benchmark/contacts-by-list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: activeAccount.apiKey,
                listId: listId,
                page: page,
                perPage: PAGE_SIZE
            })
        });
        const data = await response.json();
        setSubscribers(data.contacts || []);
        setTotalSubscribers(data.total || 0);
    } catch (error: any) {
        toast({ title: "Error", description: "Could not fetch subscribers.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [activeAccount]);

  // Fetch Lists
  useEffect(() => {
    const fetchLists = async () => {
        if (activeAccount) {
            try {
                const response = await fetch('/api/benchmark/lists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: activeAccount.apiKey })
                });
                const data = await response.json();
                if (Array.isArray(data)) setLists(data);
            } catch (error) {
                console.error("Error fetching lists", error);
            }
        }
    };
    fetchLists();
  }, [activeAccount]);

  // Trigger Fetch when List/Page changes
  useEffect(() => {
    if (selectedList && activeAccount) {
        fetchSubscribers(selectedList, currentPage);
    } else {
        setSubscribers([]);
    }
  }, [selectedList, currentPage, activeAccount, fetchSubscribers]);


  // BULK DELETE
  const handleBulkDelete = async () => {
    if(!activeAccount || !selectedList || selectedContactIds.length === 0) return;
    setIsDeleting(true);
    try {
         // Calls the new DELETE endpoint we created in the backend
         const response = await fetch(`/api/benchmark/lists/${selectedList}/contacts`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: activeAccount.apiKey,
                contactIds: selectedContactIds
            })
        });
        
        if (response.ok || response.status === 207) {
             toast({ title: "Success", description: `${selectedContactIds.length} contact(s) deleted.` });
             // Refresh list
             fetchSubscribers(selectedList, currentPage);
             setSelectedContactIds([]);
        } else {
             throw new Error("Failed to delete contacts");
        }

    } catch (error: any) {
         toast({ title: "Deletion Failed", description: "Could not delete subscribers.", variant: "destructive" });
    } finally {
        setIsDeleting(false);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedContactIds(prev => 
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
      if (selectedContactIds.length === subscribers.length) {
          setSelectedContactIds([]);
      } else {
          setSelectedContactIds(subscribers.map(s => s.id));
      }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-muted-foreground">Manage subscribers in your Benchmark Email lists.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscribers {selectedList && !isLoading ? `(${totalSubscribers})` : ''}</CardTitle>
          <div className="pt-4 flex flex-wrap gap-4 items-center">
            <Select onValueChange={(val) => { setSelectedList(val); setCurrentPage(1); }} value={selectedList ?? ""}>
                <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Select a list..." />
                </SelectTrigger>
                <SelectContent>
                    {lists.map(list => (
                        <SelectItem key={list.listId} value={list.listId}>{list.name} ({list.count})</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {selectedContactIds.length > 0 && (
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isDeleting}>
                           <Trash2 className="h-4 w-4 mr-2" />
                           {isDeleting ? 'Deleting...' : `Delete (${selectedContactIds.length})`}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete {selectedContactIds.length} subscribers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive">
                          Confirm Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
                                    checked={subscribers.length > 0 && selectedContactIds.length === subscribers.length}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                        ) : subscribers.length > 0 ? (
                            subscribers.map(sub => (
                                <TableRow key={sub.id}>
                                    <TableCell>
                                        <Checkbox 
                                            checked={selectedContactIds.includes(sub.id)}
                                            onCheckedChange={() => toggleSelectOne(sub.id)}
                                        />
                                    </TableCell>
                                    <TableCell>{sub.email}</TableCell>
                                    <TableCell>{sub.firstName} {sub.lastName}</TableCell>
                                    <TableCell>
                                        <Badge variant={sub.status === "1" ? "default" : "secondary"}>
                                            {sub.status === "1" ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {new Date(sub.dateAdded).toLocaleDateString()}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={5} className="text-center h-24">No subscribers found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            
            <div className="flex items-center justify-end space-x-2 py-4">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                <div className="text-sm">Page {currentPage} of {totalPages || 1}</div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages}>Next</Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}