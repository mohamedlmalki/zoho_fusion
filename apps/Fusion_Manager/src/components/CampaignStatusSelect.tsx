import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, AlertCircle, Loader2, StopCircle, CheckCircle2, XCircle, Clock, Pause, Square, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useJob } from "@/contexts/JobContext";
import { useAccount } from "@/contexts/AccountContext";
import { useBulkJobs } from "@/contexts/BulkJobContext"; 
import { useTrackEvents } from "@/contexts/TrackEventContext"; 
import { campaignManager } from "@/lib/campaignManager";

export function CampaignStatusSelect() {
    // Extract jobs AND pause/stop/resume actions from all contexts
    const { jobs: genericJobs = [], pauseJob: pauseGeneric, stopJob: stopGeneric, resumeJob: resumeGeneric } = useJob();
    const { jobs: plunkBulkJobs, pauseJob: pauseBulk, stopJob: stopBulk, resumeJob: resumeBulk } = useBulkJobs(); 
    const { jobs: plunkTrackJobs, pauseJob: pauseTrack, stopJob: stopTrack, resumeJob: resumeTrack } = useTrackEvents(); 
    
    const { accounts, activeAccount, setActiveAccount, campaigns } = useAccount();
    
    const [open, setOpen] = useState(false);

    // --- 1. UNIFY ALL JOBS FROM ALL CONTEXTS ---
    const allJobs = useMemo(() => {
        const unified = genericJobs.map(j => ({ ...j, contextType: 'generic' })); 

        // Map Plunk/Generic Bulk Send jobs
        Object.entries(plunkBulkJobs || {}).forEach(([accountId, job]) => {
            if (job.status !== 'idle') {
                unified.push({
                    id: `bulk-${accountId}`,
                    accountId,
                    status: job.status,
                    processedItems: job.progress?.current || 0,
                    totalItems: job.progress?.total || 0,
                    failedItems: job.stats?.fail || 0,
                    startTime: Date.now() - ((job.elapsedSeconds || 0) * 1000), 
                    title: `Bulk Send: ${job.subject || 'Campaign'}`,
                    contextType: 'plunk-bulk'
                });
            }
        });

        // Map Plunk Track Event jobs
        Object.entries(plunkTrackJobs || {}).forEach(([accountId, job]) => {
            if (job.status !== 'idle') {
                unified.push({
                    id: `track-${accountId}`,
                    accountId,
                    status: job.status,
                    processedItems: job.progress?.current || 0,
                    totalItems: job.progress?.total || 0,
                    failedItems: job.stats?.fail || 0,
                    startTime: Date.now() - ((job.elapsedSeconds || 0) * 1000), 
                    title: `Tracking: ${job.eventName || 'Event'}`,
                    contextType: 'plunk-track'
                });
            }
        });

        // Map Ahasend Campaigns
        if (campaigns) {
            campaigns.forEach((campaign, accountId) => {
                if (campaign.stats.total > 0) {
                    let derivedStatus = 'idle';
                    
                    if (campaign.isRunning && !campaign.isPaused) {
                        derivedStatus = 'processing';
                    } else if (campaign.isRunning && campaign.isPaused) {
                        derivedStatus = 'paused';
                    } else if (!campaign.isRunning) {
                        if (campaign.stats.success + campaign.stats.failed >= campaign.stats.total) {
                            derivedStatus = 'completed';
                        } else {
                            derivedStatus = 'stopped';
                        }
                    }

                    unified.push({
                        id: `ahasend-${accountId}`,
                        accountId,
                        status: derivedStatus,
                        processedItems: campaign.stats.success + campaign.stats.failed,
                        totalItems: campaign.stats.total,
                        failedItems: campaign.stats.failed,
                        startTime: Date.now() - ((campaign.timeElapsed || 0) * 1000), 
                        title: `Bulk Send: ${campaign.subject || 'Ahasend Campaign'}`,
                        contextType: 'ahasend'
                    });
                }
            });
        }

        return unified;
    }, [genericJobs, plunkBulkJobs, plunkTrackJobs, campaigns]); 

    // --- 2. GLOBAL ACTIONS: RESUME, PAUSE & STOP ALL ---
    const hasPausableJobs = allJobs.some(j => j.status === 'processing' || j.status === 'waiting');
    const hasStoppableJobs = allJobs.some(j => j.status === 'processing' || j.status === 'waiting' || j.status === 'paused');
    const hasResumableJobs = allJobs.some(j => j.status === 'paused');

    const handleResumeAll = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        allJobs.forEach(job => {
            if (job.status === 'paused') {
                if (job.contextType === 'plunk-bulk' && resumeBulk) resumeBulk(job.accountId);
                else if (job.contextType === 'plunk-track' && resumeTrack) resumeTrack(job.accountId);
                else if (job.contextType === 'generic' && resumeGeneric) resumeGeneric(job.id);
                else if (job.contextType === 'ahasend') campaignManager.resumeCampaign(job.accountId);
            }
        });
    };

    const handlePauseAll = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        allJobs.forEach(job => {
            if (job.status === 'processing' || job.status === 'waiting') {
                if (job.contextType === 'plunk-bulk' && pauseBulk) pauseBulk(job.accountId);
                else if (job.contextType === 'plunk-track' && pauseTrack) pauseTrack(job.accountId);
                else if (job.contextType === 'generic' && pauseGeneric) pauseGeneric(job.id);
                else if (job.contextType === 'ahasend') campaignManager.pauseCampaign(job.accountId);
            }
        });
    };

    const handleStopAll = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        allJobs.forEach(job => {
            if (job.status === 'processing' || job.status === 'waiting' || job.status === 'paused') {
                if (job.contextType === 'plunk-bulk' && stopBulk) stopBulk(job.accountId);
                else if (job.contextType === 'plunk-track' && stopTrack) stopTrack(job.accountId);
                else if (job.contextType === 'generic' && stopGeneric) stopGeneric(job.id);
                else if (job.contextType === 'ahasend') campaignManager.stopCampaign(job.accountId);
            }
        });
    };

    // --- 3. GROUP JOBS BY ACCOUNT (GLOBAL) ---
    const latestAccountJobs = useMemo(() => {
        const map = new Map();
        const sortedJobs = [...allJobs].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

        sortedJobs.forEach(job => {
            const account = accounts.find(a => 
                (job.accountId === a.id) || 
                (job.title && job.title.includes(a.id))
            );

            if (account) {
                if (!map.has(account.id)) {
                    map.set(account.id, { job, account });
                }
            }
        });
        
        return Array.from(map.values());
    }, [allJobs, accounts]);

    const displayItem = useMemo(() => {
        if (latestAccountJobs.length === 0) return null;

        const currentAccountJob = latestAccountJobs.find(item => item.account.id === activeAccount?.id);
        if (currentAccountJob) return currentAccountJob;

        const runningJob = latestAccountJobs.find(item => item.job.status === 'processing' || item.job.status === 'waiting');
        if (runningJob) return runningJob;

        return latestAccountJobs[0];
    }, [latestAccountJobs, activeAccount]);

    const selectedJob = displayItem?.job;
    const selectedAccount = displayItem?.account;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return "text-green-600";
            case 'processing': return "text-blue-600";
            case 'waiting': return "text-purple-600"; 
            case 'paused': return "text-yellow-600";
            case 'stopped': return "text-orange-600";
            case 'failed': return "text-red-500";
            default: return "text-muted-foreground";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'processing': return <Loader2 className="w-3 h-3 animate-spin" />;
            case 'waiting': return <Clock className="w-3 h-3 animate-pulse" />; 
            case 'completed': return <CheckCircle2 className="w-3 h-3" />;
            case 'stopped': return <StopCircle className="w-3 h-3" />;
            case 'failed': return <AlertCircle className="w-3 h-3" />;
            default: return null;
        }
    };

    if (!selectedJob || !selectedAccount) {
        return (
            <Button variant="outline" className="w-[340px] justify-between text-muted-foreground opacity-50 cursor-not-allowed h-auto py-2 px-3 bg-background">
                <div className="flex flex-col items-start text-left w-full gap-1">
                    <span className="font-semibold text-sm">No recent activity</span>
                    <span className="text-xs">Start an import to see progress</span>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
        );
    }

    const progress = selectedJob.totalItems > 0 
        ? (selectedJob.processedItems / selectedJob.totalItems) * 100 
        : 0;

    const getProviderLabel = (p: string) => {
        if (p === 'activecampaign') return 'ActiveCampaign';
        if (p === 'buttondown') return 'Buttondown';
        if (p === 'benchmark') return 'BenchMark';
        if (p === 'omnisend') return 'Omnisend';
        if (p === 'ahasend') return 'Ahasend'; 
        return p.substring(0, 2).toUpperCase();
    };

    const getProviderColor = (p: string) => {
        if (p === 'activecampaign') return "border-blue-200 text-blue-600 bg-blue-50";
        if (p === 'buttondown') return "border-indigo-200 text-indigo-600 bg-indigo-50";
        if (p === 'ahasend') return "border-purple-200 text-purple-600 bg-purple-50"; 
        return "border-orange-200 text-orange-600 bg-orange-50";
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-[340px] justify-between h-auto py-2 px-3 bg-background">
                    <div className="flex flex-col items-start text-left w-full gap-1">
                        <div className="flex justify-between w-full items-center">
                            <span className="font-semibold text-sm truncate max-w-[200px]">
                                {selectedAccount.name} <span className="text-muted-foreground font-normal text-xs capitalize">- {selectedAccount.provider}</span>
                            </span>
                            <div className="flex items-center gap-1">
                                {selectedJob.failedItems > 0 && (
                                    <Badge variant="destructive" className="text-[10px] h-5 px-1.5 gap-1 bg-red-500 hover:bg-red-500">
                                        {selectedJob.failedItems} Failed
                                    </Badge>
                                )}
                                <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 capitalize gap-1", getStatusColor(selectedJob.status))}>
                                    {getStatusIcon(selectedJob.status)}
                                    {selectedJob.status}
                                </Badge>
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center w-full text-xs text-muted-foreground">
                            <span className="font-mono">
                                {selectedJob.processedItems}/{selectedJob.totalItems}
                            </span>
                            <span>{progress.toFixed(0)}%</span>
                        </div>

                        <div className="w-full h-1 bg-secondary mt-1 rounded-full overflow-hidden">
                            <div 
                                className={cn("h-full transition-all duration-300", 
                                    selectedJob.status === 'completed' ? "bg-green-500" : 
                                    selectedJob.status === 'failed' ? "bg-red-500" : 
                                    selectedJob.status === 'stopped' ? "bg-orange-400" : "bg-blue-500"
                                )}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[400px] p-0" align="end">
                <Command>
                    <CommandInput placeholder="Search active jobs..." />
                    
                    {/* --- NEW: GLOBAL ACTION BUTTONS (RESUME, PAUSE, END) --- */}
                    {(hasPausableJobs || hasStoppableJobs || hasResumableJobs) && (
                        <div className="flex items-center gap-2 p-2 border-b bg-muted/10">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 h-8 text-xs font-medium bg-background hover:bg-green-50 hover:text-green-600 hover:border-green-200" 
                                onClick={handleResumeAll}
                                disabled={!hasResumableJobs}
                            >
                                <Play className="w-3 h-3 mr-1.5 text-green-500" /> Resume All
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 h-8 text-xs font-medium bg-background hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200" 
                                onClick={handlePauseAll}
                                disabled={!hasPausableJobs}
                            >
                                <Pause className="w-3 h-3 mr-1.5 text-orange-500" /> Pause All
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 h-8 text-xs font-medium bg-background hover:bg-red-50 hover:text-red-600 hover:border-red-200" 
                                onClick={handleStopAll}
                                disabled={!hasStoppableJobs}
                            >
                                <Square className="w-3 h-3 mr-1.5 text-red-500" /> End All
                            </Button>
                        </div>
                    )}

                    <CommandList>
                        <CommandEmpty>No recent jobs found.</CommandEmpty>
                        <CommandGroup heading="Recent Jobs (All Accounts)">
                            {latestAccountJobs.map(({ job, account }) => {
                                const isCurrentContext = account.id === activeAccount?.id;
                                const jobProgress = job.totalItems > 0 ? (job.processedItems / job.totalItems) * 100 : 0;
                                const failCount = job.failedItems || 0;

                                return (
                                    <CommandItem
                                        key={account.id}
                                        value={account.name + account.provider} 
                                        onSelect={() => {
                                            setActiveAccount(account);
                                            setOpen(false);
                                        }}
                                        className="flex flex-col items-start py-3 border-b last:border-0 cursor-pointer data-[selected=true]:bg-accent"
                                    >
                                        <div className="flex justify-between w-full items-center mb-1">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <span className="font-medium text-sm truncate max-w-[150px]">
                                                    {account.name}
                                                </span>
                                                <Badge variant="outline" className={cn("text-[10px] h-4 px-1", getProviderColor(account.provider))}>
                                                    {getProviderLabel(account.provider)}
                                                </Badge>
                                            </div>
                                            {isCurrentContext && <Check className="h-4 w-4 text-primary ml-auto" />}
                                        </div>

                                        <div className="flex justify-between items-center w-full text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className={cn("capitalize flex items-center gap-1", getStatusColor(job.status))}>
                                                    {getStatusIcon(job.status)}
                                                    {job.status}
                                                </span>
                                                {failCount > 0 && (
                                                    <span className="flex items-center justify-center h-4 px-1.5 rounded-full bg-red-100 text-[9px] font-bold text-red-600">
                                                        {failCount} Fail
                                                    </span>
                                                )}
                                            </div>
                                            <span className="font-mono text-muted-foreground">
                                                {job.processedItems}/{job.totalItems}
                                            </span>
                                        </div>
                                        
                                        <div className="w-full h-0.5 bg-muted mt-2 rounded-full overflow-hidden">
                                            <div 
                                                className={cn("h-full", 
                                                    job.status === 'completed' ? "bg-green-500" : 
                                                    job.status === 'failed' ? "bg-red-500" : 
                                                    job.status === 'stopped' ? "bg-orange-400" : "bg-blue-500"
                                                )}
                                                style={{ width: `${jobProgress}%` }}
                                            />
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}