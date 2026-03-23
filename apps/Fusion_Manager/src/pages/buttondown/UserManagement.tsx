import { useState, useEffect } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox"; // <--- Ensure this component exists
import { toast } from "@/hooks/use-toast";
import { Trash2, RefreshCw, Loader2 } from "lucide-react";

interface Subscriber {
  id: string;
  email: string;
  creation_date: string;
  tags: string[];
  type: string;
}

export default function ButtondownUserManagement() {
  const { activeAccount } = useAccount();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (activeAccount) fetchSubscribers();
  }, [activeAccount]);

  const fetchSubscribers = async () => {
    setLoading(true);
    setSelectedIds(new Set()); // Reset selection on reload
    try {
      const res = await fetch('/api/buttondown/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: activeAccount?.apiKey })
      });
      const data = await res.json();
      if (data.results) {
        setSubscribers(data.results.map((s: any) => ({
            id: s.id,
            email: s.email_address || s.email, 
            creation_date: s.creation_date,
            tags: s.tags || [],
            type: s.subscriber_type || s.type || 'regular'
        })));
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load subscribers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- SELECTION LOGIC ---
  const toggleSelectAll = () => {
      if (selectedIds.size === subscribers.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(subscribers.map(s => s.id)));
      }
  };

  const toggleSelectOne = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedIds(newSet);
  };

  // --- SINGLE DELETE ---
  const handleDelete = async (id: string, email: string) => {
      if (!confirm(`Are you sure you want to delete ${email}?`)) return;

      setIsDeleting(true);
      try {
          const res = await fetch(`/api/buttondown/subscribers/${id}/delete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ apiKey: activeAccount?.apiKey })
          });
          
          if (res.ok) {
              setSubscribers(prev => prev.filter(s => s.id !== id));
              // Remove from selection if it was selected
              const newSet = new Set(selectedIds);
              newSet.delete(id);
              setSelectedIds(newSet);
              
              toast({ title: "Success", description: "Subscriber deleted" });
          } else {
              throw new Error("Failed");
          }
      } catch (error) {
          toast({ title: "Error", description: "Could not delete subscriber", variant: "destructive" });
      } finally {
          setIsDeleting(false);
      }
  };

  // --- BULK DELETE ---
  const handleBulkDelete = async () => {
      if (selectedIds.size === 0) return;
      if (!confirm(`Are you sure you want to delete ${selectedIds.size} subscribers?`)) return;

      setIsDeleting(true);
      try {
          const res = await fetch('/api/buttondown/subscribers/bulk-delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  apiKey: activeAccount?.apiKey,
                  ids: Array.from(selectedIds)
              })
          });

          if (res.ok) {
              setSubscribers(prev => prev.filter(s => !selectedIds.has(s.id)));
              setSelectedIds(new Set()); // Clear selection
              toast({ title: "Success", description: "Selected subscribers deleted" });
          } else {
              throw new Error("Failed");
          }
      } catch (error) {
          toast({ title: "Error", description: "Bulk delete failed", variant: "destructive" });
      } finally {
          setIsDeleting(false);
      }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Subscribers</CardTitle>
            <CardDescription>View and manage your Buttondown audience.</CardDescription>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
                <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Delete Selected ({selectedIds.size})
                </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchSubscribers} disabled={loading || isDeleting}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                    <Checkbox 
                        checked={subscribers.length > 0 && selectedIds.size === subscribers.length}
                        onCheckedChange={toggleSelectAll}
                    />
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : subscribers.length > 0 ? (
                subscribers.map((sub) => (
                  <TableRow key={sub.id} data-state={selectedIds.has(sub.id) ? "selected" : undefined}>
                    <TableCell>
                        <Checkbox 
                            checked={selectedIds.has(sub.id)}
                            onCheckedChange={() => toggleSelectOne(sub.id)}
                        />
                    </TableCell>
                    <TableCell className="font-medium">{sub.email}</TableCell>
                    <TableCell>
                        <Badge variant="outline" className={sub.type === 'regular' ? 'bg-green-50 text-green-700' : ''}>
                            {sub.type}
                        </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {sub.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(sub.creation_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(sub.id, sub.email)}
                            disabled={isDeleting}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No subscribers found.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}