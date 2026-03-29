import React, { useState, useRef, useEffect } from 'react';
import { Send, FileText, Image as ImageIcon, Eye, Terminal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccount } from '@/contexts/AccountContext';
import { toast } from '@/hooks/use-toast';

export default function MailersendSendEmail() {
  const { activeAccount } = useAccount();
  
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [fromName, setFromName] = useState(''); 
  const [isSending, setIsSending] = useState(false);
  const [lastResponse, setLastResponse] = useState('');

  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageLink, setImageLink] = useState('');
  const [imageSize, setImageSize] = useState('100%');
  const [imageAlign, setImageAlign] = useState('center');

  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (activeAccount?.defaultFrom) {
      setFromAddress(activeAccount.defaultFrom);
    } else {
      setFromAddress('');
    }
  }, [activeAccount]);

  const handleInsertImage = () => {
    if (!imageUrl) return toast({ title: "Error", description: "Image URL is required", variant: "destructive" });
    let imgTag = `<img src="${imageUrl}" alt="Image" style="max-width: 100%; width: ${imageSize}; height: auto;" />`;
    if (imageLink) imgTag = `<a href="${imageLink}" target="_blank">${imgTag}</a>`;
    const wrapper = `<div style="text-align: ${imageAlign}; margin: 10px 0;">${imgTag}</div>`;

    if (contentRef.current) {
        const start = contentRef.current.selectionStart;
        const end = contentRef.current.selectionEnd;
        setContent(content.substring(0, start) + wrapper + content.substring(end));
    } else {
        setContent(prev => prev + wrapper);
    }
    setIsImageDialogOpen(false);
  };

  const handleSendEmail = async () => {
    setLastResponse(''); 
    if (!activeAccount) return toast({ title: "Error", description: "No account selected.", variant: "destructive" });
    if (!to || !subject || !content || !fromAddress) {
      return toast({ title: "Error", description: "Please fill in To, From, Subject, and Content.", variant: "destructive" });
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/mailersend/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: activeAccount.apiKey,
          to, subject, content, fromEmail: fromAddress, fromName
        }),
      });

      const result = await response.json();
      setLastResponse(JSON.stringify(result, null, 2));

      if (!response.ok) throw new Error(result.error || result.message || 'Failed to send');

      toast({ title: "Email Sent", description: `Successfully sent to ${to}` });
      setTo(''); setSubject(''); setContent('');
    } catch (error: any) {
      toast({ title: "Send Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Send className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Send Transactional Email</h1>
          <p className="text-sm text-muted-foreground">Send a single email instantly via MailerSend.</p>
        </div>
      </div>

      {!activeAccount && (
        <Alert variant="destructive" className="mb-6">
            <Terminal className="h-4 w-4" />
            <AlertTitle>No Account Selected</AlertTitle>
            <AlertDescription>Please select a MailerSend account from the sidebar.</AlertDescription>
        </Alert>
      )}

      <Card className="shadow-sm">
        <CardHeader className="bg-muted/20 border-b">
          <CardTitle className="text-lg">Compose Message</CardTitle>
          <CardDescription>Using account: <b>{activeAccount?.name || 'None'}</b></CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <Label>From Name</Label>
                <Input placeholder="My Company" value={fromName} onChange={(e) => setFromName(e.target.value)} disabled={isSending} />
            </div>
            <div className="space-y-2">
                <Label>From Email *</Label>
                <Input placeholder="marketing@example.com" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} disabled={isSending} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <Label>To *</Label>
                <Input placeholder="user@example.com" value={to} onChange={(e) => setTo(e.target.value)} disabled={isSending} />
            </div>
            <div className="space-y-2">
                <Label>Subject *</Label>
                <Input placeholder="Welcome to our service!" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isSending} />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label>Content (HTML) *</Label>
                <div className="flex space-x-2">
                    <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                                <ImageIcon className="w-3.5 h-3.5 mr-1.5" /> Image
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Insert Image</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <Input placeholder="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                                <Input placeholder="Link URL (Optional)" value={imageLink} onChange={(e) => setImageLink(e.target.value)} />
                                <div className="grid grid-cols-2 gap-4">
                                    <Input placeholder="Size (100%)" value={imageSize} onChange={(e) => setImageSize(e.target.value)} />
                                    <Select value={imageAlign} onValueChange={setImageAlign}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handleInsertImage}>Insert</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                                <Eye className="w-3.5 h-3.5 mr-1.5" /> Preview
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-white text-black">
                            <div dangerouslySetInnerHTML={{ __html: content }} />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
            <Textarea 
              ref={contentRef}
              placeholder="<h1>Hello!</h1>" 
              className="min-h-[300px] font-mono text-sm resize-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSending}
            />
          </div>

          {lastResponse && (
            <div className="space-y-2">
              <Label>Server Response</Label>
              <Textarea readOnly className="min-h-[100px] font-mono text-xs bg-slate-950 text-green-400" value={lastResponse} />
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSendEmail} disabled={isSending || !activeAccount} size="lg" className="w-full sm:w-auto">
              {isSending ? "Sending..." : <><Send className="w-4 h-4 mr-2" /> Send Email</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}