// src/components/settings/HeaderTemplateSelector.tsx

import React from "react";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

// Import your template components
import Template1 from "@/components/print_header/Template1";
import Template2 from "@/components/print_header/Template2";
// Import other templates...

export interface HeaderTemplateOption {
  id: string; // e.g., 'template1'
  name: string; // e.g., 'Classique (Logo à Gauche)'
  component: React.FC<any>; // The actual template component
}

interface HeaderTemplateSelectorProps {
  templates: HeaderTemplateOption[];
  selectedTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  disabled?: boolean;
}

// Dummy data for previews (keep minimal)
const previewData = {
  logoUrl: null, // Or a placeholder image URL
  labName: "Laboratoire XYZ",
  addressLine1: "123 Rue Principale",
  cityPostalCode: "75001 Paris",
  phone: "01 23 45 67 89",
};

const HeaderTemplateSelector: React.FC<HeaderTemplateSelectorProps> = ({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  disabled = false,
}) => {
  return (
    <RadioGroup
      value={selectedTemplateId}
      onValueChange={onSelectTemplate}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      disabled={disabled}
    >
      {templates.map((template) => (
        <Label
          key={template.id}
          htmlFor={template.id}
          className={cn(
            "border-2 rounded-lg p-4 flex flex-col items-center gap-4 cursor-pointer transition-colors hover:border-primary/80",
            selectedTemplateId === template.id &&
              "border-primary ring-2 ring-primary ring-offset-2",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <RadioGroupItem
            value={template.id}
            id={template.id}
            className="sr-only"
          />
          <span className="font-medium text-sm text-center">
            {template.name}
          </span>
          {/* Miniature Preview */}
          <Card className="w-full scale-75 origin-top border-dashed">
            {" "}
            {/* Scale down for preview */}
            <CardContent className="p-2">
              {/* Render the actual template component with preview data */}
              <template.component data={previewData} isPreview={true} />
            </CardContent>
          </Card>
        </Label>
      ))}
    </RadioGroup>
  );
};

export default HeaderTemplateSelector;
