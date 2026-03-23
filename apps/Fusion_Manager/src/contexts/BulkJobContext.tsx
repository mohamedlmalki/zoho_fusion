import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';

export interface SendResult {
  id: number;
  email: string;
  status: 'success' | 'error';
  response: string;
}

export interface JobState {
  emailList: string;
  subject: string;
  content: string;
  fromEmail?: string;
  fromName?: string;
  delay: number;
  stopAfterFails: number; 
  status: 'idle' | 'processing' | 'paused' | 'completed' | 'stopped' | 'waiting';
  progress: { current: number; total: number };
  results: SendResult[];
  stats: { success: number; fail: number };
  elapsedSeconds: number;
  countdown: number;
}

interface BulkJobContextType {
  jobs: Record<string, JobState>;
  updateJobData: (accountId: string, data: Partial<JobState>) => void;
  startJob: (accountId: string, secretKey: string, provider?: string, apiUrl?: string) => Promise<void>;
  pauseJob: (accountId: string) => void;
  resumeJob: (accountId: string) => void;
  stopJob: (accountId: string) => void;
  getJob: (accountId: string) => JobState;
}

const BulkJobContext = createContext<BulkJobContextType | undefined>(undefined);

export const useBulkJobs = () => {
  const context = useContext(BulkJobContext);
  if (!context) throw new Error('useBulkJobs must be used within a BulkJobProvider');
  return context;
};

const defaultJobState: JobState = {
  emailList: '', subject: '', content: '', fromEmail: '', fromName: '',
  delay: 0, stopAfterFails: 3, 
  status: 'idle', progress: { current: 0, total: 0 },
  results: [], stats: { success: 0, fail: 0 }, elapsedSeconds: 0, countdown: 0,
};

export const BulkJobProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const controllers = useRef<Record<string, { isPaused: boolean; isStopped: boolean }>>({});

  const getJob = (accountId: string) => jobs[accountId] || { ...defaultJobState };

  const updateJobData = (accountId: string, data: Partial<JobState>) => {
    setJobs(prev => ({
      ...prev, [accountId]: { ...(prev[accountId] || defaultJobState), ...data }
    }));
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(currentJobs => {
        const nextJobs = { ...currentJobs };
        let hasChanges = false;
        Object.keys(nextJobs).forEach(accId => {
          if (nextJobs[accId].status === 'processing' || nextJobs[accId].status === 'waiting') {
            nextJobs[accId] = { ...nextJobs[accId], elapsedSeconds: nextJobs[accId].elapsedSeconds + 1 };
            hasChanges = true;
          }
        });
        return hasChanges ? nextJobs : currentJobs;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const pauseJob = (id: string) => { 
      if (controllers.current[id]) controllers.current[id].isPaused = true; 
      updateJobData(id, { status: 'paused' }); 
  };
  
  const resumeJob = (id: string) => { 
      if (controllers.current[id]) controllers.current[id].isPaused = false; 
      const currentJob = getJob(id);
      const nextStatus = currentJob.countdown > 0 ? 'waiting' : 'processing';
      updateJobData(id, { status: nextStatus }); 
  };
  
  const stopJob = (id: string) => { 
      if (controllers.current[id]) controllers.current[id].isStopped = true; 
      updateJobData(id, { status: 'stopped', countdown: 0 }); 
  };

  const startJob = async (accountId: string, secretKey: string, provider: string = 'plunk', apiUrl?: string) => {
    const job = getJob(accountId);
    const emails = job.emailList.split('\n').map(e => e.trim()).filter(e => e.length > 0);

    if (emails.length === 0) return toast.error("Please add recipients to the list.");
    if (provider === 'getresponse' && !job.subject) return toast.error("Please select a Campaign List.");
    
    if (provider !== 'getresponse' && provider !== 'loops' && (!job.subject || !job.content)) {
        return toast.error("Please add a subject and HTML content.");
    }

    controllers.current[accountId] = { isPaused: false, isStopped: false };
    updateJobData(accountId, { status: 'processing', results: [], stats: { success: 0, fail: 0 }, progress: { current: 0, total: emails.length }, elapsedSeconds: 0, countdown: 0 });

    let localFailCount = 0; 
    
    // --- MAP AZURE URL TO THE NEW BACKEND ROUTE ---
    let endpoint = '';
    if (provider === 'getresponse') endpoint = '/api/getresponse/contact';
    else if (provider === 'loops') endpoint = '/api/loops/contact';
    else if (provider === 'zohomail') endpoint = '/api/zohomail/send-email'; 
    else if (provider === 'emailit') endpoint = '/api/emailit/send-email';
    else if (provider === 'acs') endpoint = '/api/acs/send'; // <--- ADDED AZURE
    else endpoint = '/api/plunk/send-email';

    // Check if we need to send Authorization header for Azure
    const fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider === 'acs') {
        fetchHeaders['Authorization'] = `Bearer ${secretKey}`;
    }

    for (let i = 0; i < emails.length; i++) {
      const ctrl = controllers.current[accountId];
      
      if (ctrl?.isStopped) break;
      while (ctrl?.isPaused) { if (ctrl?.isStopped) break; await new Promise(r => setTimeout(r, 500)); }
      if (ctrl?.isStopped) break;

      if (i > 0 && job.delay > 0) {
         let remaining = job.delay;
         
         if (!ctrl?.isPaused && !ctrl?.isStopped) {
             updateJobData(accountId, { status: 'waiting', countdown: remaining });
         }

         while (remaining > 0) {
            if (ctrl?.isStopped) break;
            
            if (ctrl?.isPaused) {
                await new Promise(r => setTimeout(r, 500));
                continue;
            }

            await new Promise(r => setTimeout(r, 1000));
            
            if (ctrl?.isStopped) break;
            if (ctrl?.isPaused) continue;
            
            remaining--;
            updateJobData(accountId, { countdown: remaining });
         }
         
         if (!ctrl?.isStopped && !ctrl?.isPaused) {
             updateJobData(accountId, { status: 'processing', countdown: 0 });
         }
      }

      if (ctrl?.isStopped) break;
      while (ctrl?.isPaused) { if (ctrl?.isStopped) break; await new Promise(r => setTimeout(r, 500)); }
      if (ctrl?.isStopped) break;

      const email = emails[i];
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: fetchHeaders, // <--- Using dynamic headers so ACS passes the token
          body: JSON.stringify({
            accountId: accountId, 
            secretKey: secretKey, 
            to: email,
            subject: getJob(accountId).subject,
            content: getJob(accountId).content,
            from: getJob(accountId).fromEmail,
            fromName: getJob(accountId).fromName,
            campaignId: getJob(accountId).subject,
            apiUrl: apiUrl 
          }),
        });

        const resultData = await response.json();
        const status = response.ok ? 'success' : 'error';
        if (status === 'error') localFailCount++;

        setJobs(prev => {
            const cur = prev[accountId];
            return {
                ...prev,
                [accountId]: {
                    ...cur,
                    stats: { success: cur.stats.success + (status === 'success' ? 1 : 0), fail: cur.stats.fail + (status === 'error' ? 1 : 0) },
                    progress: { ...cur.progress, current: i + 1 },
                    results: [{ id: i + 1, email, status, response: JSON.stringify(resultData, null, 2) }, ...cur.results]
                }
            };
        });
      } catch (error: any) {
        localFailCount++;
        updateJobData(accountId, { stats: { ...getJob(accountId).stats, fail: getJob(accountId).stats.fail + 1 }, progress: { ...getJob(accountId).progress, current: i + 1 } });
      }

      if (job.stopAfterFails > 0 && localFailCount >= job.stopAfterFails) {
          toast.error(`Job automatically stopped after ${job.stopAfterFails} failures.`);
          controllers.current[accountId].isStopped = true;
          updateJobData(accountId, { status: 'stopped', countdown: 0 });
          break; 
      }
    }
    
    if (!controllers.current[accountId]?.isStopped) {
      updateJobData(accountId, { status: 'completed', countdown: 0 });
    }
  };

  return (
    <BulkJobContext.Provider value={{ jobs, updateJobData, startJob, pauseJob, resumeJob, stopJob, getJob }}>
      {children}
    </BulkJobContext.Provider>
  );
};