// --- FILE: src/components/dashboard/projects/TaskProgressTable.tsx ---
import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TaskLogResult } from './ProjectsDataTypes';
import { CheckCircle2, XCircle, Search, RefreshCw, Loader2 } from 'lucide-react';

interface TaskProgressTableProps {
    results: TaskLogResult[];
    isProcessing: boolean;
    isComplete: boolean;
    totalToProcess: number;
    countdown: number;
    filterText: string;
    onFilterTextChange: (text: string) => void;
    onRetry: () => void;
}

export const TaskProgressTable: React.FC<TaskProgressTableProps> = ({
    results,
    isProcessing,
    isComplete,
    totalToProcess,
    countdown,
    filterText,
    onFilterTextChange,
    onRetry,
}) => {
    
    // Auto-filter the logs based on search input
    const filteredResults = useMemo(() => {
        if (!filterText.trim()) return results;
        return results.filter(r => 
            r.projectName.toLowerCase().includes(filterText.toLowerCase()) ||
            (r.details && r.details.toLowerCase().includes(filterText.toLowerCase())) ||
            (r.error && r.error.toLowerCase().includes(filterText.toLowerCase()))
        );
    }, [results, filterText]);

    const failedCount = results.filter(r => !r.success).length;
    const progressPercentage = totalToProcess > 0 ? (results.length / totalToProcess) * 100 : 0;

    if (results.length === 0 && !isProcessing && !isComplete) {
        return null; // Hide if nothing has happened yet
    }

    return (
        <div className="space-y-4 p-4 border rounded-xl bg-card shadow-sm">
            
            {/* Header & Progress Bar */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center">
                        Task Creation Log
                        {isProcessing && <Loader2 className="w-4 h-4 ml-2 animate-spin text-muted-foreground" />}
                    </h3>
                    <div className="text-sm font-medium text-muted-foreground">
                        {results.length} / {totalToProcess} Processed
                    </div>
                </div>
                
                <Progress value={progressPercentage} className="h-2" />
                
                {countdown > 0 && isProcessing && (
                    <p className="text-xs text-muted-foreground animate-pulse">
                        Waiting {countdown}s before next request to respect rate limits...
                    </p>
                )}
            </div>

            {/* Toolbar: Search and Retry */}
            <div className="flex items-center justify-between py-2">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter logs by name or error..."
                        value={filterText}
                        onChange={(e) => onFilterTextChange(e.target.value)}
                        className="pl-9 bg-background"
                    />
                </div>
                
                {isComplete && failedCount > 0 && (
                    <Button onClick={onRetry} variant="outline" className="ml-4 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry {failedCount} Failed
                    </Button>
                )}
            </div>

            {/* Log Table */}
            <div className="border rounded-md overflow-hidden bg-background">
                <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-secondary/80 backdrop-blur z-10">
                            <TableRow>
                                <TableHead className="w-[50px]">Status</TableHead>
                                <TableHead>Task Identifier</TableHead>
                                <TableHead>Details / Error Message</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredResults.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                        No logs match your filter.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredResults.map((result, index) => (
                                    <TableRow key={index} className={!result.success ? "bg-red-50/50 dark:bg-red-950/20" : ""}>
                                        <TableCell>
                                            {result.success ? (
                                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-red-500" />
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {result.projectName}
                                        </TableCell>
                                        <TableCell className={!result.success ? "text-red-600 dark:text-red-400 font-medium text-sm" : "text-sm text-muted-foreground"}>
                                            {result.success ? result.details : result.error}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};