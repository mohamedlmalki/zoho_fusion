import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { 
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage 
} from "@/components/ui/form";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Eye, Send, Loader2, Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import { useAccount } from "@/contexts/AccountContext";

// --- VALIDATION SCHEMA ---
const formSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  tags: z.string().optional(),
});

export default function SendEmail() {
  const { activeAccount } = useAccount();
  const { toast } = useToast();
  
  // Modal States
  const [showPreview, setShowPreview] = useState(false);
  const [showAddImage, setShowAddImage] = useState(false);

  // --- FORM SETUP ---
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: "",
      body: "",
      tags: "",
    },
  });

  const bodyValue = form.watch("body");

  // --- API MUTATION ---
  const sendEmailMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!activeAccount) throw new Error("No account selected");

      const payload = {
        apiKey: activeAccount.apiKey, 
        subject: values.subject,
        body: values.body,
        tags: values.tags ? values.tags.split(',').map(t => t.trim()) : [],
        status: 'sent' 
      };

      const response = await fetch('/api/buttondown/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        let errorMessage = "Failed to send email";
        if (data.error) {
             errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error); 
        }
        throw new Error(errorMessage);
      }
      return data;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Email sent successfully!" });
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Send Failed", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    sendEmailMutation.mutate(values);
  };

  // --- INSERT IMAGE LOGIC ---
  const handleInsertImage = (htmlCode: string) => {
      const currentBody = form.getValues("body") || "";
      // Append nicely with a newline
      form.setValue("body", currentBody + (currentBody ? "\n\n" : "") + htmlCode);
      setShowAddImage(false);
  };

  if (!activeAccount) return <div className="p-8 text-center">Please select a Buttondown account.</div>;

  return (
    <div className="p-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center gap-2">
            <Send className="w-6 h-6" /> Send Email
          </CardTitle>
          <CardDescription>Create and send newsletters via {activeAccount.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* SUBJECT */}
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">Email Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter subject..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* BODY */}
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center mb-1">
                      <FormLabel className="text-sm font-semibold">Email Body (Markdown/HTML)</FormLabel>
                      <div className="flex gap-2">
                        {/* ADD IMAGE BUTTON */}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAddImage(true)}
                            className="h-7 text-xs"
                        >
                            <ImageIcon className="w-3 h-3 mr-1" /> Add Image
                        </Button>
                        {/* PREVIEW BUTTON */}
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowPreview(true)}
                            className="h-7 text-xs"
                        >
                            <Eye className="w-3 h-3 mr-1" /> Preview
                        </Button>
                      </div>
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="Hello world..."
                        rows={12}
                        {...field}
                        className="font-mono text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* TAGS */}
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">Tags (comma separated)</FormLabel>
                    <FormControl>
                      <Input placeholder="newsletter, update, weekly" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* SUBMIT */}
              <Button
                type="submit"
                className="w-full font-semibold py-6"
                disabled={sendEmailMutation.isPending}
              >
                {sendEmailMutation.isPending ? (
                    <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sending...
                    </>
                ) : (
                    <>
                        <Send className="w-5 h-5 mr-2" /> Send Broadcast
                    </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* PREVIEW MODAL */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
                <DialogTitle>Email Preview</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[60vh] w-full border rounded-md p-4 bg-muted/30">
                <div 
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: bodyValue || '<p class="text-muted-foreground italic">No content yet...</p>' }}
                />
            </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ADD IMAGE MODAL */}
      <AddImageDialog 
        open={showAddImage} 
        onOpenChange={setShowAddImage} 
        onInsert={handleInsertImage} 
      />
    </div>
  );
}

// --- INTERNAL COMPONENT: ADD IMAGE DIALOG ---
function AddImageDialog({ open, onOpenChange, onInsert }: { open: boolean, onOpenChange: (o: boolean) => void, onInsert: (html: string) => void }) {
    const [imageUrl, setImageUrl] = useState("");
    const [imageLink, setImageLink] = useState("");
    const [width, setWidth] = useState("600");
    const [align, setAlign] = useState("center");

    const handleSave = () => {
        if (!imageUrl) return;

        // 1. Build Image Tag
        let html = `<img src="${imageUrl}" width="${width}" style="max-width: 100%; height: auto;" alt="Newsletter Image" />`;

        // 2. Wrap in Link (if provided)
        if (imageLink) {
            html = `<a href="${imageLink}" target="_blank">${html}</a>`;
        }

        // 3. Wrap in Alignment Div
        html = `<div style="text-align: ${align}; margin: 20px 0;">${html}</div>`;

        onInsert(html);
        
        // Reset fields
        setImageUrl("");
        setImageLink("");
        setWidth("600");
        setAlign("center");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Insert Image</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Image URL <span className="text-red-500">*</span></Label>
                        <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Image Link (Optional)</Label>
                        <div className="flex items-center gap-2">
                            <LinkIcon className="w-4 h-4 text-muted-foreground" />
                            <Input value={imageLink} onChange={e => setImageLink(e.target.value)} placeholder="https://your-website.com" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Width (px)</Label>
                            <Input value={width} onChange={e => setWidth(e.target.value)} placeholder="600" />
                        </div>
                        <div className="space-y-2">
                            <Label>Alignment</Label>
                            <Select value={align} onValueChange={setAlign}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="left">Left</SelectItem>
                                    <SelectItem value="center">Center</SelectItem>
                                    <SelectItem value="right">Right</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={!imageUrl}>Insert HTML</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}