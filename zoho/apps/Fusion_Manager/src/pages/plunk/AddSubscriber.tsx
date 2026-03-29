import React, { useState } from 'react';
import { Send, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAccount } from '@/contexts/AccountContext';
import { toast } from 'sonner';

export const AddSubscriber: React.FC = () => {
    const { activeAccount } = useAccount();
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!to || !subject || !content) return toast.error("Missing fields");
        setLoading(true);
        try {
            const res = await fetch('/api/plunk/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secretKey: activeAccount?.apiKey, to, subject, content })
            });
            if (res.ok) { toast.success("Sent!"); setTo(''); setSubject(''); setContent(''); }
        } catch (e) { toast.error("Error"); } finally { setLoading(false); }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg"><Mail className="h-6 w-6 text-primary" /></div>
                <div><h1 className="text-2xl font-bold tracking-tight">Transactional Email</h1><p className="text-sm text-muted-foreground">Send a single HTML email message.</p></div>
            </div>
            <Card>
                <CardHeader className="border-b bg-muted/20"><CardTitle className="text-base font-semibold">Message Details</CardTitle></CardHeader>
                <CardContent className="p-6 space-y-4">
                    <div className="space-y-2"><Label className="text-xs uppercase">Recipient</Label><Input value={to} onChange={e => setTo(e.target.value)} placeholder="user@example.com" /></div>
                    <div className="space-y-2"><Label className="text-xs uppercase">Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} /></div>
                    <div className="space-y-2"><Label className="text-xs uppercase">HTML Content</Label><Textarea value={content} onChange={e => setContent(e.target.value)} className="min-h-[300px] font-mono text-sm" /></div>
                    <Button onClick={handleSend} disabled={loading} className="w-full"><Send className="mr-2 h-4 w-4" /> {loading ? "Sending..." : "Send Email"}</Button>
                </CardContent>
            </Card>
        </div>
    );
};