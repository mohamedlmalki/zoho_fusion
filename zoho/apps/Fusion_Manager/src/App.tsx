import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AccountProvider, useAccount } from "./contexts/AccountContext";
import { JobProvider } from "./contexts/JobContext";
import { BulkJobProvider } from "./contexts/BulkJobContext";
import { TrackEventProvider } from "./contexts/TrackEventContext";
import Layout from "./components/Layout";

import BulkImport from "./pages/BulkImport";
import UserManagement from "./pages/UserManagement";
import Automation from "./pages/Automation";
import Emails from "./pages/Emails";
import SendEmail from "./pages/SendEmail"; 
import NotFound from "./pages/NotFound";

import BrevoBulkImport from './pages/brevo/BulkImport';
import BrevoTransactional from './pages/brevo/BulkTransactionalSend';
import BrevoUserManagement from './pages/brevo/UserManagement';
import BrevoTemplates from './pages/brevo/EmailTemplates';
import BrevoStats from './pages/brevo/EmailStatistics';
import BrevoForget from './pages/brevo/ForgetSubscriber';

import SystemIoBulkImport from './pages/systemio/BulkImport';

import { AddSubscriber as PlunkSend } from './pages/plunk/AddSubscriber'; 
import { BulkImport as PlunkBulk } from './pages/plunk/BulkImport'; 
import { TrackEvent as PlunkTrack } from './pages/plunk/TrackEvent'; 
import { Analytics as PlunkAnalytics } from './pages/plunk/Analytics';

import MailersendBulkImport from './pages/mailersend/BulkImport';
import MailersendSendEmail from './pages/mailersend/SendEmail';
import MailersendAnalytics from './pages/mailersend/Analytics';

import SendpulseBulkImport from "./pages/sendpulse/BulkImport";
import SendpulseUserManagement from "./pages/sendpulse/UserManagement";
import SendpulseAutomation from "./pages/sendpulse/Automation";

import { BulkSend as AhasendBulkSend } from "./pages/ahasend/BulkSend";
import { Statistics as AhasendStatistics } from "./pages/ahasend/Statistics";

import { BulkImport as EmailitBulkImport } from "./pages/emailit/BulkImport";
import { Analytics as EmailitAnalytics } from "./pages/emailit/Analytics";

import { BulkImport as GetResponseBulkImport } from "./pages/getresponse/BulkImport";
import { UserManagement as GetResponseUserManagement } from "./pages/getresponse/UserManagement";
import { Automation as GetResponseAutomation } from "./pages/getresponse/Automation";

import { BulkImport as LoopsBulkImport } from "./pages/loops/BulkImport";
import { Transactional as LoopsTransactional } from "./pages/loops/Transactional";
import { UserManagement as LoopsUserManagement } from "./pages/loops/UserManagement";

import { BulkImport as ZohoMailBulkImport } from "./pages/zohomail/BulkImport";
import { BounceDashboard as ZohoMailBounceDashboard } from "./pages/zohomail/BounceDashboard";

// --- ADDED AZURE ACS IMPORT ---
import { BulkImport as AcsBulkImport } from "./pages/acs/BulkImport";

const queryClient = new QueryClient();

const HomeSwitcher = () => {
  const { activeAccount } = useAccount();
  if (activeAccount?.provider === 'plunk') return <PlunkBulk />;
  if (activeAccount?.provider === 'mailersend') return <MailersendBulkImport />; 
  if (activeAccount?.provider === 'ahasend') return <AhasendBulkSend />;
  if (activeAccount?.provider === 'emailit') return <EmailitBulkImport />;
  if (activeAccount?.provider === 'getresponse') return <GetResponseBulkImport />; 
  if (activeAccount?.provider === 'loops') return <LoopsBulkImport />; 
  if (activeAccount?.provider === 'zohomail') return <ZohoMailBulkImport />; 
  if (activeAccount?.provider === 'acs') return <AcsBulkImport />; // <-- ADDED AZURE ACS
  return <BulkImport />;
};

const SendSwitcher = () => {
  const { activeAccount } = useAccount();
  if (activeAccount?.provider === 'plunk') return <PlunkSend />;
  if (activeAccount?.provider === 'mailersend') return <MailersendSendEmail />; 
  if (activeAccount?.provider === 'loops') return <LoopsTransactional />; 
  return <SendEmail />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AccountProvider>
        <JobProvider>
          <BulkJobProvider> 
            <TrackEventProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<HomeSwitcher />} />
                    <Route path="send" element={<SendSwitcher />} /> 
                    <Route path="analytics" element={<PlunkAnalytics />} />
                    <Route path="track" element={<PlunkTrack />} />
                    
                    <Route path="users" element={<UserManagement />} />
                    <Route path="automation" element={<Automation />} />
                    <Route path="emails" element={<Emails />} />

                    <Route path="brevo/import" element={<BrevoBulkImport />} />
                    <Route path="brevo/transactional" element={<BrevoTransactional />} />
                    <Route path="brevo/users" element={<BrevoUserManagement />} />
                    <Route path="brevo/templates" element={<BrevoTemplates />} />
                    <Route path="brevo/stats" element={<BrevoStats />} />
                    <Route path="brevo/forget" element={<BrevoForget />} />

                    <Route path="systemio/import" element={<SystemIoBulkImport />} />
                    
                    <Route path="mailersend/analytics" element={<MailersendAnalytics />} />

                    <Route path="sendpulse/import" element={<SendpulseBulkImport />} />
                    <Route path="sendpulse/users" element={<SendpulseUserManagement />} />
                    <Route path="sendpulse/automation" element={<SendpulseAutomation />} />

                    <Route path="ahasend/statistics" element={<AhasendStatistics />} />

                    <Route path="emailit/analytics" element={<EmailitAnalytics />} />

                    <Route path="getresponse/import" element={<GetResponseBulkImport />} />
                    <Route path="getresponse/users" element={<GetResponseUserManagement />} />
                    <Route path="getresponse/automation" element={<GetResponseAutomation />} />

                    <Route path="loops/import" element={<LoopsBulkImport />} />
                    <Route path="loops/transactional" element={<LoopsTransactional />} />
                    <Route path="loops/users" element={<LoopsUserManagement />} />

                    <Route path="zohomail/import" element={<ZohoMailBulkImport />} />
                    <Route path="zohomail/bounces" element={<ZohoMailBounceDashboard />} />

                    {/* --- ADDED AZURE ACS ROUTE --- */}
                    <Route path="acs/import" element={<AcsBulkImport />} />

                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </TrackEventProvider>
          </BulkJobProvider>
        </JobProvider>
      </AccountProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;