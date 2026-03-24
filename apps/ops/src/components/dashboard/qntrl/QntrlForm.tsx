// --- FILE: apps/ops/src/components/dashboard/qntrl/QntrlForm.tsx ---
import React, { useState, useEffect, useMemo } from 'react';
import type { Socket } from 'socket.io-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { QntrlJobs, QntrlFormData } from '@/App';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Play, Pause, Square, Clock, CheckCircle, XCircle,
  ImagePlus, Eye, Hash, AlertTriangle, RotateCcw
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge'; 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface QntrlFormProps {
  profileName: string;
  socket: Socket | null;
  job: QntrlJobs[string];
  setJobState: (profileName: string, state: Partial<QntrlJobs[string]> | ((prevState: QntrlJobs[string]) => QntrlJobs[string])) => void;
  createInitialJobState: () => QntrlJobs[string];
}

interface QntrlForm {
  layout_name: string;
  layout_id: string;
}

interface QntrlFormComponent {
  field_label: string;
  field_api_name: string;
  field_type: number;
  is_mandatory: boolean;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
};

const ImageToolDialog = ({ onApply }: { onApply: (html: string) => void }) => {
    const [imageUrl, setImageUrl] = useState('');
    const [altText, setAltText] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [width, setWidth] = useState('80');
    const [maxWidth, setMaxWidth] = useState('500');
    const [alignment, setAlignment] = useState('center');
    const [isOpen, setIsOpen] = useState(false);

    const handleApply = () => {
        let style = `width: ${width}%; max-width: ${maxWidth}px; height: auto; border: 1px solid #dddddd; margin-top: 10px; margin-bottom: 10px;`;
        let imgTag = `<img src="${imageUrl}" alt="${altText}" style="${style}" />`;
        if (linkUrl) imgTag = `<a href="${linkUrl}">${imgTag}</a>`;
        const containerStyle = `text-align: ${alignment};`;
        onApply(`<div style="${containerStyle}">${imgTag}</div>`);
        setIsOpen(false);
        setImageUrl(''); setAltText(''); setLinkUrl('');
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"><ImagePlus className="h-3 w-3 mr-1" />Add Image</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader><DialogTitle>Add and Style Image</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="imageUrl" className="text-right">Image URL</Label>
                        <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="col-span-3" placeholder="https://example.com/image.png" />
                    </div>
                    {imageUrl && (<div className="col-span-4 flex justify-center p-4 bg-muted rounded-md"><img src={imageUrl} alt="Preview" className="max-w-full max-h-48" /></div>)}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="width" className="text-right">Width (%)</Label>
                        <Input id="width" type="number" value={width} onChange={(e) => setWidth(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="alignment" className="text-right">Alignment</Label>
                        <Select value={alignment} onValueChange={setAlignment}>
                            <SelectTrigger className="col-span-3"><SelectValue placeholder="Select alignment" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <Button onClick={handleApply} disabled={!imageUrl}>Apply and Insert</Button>
            </DialogContent>
        </Dialog>
    );
};


export const QntrlForm: React.FC<QntrlFormProps> = ({ profileName, socket, job, setJobState, createInitialJobState }) => {
  const { toast } = useToast();
  const { formData, isProcessing, isPaused, results, totalToProcess, countdown, currentDelay, processingTime } = job;
  const initialJobState = createInitialJobState();

  const [forms, setForms] = useState<QntrlForm[]>([]);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [formComponents, setFormComponents] = useState<QntrlFormComponent[]>([]);
  const [isLoadingComponents, setIsLoadingComponents] = useState(false);

  const primaryValuesCount = useMemo(() => formData.bulkPrimaryValues.split('\n').filter(line => line.trim() !== '').length, [formData.bulkPrimaryValues]);

  // 🟢 FIXED: Extract stopAfterFailures explicitly & FORCE DEFAULT 4
  const stopAfterFailures = (formData as any).stopAfterFailures;
  
  useEffect(() => {
    if (profileName) {
        const currentFormData = formData as any;
        if (currentFormData.pauseInitialized === undefined) {
            setJobState(profileName, (prevJobState) => ({
                ...prevJobState,
                formData: {
                    ...prevJobState.formData,
                    stopAfterFailures: 4, 
                    pauseInitialized: true
                }
            }));
        }
    }
  }, [profileName, formData, setJobState]);

  useEffect(() => {
    if (profileName && socket) {
      setIsLoadingForms(true);
      socket.emit('getQntrlForms', { selectedProfileName: profileName });
      socket.on('qntrlFormsResult', (data: { success: boolean, forms?: any[], error?: string }) => {
        if (data.success && data.forms) setForms(data.forms);
        else toast({ title: 'Error loading Qntrl forms', description: data.error, variant: 'destructive' });
        setIsLoadingForms(false);
      });
      return () => { socket.off('qntrlFormsResult'); };
    }
  }, [profileName, socket, toast]);

  useEffect(() => {
    if (formData.selectedFormId && socket) {
      setIsLoadingComponents(true);
      setFormComponents([]);
      socket.emit('getQntrlFormDetails', { selectedProfileName: profileName, formId: formData.selectedFormId });
      socket.on('qntrlFormDetailsResult', (data: { success: boolean, components?: any[], error?: string }) => {
        if (data.success && data.components) setFormComponents(data.components);
        else { setFormComponents([]); toast({ title: 'Error loading form details', description: data.error, variant: 'destructive' }); }
        setIsLoadingComponents(false);
      });
      return () => { socket.off('qntrlFormDetailsResult'); };
    }
  }, [formData.selectedFormId, profileName, socket, toast]);

  useEffect(() => {
    if (formComponents.length > 0 && !formData.bulkPrimaryField) {
      const emailField = formComponents.find((c) => c.field_label.toLowerCase() === 'email' || c.field_api_name.toLowerCase().includes('email'));
      if (emailField) {
        setJobState(profileName, (prevJobState) => ({ ...prevJobState, formData: { ...prevJobState.formData, bulkPrimaryField: emailField.field_api_name } }));
      }
    }
  }, [formComponents, profileName, setJobState, formData.bulkPrimaryField]);

  const handleFormChange = (formId: string) => {
    setFormComponents([]);
    setJobState(profileName, { ...initialJobState, formData: { ...initialJobState.formData, selectedFormId: formId } });
  };
  
  const handleInputChange = (field: keyof QntrlFormData | 'stopAfterFailures', value: any) => {
    setJobState(profileName, (prevJobState) => ({ ...prevJobState, formData: { ...prevJobState.formData, [field]: value } }));
  };

  const handleDefaultDataChange = (fieldApiName: string, value: string) => {
    setJobState(profileName, (prevJobState) => ({ ...prevJobState, formData: { ...prevJobState.formData, bulkDefaultData: { ...prevJobState.formData.bulkDefaultData, [fieldApiName]: value } } }));
  };

  const handleStart = () => {
    if (!socket) return;
    const { selectedFormId, bulkPrimaryField, bulkPrimaryValues, bulkDelay } = formData;

    if (!selectedFormId || !bulkPrimaryField || !bulkPrimaryValues) {
        toast({ title: "Error", description: "Please select a form, a primary field, and provide values.", variant: "destructive" }); return;
    }

    const values = bulkPrimaryValues.split('\n').filter(Boolean);
    if (values.length === 0) {
        toast({ title: "Error", description: "Please provide at least one value in the primary values field.", variant: "destructive" }); return;
    }

    socket.emit('startBulkCreateCards', {
      selectedProfileName: profileName,
      formData: { ...formData, bulkDelay: Number(bulkDelay) || 1, stopAfterFailures: stopAfterFailures },
      totalToProcess: values.length,
    });

    setJobState(profileName, {
      isProcessing: true, isPaused: false, isComplete: false, results: [], processingStartTime: new Date(), processingTime: 0,
      totalToProcess: values.length, currentDelay: Number(bulkDelay) || 1, countdown: Number(bulkDelay) || 1,
    });
  };

  const handlePause = () => {
    if (!socket) return;
    socket.emit('pauseJob', { profileName, jobType: 'qntrl' });
    setJobState(profileName, { isPaused: true });
  };

  const handleResume = () => {
    if (!socket) return;
    socket.emit('resumeJob', { profileName, jobType: 'qntrl' });
    setJobState(profileName, { isPaused: false });
  };

  const handleEnd = () => {
    if (!socket) return;
    socket.emit('endJob', { profileName, jobType: 'qntrl' });
    setJobState(profileName, { isProcessing: false, isPaused: false, isComplete: true });
  };

  // 🟢 NEW: RETRY FAILED LOGIC
  const handleRetryFailed = () => {
      const failedItems = results.filter(r => !r.success);
      if (failedItems.length === 0) {
          toast({ title: "No failed items found to retry." });
          return;
      }
      
      const failedValues = failedItems.map(r => r.primaryValue).join('\n'); 
      setJobState(profileName, {
          isProcessing: false,
          isPaused: false,
          isComplete: false,
          results: [],
          processingTime: 0,
          totalToProcess: failedItems.length,
          formData: {
              ...formData,
              bulkPrimaryValues: failedValues 
          }
      });
      toast({ title: "Retry Ready", description: `${failedItems.length} failed records loaded. Click Start.` });
  };

  const progress = totalToProcess > 0 ? (results.length / totalToProcess) * 100 : 0;
  const otherComponents = formComponents.filter(c => c.field_api_name !== formData.bulkPrimaryField);
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  const remainingCount = totalToProcess - results.length;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Bulk Create Qntrl Cards</CardTitle>
        <CardDescription>Select a form and provide data to create cards in bulk.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="qntrl-form">Qntrl Form (Layout)</Label>
          <Select value={formData.selectedFormId} onValueChange={handleFormChange} disabled={isProcessing || isLoadingForms}>
            <SelectTrigger id="qntrl-form"><SelectValue placeholder={isLoadingForms ? "Loading forms..." : "Select a form"} /></SelectTrigger>
            <SelectContent>
              {forms.map((form) => (<SelectItem key={form.layout_id} value={form.layout_id}>{form.layout_name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        {(isLoadingComponents) && <div className="flex items-center space-x-2"><Loader2 className="h-4 w-4 animate-spin" /><span>Loading form fields...</span></div>}

        {formComponents.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="primary-field">Bulk Primary Field</Label>
                <Select value={formData.bulkPrimaryField} onValueChange={(value) => handleInputChange('bulkPrimaryField', value)} disabled={isProcessing}>
                  <SelectTrigger id="primary-field"><SelectValue placeholder="Select primary field" /></SelectTrigger>
                  <SelectContent>{formComponents.map((component) => (<SelectItem key={component.field_api_name} value={component.field_api_name}>{component.field_label} ({component.field_api_name})</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delay">Delay (seconds)</Label>
                <Input id="delay" type="number" min="0.5" step="0.1" value={formData.bulkDelay} onChange={(e) => handleInputChange('bulkDelay', Number(e.target.value))} disabled={isProcessing} />
              </div>
              
              {/* 🟢 NEW: Auto-Pause Input */}
              <div className="space-y-2">
                  <Label htmlFor="stopFailures" className="flex items-center space-x-1 whitespace-nowrap">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      <span>Auto-pause</span>
                  </Label>
                  <div className="flex items-center gap-2">
                      <Input
                          id="stopFailures"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={stopAfterFailures === undefined ? '' : stopAfterFailures}
                          onChange={(e) => {
                              const val = e.target.value;
                              handleInputChange('stopAfterFailures' as any, val === '' ? 0 : parseInt(val));
                          }}
                          className="w-24 placeholder:text-muted-foreground/70"
                          disabled={isProcessing}
                      />
                      <span className="text-xs text-muted-foreground">(0 = disabled)</span>
                  </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="primary-values">Bulk Primary Values (one per line)</Label>
                    <Badge variant="secondary" className="text-xs"><Hash className="h-3 w-3 mr-1" />{primaryValuesCount} records</Badge>
                  </div>
                  <Textarea id="primary-values" placeholder="Paste your list of values here. Each line will become a new card." value={formData.bulkPrimaryValues} onChange={(e) => handleInputChange('bulkPrimaryValues', e.target.value)} disabled={isProcessing} rows={15} />
                </div>

                {(isProcessing || (job.isComplete && results.length > 0)) && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-xs text-muted-foreground">TIME ELAPSED</div>
                      <div className="text-lg font-bold flex items-center justify-center space-x-1"><Clock className="h-4 w-4" /><span>{formatTime(processingTime)}</span></div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-xs text-muted-foreground">SUCCESS</div>
                      <div className="text-lg font-bold flex items-center justify-center space-x-1 text-green-600"><CheckCircle className="h-4 w-4" /><span>{successCount}</span></div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-xs text-muted-foreground">FAILED</div>
                      <div className="text-lg font-bold flex items-center justify-center space-x-1 text-red-600"><XCircle className="h-4 w-4" /><span>{failCount}</span></div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-xs text-muted-foreground">REMAINING</div>
                      <div className="text-lg font-bold flex items-center justify-center space-x-1"><Loader2 className="h-4 w-4 animate-spin" /><span>{remainingCount}</span></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Label>Default Data</Label>
                <ScrollArea className="h-[350px] w-full rounded-md border p-4">
                  <div className="space-y-4">
                    {otherComponents.length > 0 ? (
                      otherComponents.map((component) => (
                        <div key={component.field_api_name} className="space-y-2">
                          {component.field_type === 1 ? (
                            <Tabs defaultValue="write" className="w-full">
                              <div className="flex items-center justify-between">
                                <Label htmlFor={`default-${component.field_api_name}`}>{component.field_label} {component.is_mandatory && <span className="text-red-500">*</span>}</Label>
                                <div className="flex items-center space-x-1">
                                  <ImageToolDialog onApply={(html) => { const currentValue = formData.bulkDefaultData[component.field_api_name] || ''; handleDefaultDataChange(component.field_api_name, currentValue + '\n' + html); }} />
                                  <TabsList className="grid grid-cols-2 h-7"><TabsTrigger value="write" className="h-5 px-2 text-xs">Write</TabsTrigger><TabsTrigger value="preview" className="h-5 px-2 text-xs">Preview</TabsTrigger></TabsList>
                                </div>
                              </div>
                              <TabsContent value="write">
                                <Textarea id={`default-${component.field_api_name}`} placeholder={`Default value for ${component.field_label} (HTML/Markdown supported)`} value={formData.bulkDefaultData[component.field_api_name] || ''} onChange={(e) => handleDefaultDataChange(component.field_api_name, e.target.value)} disabled={isProcessing} rows={5} />
                              </TabsContent>
                              <TabsContent value="preview">
                                <div className="p-3 bg-muted rounded-md border min-h-[105px] prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: formData.bulkDefaultData[component.field_api_name] || '<p class="text-muted-foreground">No content yet.</p>' }} />
                              </TabsContent>
                            </Tabs>
                          ) : (
                            <>
                              <Label htmlFor={`default-${component.field_api_name}`}>{component.field_label} {component.is_mandatory && <span className="text-red-500">*</span>}</Label>
                              <Input id={`default-${component.field_api_name}`} type="text" placeholder={`Default value for ${component.field_label}`} value={formData.bulkDefaultData[component.field_api_name] || ''} onChange={(e) => handleDefaultDataChange(component.field_api_name, e.target.value)} disabled={isProcessing} />
                            </>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No other fields to configure.</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </>
        )}

        {isProcessing && (
          <div className="space-y-2">
            <Label>Progress</Label>
            <Progress value={progress} />
            <div className="flex justify-between text-sm">
              <span>{results.length} / {totalToProcess}</span>
              {!isPaused && <span>Next in: {countdown.toFixed(1)}s</span>}
            </div>
          </div>
        )}

        <div className="flex space-x-2">
          {!isProcessing ? (
             <div className="flex gap-2 w-full">
                <Button onClick={handleStart} className="flex-1" disabled={!profileName || !socket || !formData.selectedFormId || isLoadingComponents}>
                    <Play className="mr-2 h-4 w-4" /> Start Bulk Creation
                </Button>
                {/* 🟢 NEW: RETRY BUTTON */}
                {results.filter(r => !r.success).length > 0 && (
                    <Button variant="secondary" className="border-red-200 hover:bg-red-50 text-red-700" onClick={handleRetryFailed}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Retry Failed ({results.filter(r => !r.success).length})
                    </Button>
                )}
             </div>
          ) : (
            <>
              {isPaused ? (
                <Button onClick={handleResume} variant="secondary">
                  <Play className="mr-2 h-4 w-4" /> Resume
                </Button>
              ) : (
                <Button onClick={handlePause} variant="secondary">
                  <Pause className="mr-2 h-4 w-4" /> Pause
                </Button>
              )}
              <Button onClick={handleEnd} variant="destructive">
                <Square className="mr-2 h-4 w-4" /> End
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};