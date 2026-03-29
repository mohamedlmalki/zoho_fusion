import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';

export interface TrackResult {
  id: number;
  email: string;
  status: 'success' | 'error';
  response: string;
}

export interface TrackJobState {
  emailList: string;
  eventName: string;
  eventData: string;
  stopAfterFails: number; // <--- NEW
  status: 'idle' | 'processing' | 'paused' | 'completed' | 'stopped' | 'waiting';
  progress: { current: number; total: number };
  results: TrackResult[];
  stats: { success: number; fail: number };
  elapsedSeconds: number;
}

interface TrackEventContextType {
  jobs: Record<string, TrackJobState>;
  updateJobData: (accountId: string, data: Partial<TrackJobState>) => void;
  startJob: (accountId: string, secretKey: string) => Promise<void>;
  getJob: (accountId: string) => TrackJobState;
}

const TrackEventContext = createContext<TrackEventContextType | undefined>(undefined);

export const useTrackEvents = () => {
  const context = useContext(TrackEventContext);
  if (!context) throw new Error('useTrackEvents must be used within a TrackEventProvider');
  return context;
};

const defaultJobState: TrackJobState = {
  emailList: '', eventName: '', eventData: '{}', stopAfterFails: 0, // <--- NEW DEFAULT
  status: 'idle', progress: { current: 0, total: 0 },
  results: [], stats: { success: 0, fail: 0 }, elapsedSeconds: 0,
};

export const TrackEventProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Record<string, TrackJobState>>({});
  const controllers = useRef<Record<string, { isStopped: boolean }>>({});

  const getJob = (accountId: string) => jobs[accountId] || { ...defaultJobState };

  const updateJobData = (accountId: string, data: Partial<TrackJobState>) => {
    setJobs(prev => ({
      ...prev,
      [accountId]: { ...(prev[accountId] || defaultJobState), ...data }
    }));
  };

  const startJob = async (accountId: string, secretKey: string) => {
    const job = getJob(accountId);
    const emails = job.emailList.split('\n').map(e => e.trim()).filter(e => e.length > 0);

    if (emails.length === 0 || !job.eventName) {
      return toast.error("Please provide an Event Name and at least one email.");
    }

    controllers.current[accountId] = { isStopped: false };
    
    updateJobData(accountId, { 
      status: 'processing', results: [], 
      stats: { success: 0, fail: 0 }, progress: { current: 0, total: emails.length } 
    });

    let localFailCount = 0; // <--- TRACK FAILS SYNCHRONOUSLY

    for (let i = 0; i < emails.length; i++) {
      if (controllers.current[accountId]?.isStopped) break;
      
      const email = emails[i];
      const currentEventName = getJob(accountId).eventName;
      const currentEventData = getJob(accountId).eventData;

      try {
        const res = await fetch(`/api/plunk/track-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            secretKey, event: currentEventName, email, 
            data: JSON.parse(currentEventData || '{}') 
          }),
        });

        const status = res.ok ? 'success' : 'error';
        const resData = await res.json();
        if (status === 'error') localFailCount++;

        setJobs(prev => {
          const cur = prev[accountId];
          return {
            ...prev,
            [accountId]: {
              ...cur,
              stats: { success: cur.stats.success + (status === 'success' ? 1 : 0), fail: cur.stats.fail + (status === 'error' ? 1 : 0) },
              progress: { ...cur.progress, current: i + 1 },
              results: [{ id: i + 1, email, status, response: JSON.stringify(resData, null, 2) }, ...cur.results]
            }
          };
        });
      } catch (error: any) {
        localFailCount++;
        setJobs(prev => {
          const cur = prev[accountId];
          return {
            ...prev,
            [accountId]: {
              ...cur,
              stats: { ...cur.stats, fail: cur.stats.fail + 1 },
              progress: { ...cur.progress, current: i + 1 },
              results: [{ id: i + 1, email, status: 'error', response: JSON.stringify({ error: error.message }, null, 2) }, ...cur.results]
            }
          };
        });
      }

      // <--- STOP AFTER X FAILS LOGIC ---
      if (job.stopAfterFails > 0 && localFailCount >= job.stopAfterFails) {
          toast.error(`Job automatically stopped after ${job.stopAfterFails} failures.`);
          controllers.current[accountId].isStopped = true;
          updateJobData(accountId, { status: 'stopped' });
          break; // Stop loop immediately
      }
    }
    
    if (!controllers.current[accountId]?.isStopped) {
        updateJobData(accountId, { status: 'completed' });
    }
  };

  return (
    <TrackEventContext.Provider value={{ jobs, updateJobData, startJob, getJob }}>
      {children}
    </TrackEventContext.Provider>
  );
};