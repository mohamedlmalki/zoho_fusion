import { useState, useEffect, useRef } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Workflow, BarChart3, Edit2, Loader2, Save, Pencil, FileCode, Bold, Italic, Underline, List, Heading1, Heading2, Quote, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";

// --- INTERFACES ---
interface Automation {
    workflowId: string;
    name: string;
    status: string; 
    contactCount: string;
    fromName: string;
}

interface ReportStep {
    stepId: string;
    subject: string;
    sends: number;
    opens: number;
    clicks: number;
    bounces: number;
}

// --- COMPONENT: Rich Text Editor ---
// A simple WYSIWYG editor without external dependencies
function RichTextEditor({ initialContent, onChange }: { initialContent: string, onChange: (html: string) => void }) {
    const editorRef = useRef<HTMLDivElement>(null);

    // Initialize content once
    useEffect(() => {
        if (editorRef.current && initialContent) {
            editorRef.current.innerHTML = initialContent;
        }
    }, []); // Run once on mount

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const execCmd = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        handleInput(); // Sync changes
        editorRef.current?.focus();
    };

    return (
        <div className="flex flex-col h-full border rounded-md overflow-hidden bg-background">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/20">
                <Button variant="ghost" size="icon" onClick={() => execCmd('bold')} title="Bold"><Bold className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => execCmd('italic')} title="Italic"><Italic className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => execCmd('underline')} title="Underline"><Underline className="h-4 w-4" /></Button>
                <div className="w-px h-6 bg-border mx-1 my-auto" />
                <Button variant="ghost" size="icon" onClick={() => execCmd('formatBlock', 'H1')} title="Heading 1"><Heading1 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => execCmd('formatBlock', 'H2')} title="Heading 2"><Heading2 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => execCmd('formatBlock', 'P')} title="Paragraph"><span className="font-serif text-sm font-bold">P</span></Button>
                <div className="w-px h-6 bg-border mx-1 my-auto" />
                <Button variant="ghost" size="icon" onClick={() => execCmd('insertUnorderedList')} title="Bullet List"><List className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => execCmd('formatBlock', 'BLOCKQUOTE')} title="Quote"><Quote className="h-4 w-4" /></Button>
                <div className="w-px h-6 bg-border mx-1 my-auto" />
                <Button variant="ghost" size="icon" onClick={() => execCmd('justifyLeft')} title="Align Left"><AlignLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => execCmd('justifyCenter')} title="Align Center"><AlignCenter className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => execCmd('justifyRight')} title="Align Right"><AlignRight className="h-4 w-4" /></Button>
            </div>
            
            {/* Editable Area */}
            <div 
                ref={editorRef}
                className="flex-1 p-4 overflow-y-auto outline-none prose prose-sm max-w-none"
                contentEditable
                onInput={handleInput}
                style={{ minHeight: '300px' }}
            />
        </div>
    );
}

// --- COMPONENT: Content Editor Dialog Content ---
function ContentEditorDialog({ step, automationId, apiKey, onClose }: { step: ReportStep, automationId: string, apiKey: string, onClose: () => void }) {
    const [htmlContent, setHtmlContent] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    // Fetch Content
    useEffect(() => {
        const fetchContent = async () => {
            try {
                const res = await fetch(`/api/benchmark/automations/${automationId}/emails/${step.stepId}/content`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ apiKey }),
                });
                const data = await res.json();
                if(data.content?.TemplateContent) setHtmlContent(data.content.TemplateContent);
            } catch (error) {
                toast({ title: "Error", description: "Could not load content", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchContent();
    }, [automationId, step.stepId, apiKey]);

    const updateContentMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/benchmark/automations/${automationId}/emails/${step.stepId}/content`, {
                method: "PATCH", // Changed to PATCH to match backend update
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiKey, htmlContent }),
            });
            if (!res.ok) throw new Error("Failed to update content");
        },
        onSuccess: () => { toast({ title: "Success", description: "Email content updated." }); onClose(); },
        onError: () => toast({ title: "Error", description: "Failed to update content", variant: "destructive" }),
    });

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <Label>Design Email</Label>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center border rounded-md"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
                <div className="flex-1">
                    <RichTextEditor 
                        initialContent={htmlContent} 
                        onChange={setHtmlContent} 
                    />
                </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={() => updateContentMutation.mutate()} disabled={updateContentMutation.isPending || isLoading}>
                    {updateContentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Design
                </Button>
            </div>
        </div>
    );
}

// --- COMPONENT: Subject Edit Row ---
function SubjectEditRow({ step, automationId, apiKey, onSuccess }: { step: ReportStep, automationId: string, apiKey: string, onSuccess: () => void }) {
    const [subject, setSubject] = useState(step.subject);
    const [isChanged, setIsChanged] = useState(false);

    const updateSubjectMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/benchmark/automations/${automationId}/emails/${step.stepId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiKey, subject }),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
        },
        onSuccess: () => { toast({ title: "Success", description: "Subject updated." }); setIsChanged(false); onSuccess(); },
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });

    return (
        <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <Input value={subject} onChange={(e) => { setSubject(e.target.value); setIsChanged(true); }} placeholder="Subject" />
            </div>
            <Button onClick={() => updateSubjectMutation.mutate()} disabled={!isChanged || updateSubjectMutation.isPending} size="icon" className="mb-[2px]">
                {updateSubjectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
        </div>
    );
}

// --- MAIN PAGE ---
export default function Automations() {
  const { activeAccount } = useAccount();
  const queryClient = useQueryClient();
  
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [editingAuto, setEditingAuto] = useState<Automation | null>(null);
  const [editingContentStep, setEditingContentStep] = useState<ReportStep | null>(null);
  const [newName, setNewName] = useState("");

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ["bm-automations", activeAccount?.id],
    queryFn: async () => {
      if (!activeAccount) return [];
      try {
          const res = await fetch("/api/benchmark/automations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey: activeAccount.apiKey }),
          });
          if (!res.ok) throw new Error("Server Error");
          const data = await res.json();
          return Array.isArray(data) ? data : []; 
      } catch (err) { return []; }
    },
    enabled: !!activeAccount,
  });

  // Track active detail ID
  const currentAutoId = editingAuto?.workflowId || selectedReportId; 

  const { data: detailData, isLoading: isLoadingDetails, refetch: refetchDetails } = useQuery({
    queryKey: ["bm-auto-details", currentAutoId],
    queryFn: async () => {
        if(!currentAutoId) return [];
        const res = await fetch(`/api/benchmark/automations/${currentAutoId}/report`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey: activeAccount?.apiKey }),
        });
        return res.json() as Promise<ReportStep[]>;
    },
    enabled: !!currentAutoId && !!activeAccount,
  });

  const updateFromNameMutation = useMutation({
    mutationFn: async () => {
        if (!editingAuto) return;
        const res = await fetch(`/api/benchmark/automations/${editingAuto.workflowId}/from-name`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey: activeAccount?.apiKey, newFromName: newName }),
        });
        if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { toast({ title: "Success", description: "From Name updated." }); queryClient.invalidateQueries({ queryKey: ["bm-automations"] }); },
    onError: () => toast({ title: "Error", description: "Failed to update.", variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Workflow className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Automations</h1>
          <p className="text-muted-foreground">Manage and monitor your Benchmark Automations.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Active Workflows</CardTitle></CardHeader>
        <CardContent>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>From Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Contacts</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                        ) : automations?.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center h-24">No automations found.</TableCell></TableRow>
                        ) : (
                            automations?.map((auto) => (
                                <TableRow key={auto.workflowId}>
                                    <TableCell className="font-medium">{auto.name}</TableCell>
                                    <TableCell>{auto.fromName}</TableCell>
                                    <TableCell><Badge variant={auto.status === "1" ? "default" : "secondary"}>{auto.status === "1" ? "Active" : "Inactive"}</Badge></TableCell>
                                    <TableCell>{auto.contactCount}</TableCell>
                                    <TableCell className="text-right flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingAuto(auto); setNewName(auto.fromName); }} title="Edit Settings">
                                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedReportId(auto.workflowId)} title="View Stats">
                                            <BarChart3 className="h-4 w-4 text-primary" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>

      {/* --- EDIT SETTINGS DIALOG --- */}
      <Dialog open={!!editingAuto} onOpenChange={(open) => !open && setEditingAuto(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Automation Settings</DialogTitle></DialogHeader>
            <div className="space-y-6 py-4">
                <div className="flex gap-3 items-end p-4 border rounded-md bg-muted/10">
                    <div className="flex-1 space-y-1"><Label>From Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
                    <Button onClick={() => updateFromNameMutation.mutate()} disabled={updateFromNameMutation.isPending} className="mb-[2px]">
                        {updateFromNameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                    </Button>
                </div>
                <div className="space-y-3">
                    <h3 className="text-sm font-medium border-b pb-2">Email Subjects</h3>
                    {isLoadingDetails ? <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> 
                    : detailData && detailData.length > 0 ? (
                        <div className="space-y-4">
                            {detailData.map((step) => (
                                <SubjectEditRow key={step.stepId} step={step} automationId={editingAuto?.workflowId!} apiKey={activeAccount?.apiKey!} onSuccess={() => refetchDetails()}/>
                            ))}
                        </div>
                    ) : <p className="text-sm text-muted-foreground text-center">No emails found.</p>}
                </div>
            </div>
        </DialogContent>
      </Dialog>

      {/* --- REPORT DIALOG --- */}
      <Dialog open={!!selectedReportId} onOpenChange={(open) => !open && setSelectedReportId(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Automation Report</DialogTitle></DialogHeader>
            {isLoadingDetails ? <div className="py-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Email Subject</TableHead>
                                <TableHead>Sends</TableHead>
                                <TableHead>Opens</TableHead>
                                <TableHead>Clicks</TableHead>
                                <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {detailData?.map((step) => (
                                <TableRow key={step.stepId}>
                                    <TableCell className="font-medium">{step.subject}</TableCell>
                                    <TableCell>{step.sends}</TableCell>
                                    <TableCell className="text-green-600">{step.opens}</TableCell>
                                    <TableCell className="text-blue-600">{step.clicks}</TableCell>
                                    <TableCell className="flex gap-1 justify-end">
                                        <Button variant="ghost" size="icon" onClick={() => { 
                                            const auto = automations.find(a => a.workflowId === selectedReportId);
                                            if(auto) { setSelectedReportId(null); setEditingAuto(auto); setNewName(auto.fromName); }
                                        }} title="Edit Subject">
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => {
                                             setEditingContentStep(step);
                                        }} title="Design Email">
                                            <FileCode className="h-3 w-3 text-blue-600" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </DialogContent>
      </Dialog>

      {/* --- CONTENT EDITOR DIALOG (RICH TEXT) --- */}
      <Dialog open={!!editingContentStep} onOpenChange={(open) => !open && setEditingContentStep(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Design Email Content</DialogTitle>
                <DialogDescription>Editing: <span className="font-semibold">{editingContentStep?.subject}</span></DialogDescription>
            </DialogHeader>
            {editingContentStep && selectedReportId && (
                <ContentEditorDialog 
                    step={editingContentStep} 
                    automationId={selectedReportId} 
                    apiKey={activeAccount?.apiKey!} 
                    onClose={() => setEditingContentStep(null)} 
                />
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}