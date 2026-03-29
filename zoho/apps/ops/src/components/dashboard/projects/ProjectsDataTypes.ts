// --- FILE: src/components/dashboard/projects/ProjectsDataTypes.ts ---

import { ProjectsJobState, ProjectsResult } from '@/App';

export interface ZohoProject {
    id: string;
    name: string;
    status: string;
    portal_id: string; 
}

export interface ZohoTaskList {
    id: string;
    name: string;
}

export interface ZohoTask {
    id: string;
    name: string;
    prefix: string;
    tasklist: {
        id: string;
        name: string;
    };
    status: {
        id: string;
        name: string;
    };
    created_time: string;
    due_date: string;
    details?: string;
}

export interface ProjectsTasksFormData {
    emails: string; 
    projectId: string; 
    tasklistId: string; 
    taskName: string;
    taskDescription: string;
    delay: number;
}

export interface TaskLogResult {
    projectName: string;
    success: boolean;
    details?: string;
    error?: string;
    fullResponse?: any;
}

export interface TaskProgressState {
    formData: ProjectsTasksFormData;
    results: TaskLogResult[];
    isProcessing: boolean;
    isPaused: boolean;
    isComplete: boolean;
    processingStartTime: Date | null;
    processingTime: number;
    totalToProcess: number;
    countdown: number;
    currentDelay: number;
    filterText: string;
}

// <--- NEW: Background Delete Tracking State --->
export interface ProjectsDeleteJobState {
    isDeleting: boolean;
    totalToDelete: number;
    deletedCount: number;
    failedCount: number;
    failedIds: string[];
}
// <--- END NEW INTERFACE --->

export { ProjectsJobState, ProjectsResult };