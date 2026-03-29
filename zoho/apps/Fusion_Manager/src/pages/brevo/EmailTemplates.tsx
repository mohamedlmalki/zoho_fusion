import { useState, useEffect, useCallback } from "react";
import { Mail, Edit, Eye, RefreshCw } from "lucide-react";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PreviewDialog } from "@/components/PreviewDialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function EmailTemplates() {
  const { activeAccount } = useAccount();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [formData, setFormData] = useState({ subject: "", senderName: "", htmlContent: "" });

  const fetchTemplates = useCallback(async () => {
      if (!activeAccount?.apiKey || activeAccount.status !== 'connected') return;
      setLoading(true);
      try {
          const response = await fetch('/api/brevo/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: activeAccount.apiKey }),
          });
          const data = await response.json();
          setTemplates(data.templates || []);
      } catch (error) { toast({ title: "Error", description: "Failed to fetch templates", variant: "destructive" }); }
      finally { setLoading(false); }
  }, [activeAccount]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleEditClick = (template: any) => {
      setSelectedTemplate(template);
      setFormData({ subject: template.subject || "", senderName: template.sender?.name || "", htmlContent: template.htmlContent || "" });
      setIsModalOpen(true);
  };

  const handleSaveChanges = async () => {
      if (!activeAccount || !selectedTemplate || isSaving) return;
      setIsSaving(true);
      try {
          const payload: any = { apiKey: activeAccount.apiKey, subject: formData.subject, htmlContent: formData.htmlContent, sender: { name: formData.senderName } };
          if (selectedTemplate.sender?.id) payload.originalSenderId = selectedTemplate.sender.id;
          else if (selectedTemplate.sender?.email) payload.sender.email = selectedTemplate.sender.email;

          await fetch(`/api/brevo/templates/${selectedTemplate.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          toast({ title: "Success", description: "Template updated."});
          setIsModalOpen(false);
          fetchTemplates();
      } catch (error) { toast({ title: "Error", description: "Update failed", variant: "destructive" }); }
      finally { setIsSaving(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Mail className="w-5 h-5 text-primary" /><h1 className="text-2xl font-semibold">Templates</h1></div><Button variant="outline" size="sm" onClick={fetchTemplates} disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button></div>
      <Card>
        <CardHeader><CardTitle>Active Templates</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Subject</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow> : templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.name}</TableCell><TableCell>{t.subject}</TableCell>
                      <TableCell>{t.isActive ? <Badge className="bg-green-600">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleEditClick(t)}><Edit className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Edit: {selectedTemplate?.name}</DialogTitle></DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Subject</Label><Input value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Sender Name</Label><Input value={formData.senderName} onChange={e => setFormData({...formData, senderName: e.target.value})} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-start gap-4"><Label className="text-right pt-2">HTML</Label><Textarea value={formData.htmlContent} onChange={e => setFormData({...formData, htmlContent: e.target.value})} className="col-span-3 font-mono text-xs" rows={15} /></div>
            </div>
          </ScrollArea>
          <DialogFooter><PreviewDialog htmlContent={formData.htmlContent}><Button variant="outline"><Eye className="mr-2 h-4 w-4" /> Preview</Button></PreviewDialog><Button onClick={handleSaveChanges} disabled={isSaving}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}