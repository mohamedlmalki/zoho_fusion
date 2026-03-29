import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Field {
  api_name: string;
  field_label: string;
  data_type: string;
}

interface SmartTextSplitterProps {
  fields: Field[]; 
  onSplitValues: (updatedFields: Record<string, string>) => void; 
}

export function SmartTextSplitter({ fields, onSplitValues }: SmartTextSplitterProps) {
  const [bigText, setBigText] = useState("");

  // Find all multiline fields (textareas)
  const multilineFields = fields.filter(field => field.data_type === 'multiline');

  const handleSplitText = () => {
    if (multilineFields.length === 0) {
      alert("No multiline fields found in this form!");
      return;
    }

    if (!bigText) return;

    // Calculate characters per input to divide perfectly
    const numFields = multilineFields.length;
    const totalLength = bigText.length;
    const chunkSize = Math.ceil(totalLength / numFields); 

    const newFieldValues: Record<string, string> = {};

    // Split the text perfectly and assign to the right field API names
    for (let i = 0; i < numFields; i++) {
      const fieldApiName = multilineFields[i].api_name;
      const startIndex = i * chunkSize;
      const endIndex = startIndex + chunkSize;
      newFieldValues[fieldApiName] = bigText.substring(startIndex, endIndex);
    }

    onSplitValues(newFieldValues);
    setBigText(""); // Clear the box after splitting
    alert(`Success! Split ${totalLength} characters perfectly across ${numFields} fields.`);
  };

  return (
    <div className="p-4 mb-6 border rounded-lg bg-slate-50 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-800">Smart Text Splitter</h3>
        <p className="text-xs text-slate-500">
          Paste your large text/code here. It will automatically split into equal parts across the <strong>{multilineFields.length}</strong> available multiline fields.
        </p>
      </div>

      <Textarea 
        placeholder="Paste your giant block of text or code here..."
        value={bigText}
        onChange={(e) => setBigText(e.target.value)}
        className="min-h-[120px] bg-white"
      />

      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-500">
          Total Characters: {bigText.length} 
          {bigText.length > 0 && multilineFields.length > 0 && (
            <span className="ml-2 text-blue-600">
              (~{Math.ceil(bigText.length / multilineFields.length)} characters per field)
            </span>
          )}
        </div>
        <Button 
          type="button" 
          variant="default" 
          onClick={handleSplitText}
          disabled={multilineFields.length === 0 || bigText.length === 0}
        >
          Split & Fill Fields
        </Button>
      </div>
    </div>
  );
}