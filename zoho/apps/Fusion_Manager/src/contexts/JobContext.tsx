import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

export interface Job {
  id: string;
  accountId: string;
  type?: string; 
  title: string;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused' | 'stopped';
  data: any[];
  results: any[];
  apiEndpoint: string;
  batchSize?: number;
  errorThreshold?: number; 
  processItem: (item: any) => Promise<any>;
  currentDelay?: number; // <--- ADDED TO TRACK LIVE COUNTDOWN
  
  // Time Tracking
  startTime: number;
  endTime?: number;
  pauseStartTime?: number;  
  totalPausedTime: number; 

  // System.io specific
  tagId?: string; 
}

interface JobContextType {
  jobs: Job[];
  drafts: Record<string, string>;
  setDraft: (key: string, value: string) => void;
  updateJob: (id: string, updates: Partial<Job>) => void; // <--- EXPORTED THIS
  addJob: (jobData: Omit<Job, 'id' | 'accountId' | 'processedItems' | 'failedItems' | 'status' | 'results' | 'startTime' | 'endTime' | 'totalPausedTime'>, accountId: string) => string;
  startJob: (id: string) => void;
  pauseJob: (id: string) => void;
  resumeJob: (id: string) => void;
  stopJob: (id: string) => void;
  removeJob: (id: string) => void;
  getActiveJobForAccount: (accountId: string, jobType?: string) => Job | undefined; 
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const JobProvider = ({ children }: { children: ReactNode }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const jobsRef = useRef<Job[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const setDraft = useCallback((key: string, value: string) => {
    setDrafts(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const processingRef = useRef<Set<string>>(new Set());

  const processJobLoop = async (jobId: string) => {
    if (!processingRef.current.has(jobId)) return;
    const currentJob = jobsRef.current.find(j => j.id === jobId);
    
    if (!currentJob || currentJob.status !== 'processing') {
         processingRef.current.delete(jobId);
         return;
    }

    if (currentJob.processedItems >= currentJob.totalItems) {
        processingRef.current.delete(jobId);
        updateJob(jobId, { status: 'completed', endTime: Date.now() });
        setTimeout(() => toast({ title: "Job Completed", description: `${currentJob.title} finished.` }), 0);
        return;
    }

    const batchSize = currentJob.batchSize || 1;
    const itemsToProcess = currentJob.data.slice(currentJob.processedItems, currentJob.processedItems + batchSize);
    
    const newResults = [];
    let newFailures = 0;

    for (const item of itemsToProcess) {
        try {
            const result = await currentJob.processItem(item);
            newResults.push({ status: 'success', data: result });
        } catch (error: any) {
            newResults.push({ status: 'error', error: error.message || "Unknown error", data: item });
            newFailures++;
        }
    }

    const updatedProcessed = currentJob.processedItems + itemsToProcess.length;
    const updatedFailed = currentJob.failedItems + newFailures;

    if (currentJob.errorThreshold && currentJob.errorThreshold > 0 && updatedFailed >= currentJob.errorThreshold) {
        processingRef.current.delete(jobId);
        setJobs(prev => prev.map(j => {
            if (j.id === jobId) {
                return {
                    ...j,
                    status: 'failed', 
                    endTime: Date.now(),
                    processedItems: updatedProcessed,
                    failedItems: updatedFailed,
                    results: [...j.results, ...newResults]
                };
            }
            return j;
        }));
        
        setTimeout(() => toast({ 
            title: "Job Halted", 
            description: `Campaign stopped automatically after reaching ${updatedFailed} failed emails.`, 
            variant: "destructive" 
        }), 0);
        return; 
    }

    setJobs(prev => prev.map(j => {
        if (j.id === jobId) {
            return {
                ...j,
                processedItems: updatedProcessed,
                failedItems: updatedFailed,
                results: [...j.results, ...newResults]
            };
        }
        return j;
    }));

    setTimeout(() => processJobLoop(jobId), 1000); 
  };

  const updateJob = useCallback((id: string, updates: Partial<Job>) => {
      setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
  }, []);

  const startJob = useCallback((id: string) => {
    updateJob(id, { status: 'processing' });
    if (!processingRef.current.has(id)) {
        processingRef.current.add(id);
        setTimeout(() => processJobLoop(id), 100);
    }
  }, []);

  const addJob = useCallback((jobData: Omit<Job, 'id' | 'accountId' | 'processedItems' | 'failedItems' | 'status' | 'results' | 'startTime' | 'endTime' | 'totalPausedTime'>, accountId: string) => {
    const id = Math.random().toString(36).substring(7);
    const newJob: Job = {
      ...jobData,
      id,
      accountId,
      processedItems: 0,
      failedItems: 0,
      status: 'pending',
      results: [],
      startTime: Date.now(),
      totalPausedTime: 0 
    };
    setJobs((prev) => [...prev, newJob]);
    setTimeout(() => startJob(id), 500);
    return id;
  }, [startJob]);

  const pauseJob = useCallback((id: string) => {
     processingRef.current.delete(id);
     updateJob(id, { status: 'paused', pauseStartTime: Date.now() });
  }, []);

  const resumeJob = useCallback((id: string) => {
      setJobs(prev => prev.map(j => {
          if (j.id !== id) return j;
          const pausedDuration = j.pauseStartTime ? (Date.now() - j.pauseStartTime) : 0;
          return {
              ...j,
              status: 'processing',
              pauseStartTime: undefined, 
              totalPausedTime: j.totalPausedTime + pausedDuration 
          };
      }));
      
      if (!processingRef.current.has(id)) {
        processingRef.current.add(id);
        setTimeout(() => processJobLoop(id), 100);
    }
  }, []);

  const stopJob = useCallback((id: string) => {
      processingRef.current.delete(id);
      
      setJobs(prev => prev.map(j => {
          if (j.id !== id) return j;
          
          let finalPausedTime = j.totalPausedTime;
          if (j.status === 'paused' && j.pauseStartTime) {
              finalPausedTime += (Date.now() - j.pauseStartTime);
          }
          
          return {
              ...j,
              status: 'stopped',
              endTime: Date.now(),
              totalPausedTime: finalPausedTime,
              pauseStartTime: undefined
          };
      }));

      toast({ title: "Job Stopped", description: "Processing halted." });
  }, []);

  const removeJob = useCallback((id: string) => {
    processingRef.current.delete(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const getActiveJobForAccount = useCallback((accountId: string, jobType?: string) => {
    let accountJobs = jobs.filter(j => j.accountId === accountId);
    
    if (jobType) {
        accountJobs = accountJobs.filter(j => j.type === jobType);
    }

    if (accountJobs.length === 0) return undefined;
    
    const running = accountJobs.find(j => ['processing', 'pending', 'paused'].includes(j.status));
    if (running) return running;
    
    return accountJobs[accountJobs.length - 1];
  }, [jobs]);

  return (
    <JobContext.Provider value={{ jobs, drafts, setDraft, updateJob, addJob, startJob, pauseJob, resumeJob, stopJob, removeJob, getActiveJobForAccount }}>
      {children}
    </JobContext.Provider>
  );
};

export const useJob = () => {
  const context = useContext(JobContext);
  if (context === undefined) {
    throw new Error('useJob must be used within a JobProvider');
  }
  return context;
};