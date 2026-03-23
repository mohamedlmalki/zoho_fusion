import * as React from "react"
import { useNavigate } from "react-router-dom"
import { 
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarGroup, SidebarGroupContent, SidebarRail, SidebarFooter, useSidebar
} from "@/components/ui/sidebar"
import { 
  Plus, Settings2, ChevronsUpDown, Check, 
  Activity, BarChart3, Send, Newspaper, Command, MessageSquare, Terminal, Mail, HeartPulse, Zap, AtSign, Edit3, Target, Repeat,
  GripVertical, Mailbox, Cloud // <--- IMPORTED Cloud ICON FOR AZURE
} from "lucide-react" 
import { useAccount, Account } from "@/contexts/AccountContext"
import { Button } from "@/components/ui/button"
import { AddAccountDialog } from "./AddAccountDialog" 
import { EditAccountDialog } from "./EditAccountDialog"
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, 
  DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

const defaultServices = [
    // --- Group 1 ---
    { id: 'omnisend', name: 'Omnisend', note: 'E-commerce marketing', icon: Send },
    { id: 'brevo', name: 'Brevo', note: 'Email & SMS campaigns', icon: MessageSquare },
    { id: 'buttondown', name: 'Buttondown', note: 'Newsletter tool', icon: Newspaper },
    { id: 'activecampaign', name: 'ActiveCampaign', note: 'Automation & CRM', icon: Activity },
    { id: 'benchmark', name: 'Benchmark Email', note: 'Email marketing', icon: BarChart3 },
    { id: 'getresponse', name: 'GetResponse', note: 'Email & Automations', icon: Target },
    
    // --- Group 2 ---
    { id: 'plunk', name: 'Plunk', note: 'Transactional emails', icon: Terminal },
    { id: 'loops', name: 'Loops', note: 'Modern email for SaaS', icon: Repeat },
    { id: 'zohomail', name: 'Zoho Mail360', note: 'ZeptoMail infrastructure', icon: Mailbox }, 
    { id: 'acs', name: 'Azure ACS', note: 'Dynamic SMTP relay', icon: Cloud }, // <--- ADDED AZURE ACS
    { id: 'systemio', name: 'System.io', note: 'All-in-one platform', icon: Settings2 },
    { id: 'ahasend', name: 'Ahasend', note: 'Email delivery API', icon: Zap },
    { id: 'emailit', name: 'Emailit', note: 'Email API & SMTP', icon: AtSign },
    { id: 'mailersend', name: 'MailerSend', note: 'Transactional & bulk', icon: Mail }, 
    { id: 'sendpulse', name: 'SendPulse', note: 'Multi-channel platform', icon: HeartPulse },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { accounts, activeAccount, setActiveAccount, updateAccount, deleteAccount } = useAccount()
  const { state } = useSidebar() 
  
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [editingAccount, setEditingAccount] = React.useState<Account | null>(null)
  
  const [customNotes, setCustomNotes] = React.useState<Record<string, string>>({})
  const [editNoteState, setEditNoteState] = React.useState<{id: string, name: string, tempNote: string} | null>(null)
  
  const [orderedServices, setOrderedServices] = React.useState(defaultServices);
  const dragItem = React.useRef<number | null>(null);
  const dragOverItem = React.useRef<number | null>(null);
  
  const navigate = useNavigate()

  React.useEffect(() => {
    fetch('/api/notes')
      .then(res => res.json())
      .then(data => {
          const { _sidebarOrder, ...actualNotes } = data;
          setCustomNotes(actualNotes);
          
          if (_sidebarOrder && Array.isArray(_sidebarOrder)) {
              const sorted = [...defaultServices].sort((a, b) => {
                  let indexA = _sidebarOrder.indexOf(a.id);
                  let indexB = _sidebarOrder.indexOf(b.id);
                  if (indexA === -1) indexA = 999;
                  if (indexB === -1) indexB = 999;
                  return indexA - indexB;
              });
              setOrderedServices(sorted);
          }
      })
      .catch(err => console.error("Failed to fetch notes", err))
  }, [])

  const handleSort = () => {
      if (dragItem.current === null || dragOverItem.current === null) return;
      if (dragItem.current === dragOverItem.current) return;
      
      const _services = [...orderedServices];
      const draggedContent = _services.splice(dragItem.current, 1)[0];
      _services.splice(dragOverItem.current, 0, draggedContent);
      
      dragItem.current = null;
      dragOverItem.current = null;
      
      setOrderedServices(_services);
      
      const newOrder = _services.map(s => s.id);
      fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceId: '_sidebarOrder', note: newOrder })
      }).catch(e => console.error("Failed to save order"));
  };

  const handleServiceClick = (provider: string) => {
      const targetAccount = accounts.find(a => a.provider === provider);

      if (targetAccount) {
          setActiveAccount(targetAccount);
          if (provider === 'brevo') navigate('/brevo/import');
          else if (provider === 'systemio') navigate('/systemio/import');
          else if (provider === 'sendpulse') navigate('/sendpulse/import');
          else if (provider === 'getresponse') navigate('/getresponse/import'); 
          // --- ROUTE AZURE TO THE ROOT BULK COMPONENT ---
          else if (provider === 'plunk' || provider === 'mailersend' || provider === 'ahasend' || provider === 'emailit' || provider === 'loops' || provider === 'zohomail' || provider === 'acs') navigate('/'); 
          else navigate('/');
      } else {
          toast({ title: "No Account", description: `Please add a ${provider} account first.` });
          setIsAddOpen(true);
      }
  };

  const saveCustomNote = async () => {
      if (!editNoteState) return;
      try {
          const res = await fetch('/api/notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ serviceId: editNoteState.id, note: editNoteState.tempNote })
          });
          const updatedNotes = await res.json();
          const { _sidebarOrder, ...actualNotes } = updatedNotes;
          setCustomNotes(actualNotes);
          toast({ title: "Note Saved", description: `Updated note for ${editNoteState.name}` });
          setEditNoteState(null);
      } catch (e) {
          toast({ title: "Error", description: "Failed to save note", variant: "destructive" });
      }
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2 font-bold text-lg text-sidebar-foreground">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-primary text-primary-foreground">
            <Command className="w-4 h-4" />
          </div>
          <span className="truncate">Fusion Manager</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
            <SidebarGroupContent>
                <SidebarMenu>
                    {orderedServices.map((service, index) => {
                        const isActive = activeAccount?.provider === service.id;
                        const hasAccount = accounts.some(a => a.provider === service.id);
                        const displayNote = customNotes[service.id] || service.note;

                        return (
                            <div 
                                key={service.id}
                                draggable={state !== "collapsed"} 
                                onDragStart={(e) => (dragItem.current = index)}
                                onDragEnter={(e) => {
                                    e.preventDefault();
                                    dragOverItem.current = index;
                                }}
                                onDragEnd={handleSort}
                                onDragOver={(e) => e.preventDefault()}
                                className="relative group/item cursor-grab active:cursor-grabbing"
                            >
                                <SidebarMenuItem>
                                    <SidebarMenuButton 
                                        isActive={isActive}
                                        tooltip={service.name}
                                        onClick={() => handleServiceClick(service.id)}
                                        className={`h-auto py-2 ${!hasAccount && !isActive ? "opacity-60" : ""}`}
                                    >
                                        {state !== "collapsed" && (
                                            <GripVertical className="h-4 w-4 opacity-0 group-hover/item:opacity-40 transition-opacity shrink-0 -ml-1 mr-1" />
                                        )}
                                        
                                        <service.icon className="h-4 w-4 mt-0.5 shrink-0" />
                                        
                                        <div className="flex flex-col items-start text-left w-full relative group">
                                            <span className="leading-none text-sm font-medium">{service.name}</span>
                                            
                                            <div 
                                                className="text-[10px] text-muted-foreground mt-1 font-normal leading-tight hover:text-primary transition-colors flex items-center gap-1 w-full"
                                                onClick={(e) => {
                                                    e.stopPropagation(); 
                                                    e.preventDefault();
                                                    setEditNoteState({ id: service.id, name: service.name, tempNote: displayNote });
                                                }}
                                                title="Click to edit note"
                                            >
                                                <span className="truncate max-w-[130px]">{displayNote}</span>
                                                <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer" />
                                            </div>
                                        </div>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>

                                {service.id === 'getresponse' && (
                                    <div className="px-3 my-2">
                                        <Separator className="opacity-50" />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <AccountSwitcher 
            accounts={accounts} activeAccount={activeAccount} setActiveAccount={setActiveAccount}
            onAdd={() => setIsAddOpen(true)} onEdit={setEditingAccount}
        />
      </SidebarFooter>
      <SidebarRail />
      
      <AddAccountDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
      
      {editingAccount && (
        <EditAccountDialog 
            open={!!editingAccount} 
            onOpenChange={(open: boolean) => !open && setEditingAccount(null)}
            account={editingAccount} 
            onUpdate={updateAccount} 
            onDelete={deleteAccount}
        />
      )}

      <Dialog open={!!editNoteState} onOpenChange={(open) => !open && setEditNoteState(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Note: {editNoteState?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
                placeholder="Enter a custom note to remember what you use this service for..."
                value={editNoteState?.tempNote || ''}
                onChange={(e) => setEditNoteState(prev => prev ? {...prev, tempNote: e.target.value} : null)}
                className="min-h-[100px] text-sm"
                autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNoteState(null)}>Cancel</Button>
            <Button onClick={saveCustomNote}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}

function AccountSwitcher({ accounts, activeAccount, setActiveAccount, onAdd, onEdit }: any) {
    const getIcon = (provider?: string) => {
        if (provider === 'benchmark') return <BarChart3 className="size-4" />;
        if (provider === 'omnisend') return <Send className="size-4" />;
        if (provider === 'buttondown') return <Newspaper className="size-4" />;
        if (provider === 'brevo') return <MessageSquare className="size-4" />;
        if (provider === 'systemio') return <Settings2 className="size-4" />;
        if (provider === 'plunk') return <Terminal className="size-4" />;
        if (provider === 'mailersend') return <Mail className="size-4" />; 
        if (provider === 'sendpulse') return <HeartPulse className="size-4" />;
        if (provider === 'ahasend') return <Zap className="size-4" />; 
        if (provider === 'emailit') return <AtSign className="size-4" />; 
        if (provider === 'getresponse') return <Target className="size-4" />;
        if (provider === 'loops') return <Repeat className="size-4" />; 
        if (provider === 'zohomail') return <Mailbox className="size-4" />; 
        if (provider === 'acs') return <Cloud className="size-4" />; // <--- MAP AZURE ICON
        return <Activity className="size-4" />;
    }

    const displayedAccounts = React.useMemo(() => {
        if (!activeAccount) return [];
        return accounts.filter((acc: Account) => acc.provider === activeAccount.provider);
    }, [accounts, activeAccount]);

    if (!activeAccount) return (
        <div className="p-2">
            <Button variant="outline" className="w-full justify-start" onClick={onAdd}>
                <Plus className="mr-2 h-4 w-4"/> Add Account
            </Button>
        </div>
    );

    return (
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent border-t rounded-none pt-4 pb-4 h-auto">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      {getIcon(activeAccount.provider)}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{activeAccount.name}</span>
                      <span className="truncate text-xs text-muted-foreground capitalize">{activeAccount.provider}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-56 rounded-lg" align="start" side="bottom" sideOffset={4}>
                 <DropdownMenuLabel className="text-xs font-bold text-muted-foreground">
                     Switch {activeAccount.provider} Account
                 </DropdownMenuLabel>
                 <div className="max-h-[300px] overflow-y-auto">
                    {displayedAccounts.map((acc: Account) => (
                         <DropdownMenuItem key={acc.id} onClick={() => setActiveAccount(acc)} className="flex items-center justify-between gap-2 cursor-pointer">
                            <div className="flex items-center gap-2 overflow-hidden">
                                {getIcon(acc.provider)}
                                <span className="truncate">{acc.name}</span>
                            </div>
                            {activeAccount.id === acc.id && <Check className="h-4 w-4 opacity-50" />}
                            <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={(e) => { e.stopPropagation(); onEdit(acc); }}>
                                <Settings2 className="h-3 w-3" />
                            </Button>
                         </DropdownMenuItem>
                    ))}
                 </div>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onClick={onAdd} className="gap-2 p-2 cursor-pointer text-blue-600 focus:text-blue-600">
                     <Plus className="size-4" />
                     <div className="font-medium">Add New Account</div>
                 </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
    )
}