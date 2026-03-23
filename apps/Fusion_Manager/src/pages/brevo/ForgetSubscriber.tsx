import { useState } from "react";
import { UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "@/hooks/use-toast";

export default function ForgetSubscriber() {
  const { activeAccount } = useAccount();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;
    setLoading(true);
    try {
      // Brevo API call to delete (using existing delete endpoint)
      await fetch("/api/brevo/delete-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: activeAccount.apiKey, emails: [email] })
      });
      toast({ title: "Success", description: `Subscriber ${email} deleted.` });
      setEmail("");
    } catch (error) { toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2"><UserX className="w-5 h-5 text-primary" /><h1 className="text-2xl font-semibold">Forget Subscriber</h1></div>
      <Card className="max-w-md">
          <CardHeader><CardTitle>GDPR Delete</CardTitle><CardDescription>Permanently remove a user from Brevo.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} required /></div>
              <Button type="submit" className="w-full" disabled={loading || !activeAccount}>Forget Subscriber</Button>
            </form>
          </CardContent>
      </Card>
    </div>
  );
}