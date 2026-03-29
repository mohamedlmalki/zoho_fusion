import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAccount } from "@/contexts/AccountContext";
import { CampaignStatusSelect } from "./CampaignStatusSelect";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, Loader2, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ServiceNavbar() {
  const { activeAccount, checkAccountStatus } = useAccount();
  const location = useLocation();
  const { toast } = useToast();
  
  const [isChecking, setIsChecking] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [apiResponse, setApiResponse] = useState<any>(null);

  const handleStatusCheck = async () => {
    if (!activeAccount) return;
    
    setIsChecking(true);
    try {
        const result = await checkAccountStatus(activeAccount);
        
        setApiResponse(result.lastCheckResponse || result);
        setIsDialogOpen(true);

        if (result.status === 'connected') {
            toast({ 
                title: "Connection Successful", 
                description: `Successfully connected to ${activeAccount.name}`,
                className: "bg-green-50 border-green-200 text-green-900" 
            });
        } else {
            const errorMsg = result.lastCheckResponse?.error || 
                             result.lastCheckResponse?.message || 
                             "Unknown API Error";
                             
            toast({ 
                title: "Connection Failed", 
                description: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg),
                variant: "destructive" 
            });
        }
    } catch (error: any) {
        setApiResponse({ error: "Network request failed", details: error.message || error });
        setIsDialogOpen(true);
        toast({ title: "Error", description: "Network request failed", variant: "destructive" });
    } finally {
        setIsChecking(false);
    }
  };

  if (!activeAccount) {
    return (
        <div className="flex items-center h-14 px-4 border-b bg-background sticky top-0 z-20">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mx-4 h-6" />
            <div className="flex-1 text-sm text-muted-foreground">Select an account from the sidebar...</div>
            <div className="ml-auto pl-2 flex items-center gap-2">
                <CampaignStatusSelect />
            </div>
        </div>
    );
  }

  let StatusIcon = HelpCircle;
  let statusColor = "text-muted-foreground";
  let statusText = "Unknown Status";

  if (isChecking) {
      StatusIcon = Loader2;
      statusColor = "text-blue-500 animate-spin";
      statusText = "Checking connection...";
  } else if (activeAccount.status === 'connected') {
      StatusIcon = CheckCircle;
      statusColor = "text-green-500";
      statusText = "Connected";
  } else if (activeAccount.status === 'failed') {
      StatusIcon = XCircle;
      statusColor = "text-red-500";
      statusText = "Connection Failed (Click to view details)";
  }

  let navItems: { title: string; href: string }[] = [];

  switch (activeAccount.provider) {
    case 'acs': // <--- ADDED AZURE ACS NAV MENU
      navItems = [
        { title: "Bulk Send", href: "/" }
      ];
      break;
    case 'zohomail': 
      navItems = [
        { title: "Bulk Send", href: "/" },
        { title: "Bounce Dashboard", href: "/zohomail/bounces" },
      ];
      break;
    case 'loops':
      navItems = [
        { title: "Bulk Import", href: "/" },
        { title: "Transactional", href: "/loops/transactional" },
        { title: "User Management", href: "/loops/users" },
      ];
      break;
    case 'getresponse': 
      navItems = [
        { title: "Bulk Import", href: "/getresponse/import" },
        { title: "User Management", href: "/getresponse/users" },
        { title: "Automations", href: "/getresponse/automation" },
      ];
      break;
    case 'plunk':
      navItems = [
        { title: "Bulk Send", href: "/" },
        { title: "Track Events", href: "/track" },
        { title: "Analytics", href: "/analytics" },
      ];
      break;
    case 'mailersend':
      navItems = [
        { title: "Bulk Campaign", href: "/" },
        { title: "Send Email", href: "/send" },
        { title: "Analytics", href: "/mailersend/analytics" },
      ];
      break;
    case 'ahasend':
      navItems = [
        { title: "Bulk Send", href: "/" },
        { title: "Statistics & Logs", href: "/ahasend/statistics" },
      ];
      break;
    case 'emailit':
      navItems = [
        { title: "Bulk Send", href: "/" },
        { title: "Analytics", href: "/emailit/analytics" },
      ];
      break;
    case 'activecampaign':
    case 'benchmark':
      navItems = [
        { title: "Bulk Import", href: "/" },
        { title: "User Management", href: "/users" },
        { title: "Automations", href: "/automation" },
      ];
      break;
    case 'buttondown':
      navItems = [
        { title: "Bulk Import", href: "/" },
        { title: "Subscribers", href: "/users" },
        { title: "Emails", href: "/emails" },
        { title: "Analytics", href: "/analytics" },
        { title: "Add Letter", href: "/send" },
      ];
      break;
    case 'omnisend':
      navItems = [
        { title: "Bulk Import", href: "/" },
      ];
      break;
    case 'brevo': 
      navItems = [
        { title: "Import", href: "/brevo/import" }, 
        { title: "Send", href: "/brevo/transactional" },
        { title: "Users", href: "/brevo/users" },
        { title: "Templates", href: "/brevo/templates" },
        { title: "Stats", href: "/brevo/stats" },
        { title: "GDPR", href: "/brevo/forget" },
      ];
      break;
    case 'systemio':
      navItems = [
        { title: "Bulk Import", href: "/systemio/import" },
      ];
      break;
    case 'sendpulse':
      navItems = [
        { title: "Import Contacts", href: "/sendpulse/import" },
        { title: "Manage Users", href: "/sendpulse/users" },
        { title: "Automations", href: "/sendpulse/automation" },
      ];
      break;
  }

  return (
    <>
        <div className="flex items-center h-14 px-4 border-b bg-background sticky top-0 z-20">
          <SidebarTrigger className="mr-2" />
          <Separator orientation="vertical" className="mx-2 h-6" />
          
          <div className="flex items-center mr-6 min-w-fit gap-2">
            <span className="font-semibold text-sm">{activeAccount.name}</span>
            
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 p-0 hover:bg-transparent"
                            onClick={handleStatusCheck}
                            disabled={isChecking}
                        >
                            <StatusIcon className={cn("w-4 h-4", statusColor)} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>{statusText} - Click to verify & view logs</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
          </div>

          <nav className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || (item.href === '/' && location.pathname === `/${activeAccount.provider}/import`);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap",
                    isActive 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.title}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto pl-2 flex items-center gap-2">
            <CampaignStatusSelect />
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Connection Details</DialogTitle>
                    <DialogDescription>
                        Raw server response details for debugging purposes.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-slate-950 text-slate-50">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                        {apiResponse ? JSON.stringify(apiResponse, null, 2) : "No response data available."}
                    </pre>
                </ScrollArea>
                <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    </>
  );
}