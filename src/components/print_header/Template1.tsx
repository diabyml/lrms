// src/components/print_header/Template1.tsx (Example: Logo Left, Details Right)

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageIcon } from "lucide-react";

interface HeaderData {
  logoUrl: string | null;
  labName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  cityPostalCode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

interface TemplateProps {
  data: HeaderData;
  isPreview?: boolean; // Flag for potential minor style adjustments in preview mode
}

const Template1: React.FC<TemplateProps> = ({ data, isPreview }) => {
  const {
    logoUrl,
    labName,
    addressLine1,
    addressLine2,
    cityPostalCode,
    phone,
    email,
    website,
  } = data;

  return (
    <div
      className={`flex items-start justify-between gap-4 ${
        isPreview ? "p-4 border rounded-md bg-white min-h-[100px]" : ""
      }`}
    >
      {/* Logo */}
      <div className="w-1/4 flex-shrink-0">
        <Avatar className="h-16 w-16 rounded-md border">
          <AvatarImage
            src={logoUrl || undefined}
            alt="Logo"
            className="object-contain"
          />
          <AvatarFallback className="rounded-md bg-muted">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
      </div>
      {/* Lab Details */}
      <div className="w-3/4 text-xs text-right space-y-0.5">
        <p className="font-bold text-sm">{labName || "[Nom Laboratoire]"}</p>
        <p>{addressLine1 || "[Adresse Ligne 1]"}</p>
        {addressLine2 && <p>{addressLine2}</p>}
        <p>{cityPostalCode || "[Ville, CP]"}</p>
        {phone && <p>Tél : {phone}</p>}
        {email && <p>Email : {email}</p>}
        {website && <p>{website}</p>}
      </div>
    </div>
  );
};

export default Template1;
