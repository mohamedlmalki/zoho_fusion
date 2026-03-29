import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAccount } from "@/contexts/AccountContext"
import { useToast } from "@/hooks/use-toast"

interface AddAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddAccountDialog({ open, onOpenChange }: AddAccountDialogProps) {
  const { addAccount } = useAccount()
  const { toast } = useToast()
  
  const [name, setName] = useState("")
  const [provider, setProvider] = useState<any>("activecampaign")
  const [apiKey, setApiKey] = useState("")
  const [apiUrl, setApiUrl] = useState("")
  const [defaultFrom, setDefaultFrom] = useState("")
  const [defaultEvent, setDefaultEvent] = useState("")
  
  // Azure specific states
  const [credentials, setCredentials] = useState<any>({})
  const [isFetching, setIsFetching] = useState(false)
  const [fetchedProfiles, setFetchedProfiles] = useState<any[]>([])

  const updateCredential = (key: string, value: string) => {
    setCredentials((prev: any) => ({ ...prev, [key]: value }))
  }

  // Handle the Magic Fetch Button click
  const handleFetchAzure = async () => {
    if (!credentials.tenantId || !credentials.clientId || !credentials.clientSecret) {
        toast({ title: "Missing Credentials", description: "Please enter Tenant ID, Client ID, and Client Secret first.", variant: "destructive" });
        return;
    }
    setIsFetching(true);
    try {
        const res = await fetch('http://localhost:3001/api/acs/fetch-resources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenantId: credentials.tenantId,
                clientId: credentials.clientId,
                clientSecret: credentials.clientSecret
            })
        });
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);
        if (data.profiles && data.profiles.length > 0) {
            setFetchedProfiles(data.profiles);
            // Automatically select the first profile it finds!
            handleProfileSelect(data.profiles[0]);
            toast({ title: "Success!", description: `Found ${data.profiles.length} Azure configuration(s).`, className: "bg-green-50 text-green-900 border-green-200" });
        } else {
            toast({ title: "No Configs Found", description: "Could not find any Email Services in this account.", variant: "destructive" });
        }
    } catch (err: any) {
        toast({ title: "Fetch Failed", description: err.message, variant: "destructive" });
    } finally {
        setIsFetching(false);
    }
  }

  // Pre-fill the 6 complex inputs when a profile is selected from the dropdown
  const handleProfileSelect = (profile: any) => {
      setCredentials((prev: any) => ({
          ...prev,
          subscriptionId: profile.subscriptionId,
          resourceGroup: profile.resourceGroup,
          emailServiceName: profile.emailServiceName,
          domainName: profile.domainName,
          smtpUsername: profile.smtpUsername,
          senderAddress: profile.senderAddress
      }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Fallback logic for ACS using the Secret as its main API Key ID
    const finalApiKey = provider === 'acs' ? credentials.clientSecret || "acs-key" : apiKey;
    
    await addAccount({ 
        name, 
        provider, 
        apiKey: finalApiKey, 
        apiUrl, 
        defaultFrom, 
        defaultEvent, 
        credentials 
    })
    
    setName(""); setApiKey(""); setApiUrl(""); setDefaultFrom(""); setDefaultEvent(""); 
    setProvider("activecampaign"); setCredentials({}); setFetchedProfiles([]);
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader><DialogTitle>Add Integration Account</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid gap-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="omnisend">Omnisend</SelectItem>
                <SelectItem value="brevo">Brevo</SelectItem>
                <SelectItem value="buttondown">Buttondown</SelectItem>
                <SelectItem value="activecampaign">ActiveCampaign</SelectItem>
                <SelectItem value="benchmark">Benchmark Email</SelectItem>
                <SelectItem value="getresponse">GetResponse</SelectItem>
                <SelectItem value="loops">Loops</SelectItem>
                <SelectItem value="plunk">Plunk</SelectItem>
                <SelectItem value="mailersend">MailerSend</SelectItem>
                <SelectItem value="systemio">System.io</SelectItem>
                <SelectItem value="sendpulse">SendPulse</SelectItem>
                <SelectItem value="ahasend">Ahasend</SelectItem>
                <SelectItem value="emailit">Emailit</SelectItem>
                <SelectItem value="zohomail">Zoho Mail360</SelectItem> 
                <SelectItem value="acs">Azure ACS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Account Nickname</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. My Main Account" />
          </div>

          {/* --- AZURE ACS SPECIFIC FIELDS --- */}
          {provider === 'acs' && (
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 pb-2">
                
                {/* 1. THE TOP 3 MASTER KEYS (Manually Typed) */}
                <div className="grid gap-2">
                    <Label htmlFor="tenantId">Tenant ID (Directory ID)</Label>
                    <Input id="tenantId" type="text" value={credentials.tenantId || ''} onChange={(e) => updateCredential('tenantId', e.target.value)} placeholder="e.g., 8114..." required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="clientId">Client ID (Application ID)</Label>
                    <Input id="clientId" type="text" value={credentials.clientId || ''} onChange={(e) => updateCredential('clientId', e.target.value)} placeholder="e.g., bdbca..." required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="clientSecret">Client Secret</Label>
                    <Input id="clientSecret" type="text" value={credentials.clientSecret || ''} onChange={(e) => updateCredential('clientSecret', e.target.value)} placeholder="The Entra App Secret Value" required />
                </div>

                {/* 2. THE MAGIC FETCH BUTTON */}
                <div className="pt-2 pb-4 border-b border-muted">
                    <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={handleFetchAzure} 
                        disabled={isFetching} 
                        className="w-full bg-[#0078D4]/10 text-[#0078D4] hover:bg-[#0078D4]/20 border border-[#0078D4]/20"
                    >
                        {isFetching ? "Scanning Azure Account..." : "🪄 Auto-Fetch Azure Settings"}
                    </Button>
                </div>

                {/* 3. THE SMART DROPDOWN (Appears after fetch) */}
                {fetchedProfiles.length > 0 && (
                    <div className="grid gap-2 bg-muted/50 p-3 rounded-md border border-muted">
                        <Label className="text-[#0078D4] font-semibold">Found Configurations</Label>
                        <Select onValueChange={(val) => handleProfileSelect(fetchedProfiles[parseInt(val)])} defaultValue="0">
                            <SelectTrigger className="border-[#0078D4]/50">
                                <SelectValue placeholder="Select a fetched profile" />
                            </SelectTrigger>
                            <SelectContent>
                                {fetchedProfiles.map((p, idx) => (
                                    <SelectItem key={idx} value={idx.toString()}>{p.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">Selecting a profile fills the fields below automatically.</p>
                    </div>
                )}

                {/* 4. THE 6 AUTO-FILLED FIELDS (Still editable just in case) */}
                <div className="grid gap-2">
                    <Label htmlFor="subscriptionId">Azure Subscription ID</Label>
                    <Input id="subscriptionId" type="text" value={credentials.subscriptionId || ''} onChange={(e) => updateCredential('subscriptionId', e.target.value)} required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="resourceGroup">Resource Group Name</Label>
                    <Input id="resourceGroup" type="text" value={credentials.resourceGroup || ''} onChange={(e) => updateCredential('resourceGroup', e.target.value)} required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="emailServiceName">Email Service Name</Label>
                    <Input id="emailServiceName" type="text" value={credentials.emailServiceName || ''} onChange={(e) => updateCredential('emailServiceName', e.target.value)} required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="domainName">Domain Name</Label>
                    <Input id="domainName" type="text" value={credentials.domainName || ''} onChange={(e) => updateCredential('domainName', e.target.value)} required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="smtpUsername">SMTP Username</Label>
                    <Input id="smtpUsername" type="text" value={credentials.smtpUsername || ''} onChange={(e) => updateCredential('smtpUsername', e.target.value)} required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="senderAddress">Sender Address</Label>
                    <Input id="senderAddress" type="text" value={credentials.senderAddress || ''} onChange={(e) => updateCredential('senderAddress', e.target.value)} required />
                </div>
            </div>
          )}

          {/* --- GENERIC PROVIDER FIELDS --- */}
          {provider !== 'acs' && (
              <>
                <div className="grid gap-2">
                    <Label>
                        {provider === 'sendpulse' || provider === 'zohomail' ? 'Client ID' : 
                        (provider === 'plunk' || provider === 'emailit') ? 'Secret API Key' : 'API Key'} *
                    </Label>
                    <Input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} required />
                </div>

                {(provider === 'activecampaign' || provider === 'mailersend' || provider === 'sendpulse' || provider === 'ahasend' || provider === 'zohomail') && (
                    <div className="grid gap-2">
                        <Label>
                            {provider === 'sendpulse' || provider === 'zohomail' ? 'Client Secret' : 
                            provider === 'mailersend' ? 'Domain ID' : 
                            provider === 'ahasend' ? 'Ahasend Account ID' : 'API URL'} *
                        </Label>
                        <Input type="text" value={apiUrl} onChange={e => setApiUrl(e.target.value)} required={provider !== 'mailersend'} />
                    </div>
                )}
                
                {(provider === 'plunk' || provider === 'emailit' || provider === 'zohomail') && (
                    <div className="grid gap-2">
                        <Label>
                            {provider === 'zohomail' ? 'Refresh Token *' : 
                            provider === 'emailit' ? 'Default Audience ID (Optional)' : 'Default Event Name (Optional)'}
                        </Label>
                        <Input 
                            type="text"
                            value={defaultEvent} 
                            onChange={e => setDefaultEvent(e.target.value)} 
                            required={provider === 'zohomail'}
                            placeholder={provider === 'zohomail' ? "1000.xxxxxxxxxxxx" : ""} 
                        />
                    </div>
                )}

                {(provider === 'plunk' || provider === 'mailersend' || provider === 'ahasend' || provider === 'emailit') && (
                    <div className="grid gap-2">
                        <Label>Default "From" Email *</Label>
                        <Input type="text" value={defaultFrom} onChange={e => setDefaultFrom(e.target.value)} placeholder="hello@yourdomain.com" required />
                    </div>
                )}
              </>
          )}

          <Button type="submit" className="w-full mt-4">Save Account</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}