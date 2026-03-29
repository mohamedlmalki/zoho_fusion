import React, { useState } from "react";
import { Mail, Edit, Send, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

export const Transactional: React.FC = () => {
  const { activeAccount } = useAccount();
  const [recipients, setRecipients] = useState("");
  const [transactionalId, setTransactionalId] = useState("");
  const [dataVariables, setDataVariables] = useState("");
  const [isSending, setIsSending] = useState(false);

  const recipientList = recipients.trim().split('\n').filter(e => e.trim() !== '');

  const handleSendEmail = async () => {
    if (!activeAccount) return;
    if (recipientList.length === 0) return toast.error("Provide at least one recipient");
    if (!transactionalId.trim()) return toast.error("Transactional ID is required");

    setIsSending(true);
    try {
      const response = await fetch('/api/loops/transactional', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              accountId: activeAccount.id,
              recipients: recipientList,
              transactionalId: transactionalId.trim(),
              dataVariables: dataVariables.trim() || undefined
          })
      });
      
      const result = await response.json();
      
      if (result.success) {
          toast.success(`Successfully sent ${result.sentCount} emails.`);
          if (result.failedCount > 0) {
              toast.error(`${result.failedCount} emails failed to send.`);
          }
      } else {
          toast.error(result.error || "Failed to send emails");
      }
    } catch (error) {
      toast.error("Network error occurred.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg"><Mail className="h-6 w-6 text-primary" /></div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Send Transactional Email</h2>
          <p className="text-sm text-slate-600">Trigger template emails via the Loops API.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-base font-semibold flex justify-between items-center">
                    Recipients
                    <Badge variant="secondary">{recipientList.length} Emails</Badge>
                </CardTitle>
            </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Addresses (One per line)</Label>
              <Textarea
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="user@example.com"
                className="min-h-[300px] font-mono text-sm resize-y"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
           <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Edit className="h-4 w-4" /> Email Configuration
                </CardTitle>
            </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Transactional ID</Label>
              <Input
                value={transactionalId}
                onChange={(e) => setTransactionalId(e.target.value)}
                placeholder="clx..."
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Data Variables (Optional JSON)
              </Label>
              <Textarea
                value={dataVariables}
                onChange={(e) => setDataVariables(e.target.value)}
                placeholder={`{\n  "firstName": "John",\n  "resetLink": "https://..."\n}`}
                className="min-h-[160px] font-mono text-sm"
              />
            </div>

            <Button
                onClick={handleSendEmail}
                disabled={isSending || recipientList.length === 0 || !transactionalId.trim()}
                className="w-full h-10"
            >
                {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Trigger Transactional Emails
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}