import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Account } from "@/contexts/AccountContext"

interface EditAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account
  onUpdate: (id: string, data: Omit<Account, 'id' | 'status' | 'lastCheckResponse'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function EditAccountDialog({ open, onOpenChange, account, onUpdate, onDelete }: EditAccountDialogProps) {
  const [name, setName] = useState(account.name)
  const [apiKey, setApiKey] = useState(account.apiKey)
  const [apiUrl, setApiUrl] = useState(account.apiUrl || "")
  const [defaultFrom, setDefaultFrom] = useState(account.defaultFrom || "")
  const [defaultEvent, setDefaultEvent] = useState(account.defaultEvent || "")
  
  // State for all the Azure variables
  const [credentials, setCredentials] = useState<any>(account.credentials || {})

  const updateCredential = (key: string, value: string) => {
    setCredentials((prev: any) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    if (open) {
      setName(account.name);
      setApiKey(account.apiKey);
      setApiUrl(account.apiUrl || "");
      setDefaultFrom(account.defaultFrom || "");
      setDefaultEvent(account.defaultEvent || "");
      setCredentials(account.credentials || {});
    }
  }, [open, account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Ensure the main token matches the new client secret for Azure
    const finalApiKey = account.provider === 'acs' ? credentials.clientSecret || "acs-key" : apiKey;

    await onUpdate(account.id, { 
        name, 
        provider: account.provider, 
        apiKey: finalApiKey, 
        apiUrl, 
        defaultFrom, 
        defaultEvent,
        credentials // Save all 8 variables to the backend
    })
    onOpenChange(false)
  }

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this account?")) {
        await onDelete(account.id);
        onOpenChange(false);
    }
  }

  const provider = account.provider;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
            <DialogTitle>
                Edit {provider === 'acs' ? 'Azure ACS' : provider === 'getresponse' ? 'GetResponse' : provider === 'loops' ? 'Loops' : provider === 'zohomail' ? 'Zoho Mail360' : provider.charAt(0).toUpperCase() + provider.slice(1)} Account
            </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">

          <div className="grid gap-2">
            <Label>Account Nickname</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. My Main Account" />
          </div>

          {/* --- AZURE ACS SPECIFIC EDIT FIELDS --- */}
          {provider === 'acs' && (
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 pb-2">
                <div className="grid gap-2">
                    <Label htmlFor="tenantId">Tenant ID (Directory ID)</Label>
                    <Input id="tenantId" value={credentials.tenantId || ''} onChange={(e) => updateCredential('tenantId', e.target.value)} required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="clientId">Client ID (Application ID)</Label>
                    <Input id="clientId" value={credentials.clientId || ''} onChange={(e) => updateCredential('clientId', e.target.value)} required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="clientSecret">Client Secret (SMTP PASSWORD)</Label>
                    {/* Changed from type="password" to type="text" so you can see it */}
                    <Input id="clientSecret" type="text" value={credentials.clientSecret || ''} onChange={(e) => updateCredential('clientSecret', e.target.value)} required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="smtpUsername">SMTP Username</Label>
                    <Input id="smtpUsername" value={credentials.smtpUsername || ''} onChange={(e) => updateCredential('smtpUsername', e.target.value)} required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="senderAddress">Sender Address (Free Domain)</Label>
                    <Input id="senderAddress" value={credentials.senderAddress || ''} onChange={(e) => updateCredential('senderAddress', e.target.value)} required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="subscriptionId">Azure Subscription ID</Label>
                    <Input id="subscriptionId" value={credentials.subscriptionId || ''} onChange={(e) => updateCredential('subscriptionId', e.target.value)} required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="resourceGroup">Resource Group Name</Label>
                    <Input id="resourceGroup" value={credentials.resourceGroup || ''} onChange={(e) => updateCredential('resourceGroup', e.target.value)} required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="emailServiceName">Email Service Name</Label>
                    <Input id="emailServiceName" value={credentials.emailServiceName || ''} onChange={(e) => updateCredential('emailServiceName', e.target.value)} required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="domainName">Domain Name</Label>
                    <Input id="domainName" value={credentials.domainName || ''} onChange={(e) => updateCredential('domainName', e.target.value)} required />
                </div>
            </div>
          )}

          {/* --- GENERIC PROVIDER EDIT FIELDS --- */}
          {provider !== 'acs' && (
            <>
              <div className="grid gap-2">
                <Label>
                    {provider === 'sendpulse' || provider === 'zohomail' ? 'Client ID' : 
                    (provider === 'plunk' || provider === 'emailit') ? 'Secret API Key' : 'API Key'} *
                </Label>
                {/* Ensure standard API keys are also visible as text */}
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

          <div className="flex gap-3 mt-6">
              <Button type="submit" className="flex-1">Save Changes</Button>
              <Button type="button" variant="destructive" onClick={handleDelete}>Delete</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}