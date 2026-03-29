import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BarChart2, CheckCircle2, XCircle, MousePointerClick, MailOpen, AlertTriangle, MessageSquareMore, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccount } from "@/contexts/AccountContext";

// Types
type EmailEventType = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'rejected' | 'unsubscribed' | 'complained' | 'replied';

interface EmailAnalyticsData {
  recipients: number;
  deliveries: number;
  opens: number;
  clicks: number;
  temporary_failures: number;
  permanent_failures: number;
  unsubscriptions: number;
  complaints: number;
  replies?: number;
}

export default function Analytics() {
  const { activeAccount } = useAccount();
  const [selectedEmailId, setSelectedEmailId] = useState<string>('');
  const [selectedEventType, setSelectedEventType] = useState<EmailEventType | ''>('');

  // 1. Fetch Emails
  const { data: emails = [], isLoading: loadingEmails, error: emailsError } = useQuery({
    queryKey: ['buttondown-emails', activeAccount?.id],
    queryFn: async () => {
        if (!activeAccount) return [];
        const res = await fetch('/api/buttondown/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: activeAccount.apiKey })
        });
        if (!res.ok) throw new Error("Failed to fetch emails");
        return await res.json();
    },
    enabled: !!activeAccount,
  });

  // 2. Fetch Analytics (FIXED URL)
  const { data: analyticsData, isLoading: loadingAnalytics } = useQuery<EmailAnalyticsData>({
    queryKey: ['buttondown-analytics', selectedEmailId, activeAccount?.id],
    queryFn: async () => {
        if (!selectedEmailId || !activeAccount) throw new Error("Missing requirements");
        // FIXED: URL now matches backend route /emails/:id/analytics
        const res = await fetch(`/api/buttondown/emails/${selectedEmailId}/analytics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: activeAccount.apiKey })
        });
        if (!res.ok) return null;
        return await res.json();
    },
    enabled: !!selectedEmailId && !!activeAccount,
  });

  // 3. Fetch Events (FIXED URL)
  const { data: eventsData, isLoading: loadingEvents } = useQuery({
    queryKey: ['buttondown-events', selectedEmailId, selectedEventType, activeAccount?.id],
    queryFn: async () => {
        if (!selectedEmailId || !selectedEventType || !activeAccount) return [];
        // FIXED: URL now matches backend route /events
        const res = await fetch(`/api/buttondown/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                apiKey: activeAccount.apiKey, 
                emailId: selectedEmailId, 
                eventType: selectedEventType 
            })
        });
        if (!res.ok) return [];
        return await res.json();
    },
    enabled: !!selectedEmailId && !!selectedEventType && !!activeAccount,
  });

  const eventTypes: { value: EmailEventType; label: string; icon: any }[] = [
    { value: 'sent', label: 'Sent', icon: MailOpen },
    { value: 'delivered', label: 'Delivered', icon: CheckCircle2 },
    { value: 'opened', label: 'Opened', icon: MailOpen },
    { value: 'clicked', label: 'Clicked', icon: MousePointerClick },
    { value: 'bounced', label: 'Bounced', icon: XCircle },
    { value: 'unsubscribed', label: 'Unsubscribed', icon: AlertTriangle },
    { value: 'complained', label: 'Complained', icon: AlertTriangle },
    { value: 'replied', label: 'Replied', icon: MessageSquareMore },
  ];

  const getMetricDisplay = (label: string, value: number | undefined, tooltipText: string, textColorClass?: string) => (
    <div className="flex flex-col items-center p-3 border rounded-lg bg-muted/20">
      <h4 className="text-sm font-semibold text-muted-foreground mb-1">{label}</h4>
      <p className={cn("text-xl font-bold", textColorClass)}>{value !== undefined ? value : '-'}</p>
      <span className="text-xs text-muted-foreground text-center px-1">{tooltipText}</span>
    </div>
  );

  return (
    <div className="p-6">
        <Card className="max-w-6xl mx-auto">
        <CardHeader>
            <CardTitle className="text-3xl font-bold flex items-center gap-2">
            <BarChart2 className="w-7 h-7" /> Email Analytics
            </CardTitle>
            <CardDescription>View performance metrics and events.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            
            {loadingEmails ? (
            <div className="text-center py-4 text-muted-foreground flex justify-center items-center gap-2">
                <Loader2 className="animate-spin h-4 w-4" /> Loading emails...
            </div>
            ) : emailsError ? (
            <div className="text-center py-4 text-destructive">Error loading emails. Check API Key.</div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                <h3 className="text-lg font-semibold mb-2">Select Email</h3>
                <Select value={selectedEmailId} onValueChange={setSelectedEmailId}>
                    <SelectTrigger>
                    <SelectValue placeholder="Select an email" />
                    </SelectTrigger>
                    <SelectContent>
                    {emails.map((email: any) => (
                        <SelectItem key={email.id} value={email.id}>
                        {email.subject}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                </div>
                {selectedEmailId && (
                <div>
                    <h3 className="text-lg font-semibold mb-2">Event Log Filter</h3>
                    <Select value={selectedEventType} onValueChange={(value) => setSelectedEventType(value as EmailEventType)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select an event type" />
                    </SelectTrigger>
                    <SelectContent>
                        {eventTypes.map((eventType) => (
                        <SelectItem key={eventType.value} value={eventType.value}>
                            <div className="flex items-center gap-2">
                            <eventType.icon className="w-4 h-4" />
                            <span>{eventType.label}</span>
                            </div>
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>
                )}
            </div>
            )}

            {selectedEmailId && (
            <div className="space-y-6 mt-6">
                <Separator />
                <h3 className="text-xl font-bold">Metrics</h3>
                {loadingAnalytics ? (
                <div className="text-center py-4 text-muted-foreground"><Loader2 className="animate-spin h-4 w-4 inline mr-2" />Loading...</div>
                ) : !analyticsData ? (
                <div className="text-center py-4 text-muted-foreground">No data available.</div>
                ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {getMetricDisplay("Recipients", analyticsData.recipients, "Total recipients")}
                    {getMetricDisplay("Deliveries", analyticsData.deliveries, "Delivered", "text-green-600")}
                    {getMetricDisplay("Opens", analyticsData.opens, "Opens", "text-blue-600")}
                    {getMetricDisplay("Clicks", analyticsData.clicks, "Clicks", "text-purple-600")}
                    {getMetricDisplay("Unsubs", analyticsData.unsubscriptions, "Unsubscribes", "text-red-600")}
                    {getMetricDisplay("Failures", analyticsData.permanent_failures, "Failures", "text-destructive")}
                    {getMetricDisplay("Spam", analyticsData.complaints, "Complaints", "text-orange-600")}
                </div>
                )}

                {selectedEventType && (
                <>
                    <Separator />
                    <h3 className="text-xl font-bold">Event Log: {selectedEventType}</h3>
                    {loadingEvents ? (
                    <div className="text-center py-4"><Loader2 className="animate-spin h-4 w-4 inline" /></div>
                    ) : (
                    <ScrollArea className="h-[300px] border rounded-lg p-4 bg-muted/10">
                        <div className="space-y-3">
                        {eventsData?.map((event: any, i: number) => (
                            <div key={i} className="p-3 border rounded-md bg-background/50 text-sm">
                            <p className="font-semibold text-foreground">{event.subscriber_email || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{new Date(event.creation_date).toLocaleString()}</p>
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">Meta: {JSON.stringify(event.metadata)}</p>
                            )}
                            </div>
                        ))}
                        {(!eventsData || eventsData.length === 0) && (
                            <div className="text-center py-4 text-muted-foreground">No events found.</div>
                        )}
                        </div>
                    </ScrollArea>
                    )}
                </>
                )}
            </div>
            )}
        </CardContent>
        </Card>
    </div>
  );
}