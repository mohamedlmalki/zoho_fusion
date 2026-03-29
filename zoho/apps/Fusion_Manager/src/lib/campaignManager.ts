import { toast } from "@/hooks/use-toast";

// --- Types and Interfaces ---
export interface EmailJob {
  id: number;
  email: string;
  status: "pending" | "sending" | "success" | "failed";
  response: string;
}

export interface CampaignState {
  fromName: string;
  fromEmail: string;
  emailsText: string;
  subject: string;
  content: string;
  delay: string;
  isRunning: boolean;
  isPaused: boolean;
  emailQueue: string[];
  processedJobs: EmailJob[];
  stats: {
    success: number;
    failed: number;
    total: number;
  };
  timeElapsed: number;
  nextEmailIn: number;
}

const initialCampaignState: CampaignState = {
  fromName: "",
  fromEmail: "",
  emailsText: "",
  subject: "",
  content: "",
  delay: "5",
  isRunning: false,
  isPaused: false,
  emailQueue: [],
  processedJobs: [],
  stats: { success: 0, failed: 0, total: 0 },
  timeElapsed: 0,
  nextEmailIn: 0,
};

// --- Campaign Manager ---
const campaigns = new Map<string, CampaignState>();
const listeners = new Set<(campaigns: Map<string, CampaignState>) => void>();
const timerIds = new Map<string, NodeJS.Timeout>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener(new Map(campaigns)));
};

const updateCampaignState = (accountId: string, updates: Partial<CampaignState>) => {
    const currentState = campaigns.get(accountId) || { ...initialCampaignState };
    campaigns.set(accountId, { ...currentState, ...updates });
};

// Unified interval for all time-based state changes
setInterval(() => {
  let changed = false;
  campaigns.forEach((campaign, accountId) => {
    if (campaign.isRunning && !campaign.isPaused) {
      updateCampaignState(accountId, {
        timeElapsed: campaign.timeElapsed + 1,
        nextEmailIn: campaign.nextEmailIn > 0 ? campaign.nextEmailIn - 1 : 0
      });
      changed = true;
    }
  });
  if (changed) {
    notifyListeners();
  }
}, 1000);

const processQueueForAccount = async (accountId: string) => {
    let preSendCampaignState = campaigns.get(accountId);
    if (!preSendCampaignState || !preSendCampaignState.isRunning || preSendCampaignState.isPaused) {
        if(timerIds.has(accountId)) {
            clearTimeout(timerIds.get(accountId)!);
            timerIds.delete(accountId);
        }
        return;
    }

    const [nextEmail, ...remainingQueue] = preSendCampaignState.emailQueue;

    if (!nextEmail) {
        updateCampaignState(accountId, { isRunning: false, nextEmailIn: 0 });
        notifyListeners();
        toast({ title: "Campaign Finished", description: `Processed ${preSendCampaignState.stats.total} emails.` });
        return;
    }

    const newJob: EmailJob = {
      id: preSendCampaignState.stats.total - preSendCampaignState.emailQueue.length + 1,
      email: nextEmail,
      status: 'sending',
      response: 'Processing...',
    };
    
    updateCampaignState(accountId, {
        emailQueue: remainingQueue,
        processedJobs: [newJob, ...preSendCampaignState.processedJobs],
        nextEmailIn: 0
    });
    notifyListeners();
    
    try {
        const currentCampaignForSend = campaigns.get(accountId)!;
        
        // Use the new integrated Ahasend API route
        const res = await fetch('/api/ahasend/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accountId,
                from: { name: currentCampaignForSend.fromName, email: currentCampaignForSend.fromEmail },
                recipients: [{ email: nextEmail }],
                subject: currentCampaignForSend.subject,
                html_content: currentCampaignForSend.content,
                text_content: currentCampaignForSend.content.replace(/<[^>]*>?/gm, ''),
            }),
        });
        
        // --- NEW: GRAB THE EXACT ERROR JSON TEXT FROM BACKEND ---
        const rawText = await res.text();
        let responseData;
        try { 
            responseData = JSON.parse(rawText); 
        } catch { 
            responseData = rawText; 
        }

        if (!res.ok) {
            // Throw the entire object as a string so the popup UI catches and displays all of it
            const detailedError = typeof responseData === 'object' ? JSON.stringify(responseData, null, 2) : rawText;
            throw new Error(detailedError || `API Error: ${res.status}`);
        }

        const currentCampaign = campaigns.get(accountId)!;
        const updatedJobs = currentCampaign.processedJobs.map(j =>
            j.id === newJob.id ? { ...j, status: 'success' as const, response: JSON.stringify(responseData, null, 2) } : j
        );
        updateCampaignState(accountId, {
            processedJobs: updatedJobs,
            stats: { ...currentCampaign.stats, success: currentCampaign.stats.success + 1 }
        });

    } catch (error) {
        // --- NEW: INJECT FULL ERROR JSON INTO THE "RESPONSE" INFO BUTTON ---
        const errorMessage = error instanceof Error ? error.message : String(error);
        const currentCampaign = campaigns.get(accountId)!;
        const updatedJobs = currentCampaign.processedJobs.map(j =>
            j.id === newJob.id ? { ...j, status: 'failed' as const, response: errorMessage } : j
        );
        updateCampaignState(accountId, {
            processedJobs: updatedJobs,
            stats: { ...currentCampaign.stats, failed: currentCampaign.stats.failed + 1 }
        });
    } finally {
        notifyListeners();
        const finalCampaign = campaigns.get(accountId)!;
        
        if (finalCampaign.isRunning && !finalCampaign.isPaused && finalCampaign.emailQueue.length > 0) {
            updateCampaignState(accountId, { nextEmailIn: Number(finalCampaign.delay) });
            notifyListeners();

            const timerId = setTimeout(() => {
                processQueueForAccount(accountId);
            }, Number(finalCampaign.delay) * 1000);
            timerIds.set(accountId, timerId);
        } else if (finalCampaign.emailQueue.length === 0) {
            updateCampaignState(accountId, { isRunning: false, nextEmailIn: 0 });
            notifyListeners();
            toast({ title: "Campaign Finished", description: `Processed ${finalCampaign.stats.total} emails.` });
        }
    }
}

export const campaignManager = {
  getCampaign: (accountId: string): CampaignState => {
    return campaigns.get(accountId) || { ...initialCampaignState };
  },

  updateCampaign: (accountId: string, updates: Partial<CampaignState>) => {
    updateCampaignState(accountId, updates);
    notifyListeners();
  },

  startCampaign: (accountId: string, fromEmail: string) => {
    const campaign = campaignManager.getCampaign(accountId);
    const emailList = campaign.emailsText.split('\n').map(e => e.trim()).filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (emailList.length === 0) {
      toast({ title: "Invalid Target List", description: "Please provide at least one valid email.", variant: "destructive" });
      return;
    }

    updateCampaignState(accountId, {
        fromEmail,
        isRunning: true,
        isPaused: false,
        emailQueue: emailList,
        processedJobs: [],
        stats: { success: 0, failed: 0, total: emailList.length },
        timeElapsed: 0,
        nextEmailIn: 0,
    });
    notifyListeners();
    processQueueForAccount(accountId);
  },

  pauseCampaign: (accountId: string) => {
    if (timerIds.has(accountId)) {
        clearTimeout(timerIds.get(accountId)!);
        timerIds.delete(accountId);
    }
    updateCampaignState(accountId, { isPaused: true, nextEmailIn: 0 });
    notifyListeners();
  },

  resumeCampaign: (accountId: string) => {
    const campaign = campaigns.get(accountId);
    if (campaign && campaign.isRunning) {
      updateCampaignState(accountId, { isPaused: false });
      notifyListeners();
      processQueueForAccount(accountId);
    }
  },

  stopCampaign: (accountId: string) => {
    if (timerIds.has(accountId)) {
        clearTimeout(timerIds.get(accountId)!);
        timerIds.delete(accountId);
    }
    updateCampaignState(accountId, {
        isRunning: false,
        isPaused: false,
        emailQueue: [],
        nextEmailIn: 0,
    });
    notifyListeners();
    toast({ title: "Campaign Aborted" });
  },

  subscribe: (callback: (campaigns: Map<string, CampaignState>) => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};