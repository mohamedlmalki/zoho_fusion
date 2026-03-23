import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Edit, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from "@/contexts/AccountContext";

// --- TYPES ---
interface Email {
  id: string;
  subject: string;
  body: string;
  status: string;
  creation_date: string;
  tags?: string[];
}

export default function Emails() {
  const { activeAccount } = useAccount();
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- FETCH EMAILS ---
  const { data: emails = [], isLoading, refetch } = useQuery({
    queryKey: ['buttondown-emails-list', activeAccount?.id],
    queryFn: async () => {
      if (!activeAccount) return [];
      const res = await fetch('/api/buttondown/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: activeAccount.apiKey })
      });
      if (!res.ok) throw new Error("Failed");
      return await res.json();
    },
    enabled: !!activeAccount
  });

  // --- UPDATE MUTATION ---
  const updateEmailMutation = useMutation({
    mutationFn: async (data: { emailId: string; subject: string; body: string }) => {
      const res = await fetch(`/api/buttondown/emails/${data.emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            apiKey: activeAccount?.apiKey,
            subject: data.subject,
            body: data.body 
        })
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Email updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['buttondown-emails-list', activeAccount?.id] });
      setIsEditModalOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update email", variant: "destructive" });
    },
  });

  const handleViewEmail = (email: Email) => {
    setSelectedEmail(email);
    setIsViewModalOpen(true);
  };

  const handleEditEmail = (email: Email) => {
    setSelectedEmail(email);
    setIsEditModalOpen(true);
  };

  const handleUpdateEmail = (data: { subject: string; body: string }) => {
    if (selectedEmail) {
      updateEmailMutation.mutate({ emailId: selectedEmail.id, ...data });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge className="bg-green-100 text-green-800 border-green-200">Sent</Badge>;
      case 'draft': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Draft</Badge>;
      case 'scheduled': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Scheduled</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!activeAccount) return <div className="p-8 text-center">Please select a Buttondown account.</div>;

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Email List</CardTitle>
            <CardDescription>View all your sent and draft emails.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
             <div className="text-center py-8 text-muted-foreground">Loading emails...</div>
          ) : emails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No emails found.</div>
          ) : (
            emails.map((email: Email) => (
              <div key={email.id} className="border rounded-lg p-4 hover:bg-muted/10 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">{email.subject}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {getStatusBadge(email.status)}
                      <span>{new Date(email.creation_date).toLocaleDateString()}</span>
                    </div>
                    {email.tags && email.tags.length > 0 && (
                      <div className="flex gap-1">
                        {email.tags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {/* VIEW BUTTON - Opens Content Modal */}
                    <Button variant="ghost" size="sm" onClick={() => handleViewEmail(email)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    
                    {/* EDIT BUTTON - Opens Edit Form */}
                    <Button variant="ghost" size="sm" onClick={() => handleEditEmail(email)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>

        {/* --- VIEW MODAL (Shows Content, NOT Stats) --- */}
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{selectedEmail?.subject}</DialogTitle>
              <DialogDescription>
                Created: {selectedEmail && new Date(selectedEmail.creation_date).toLocaleString()}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[50vh] w-full border rounded-md p-4 bg-muted/20">
              <div className="space-y-4">
                  <div>
                     <h4 className="text-sm font-semibold text-muted-foreground mb-2">Email Content:</h4>
                     <div 
                        className="prose prose-sm max-w-none dark:prose-invert bg-background p-4 rounded border" 
                        dangerouslySetInnerHTML={{ __html: selectedEmail?.body || '' }} 
                     />
                  </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* --- EDIT MODAL --- */}
        <EmailEditModal 
            isOpen={isEditModalOpen} 
            onClose={() => setIsEditModalOpen(false)} 
            email={selectedEmail} 
            onUpdate={handleUpdateEmail}
            isUpdating={updateEmailMutation.isPending}
        />
      </Card>
    </div>
  );
}

// --- INTERNAL COMPONENT: EDIT MODAL ---
function EmailEditModal({ isOpen, onClose, email, onUpdate, isUpdating }: any) {
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");

    // Sync state when opening
    if (isOpen && email && subject === "") {
        setSubject(email.subject);
        setBody(email.body);
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdate({ subject, body });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Edit Email</DialogTitle>
                    <DialogDescription>Update content for draft emails.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Subject</Label>
                        <Input value={subject} onChange={e => setSubject(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Body</Label>
                        <Textarea 
                            value={body} 
                            onChange={e => setBody(e.target.value)} 
                            rows={10} 
                            className="font-mono text-sm"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={isUpdating}>
                            {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}