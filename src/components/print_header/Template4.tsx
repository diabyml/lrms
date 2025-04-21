// // src/components/print_header/Template4.tsx

// import React from "react";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Adjust path
// import { Separator } from "@/components/ui/separator"; // Adjust path
// import { ImageIcon } from "lucide-react";
// import { cn } from "@/lib/utils"; // Adjust path

// interface HeaderData {
//   logoUrl: string | null;
//   labName?: string | null;
//   addressLine1?: string | null;
//   addressLine2?: string | null;
//   cityPostalCode?: string | null;
//   phone?: string | null;
//   email?: string | null;
//   website?: string | null;
// }

// interface TemplateProps {
//   data: HeaderData;
//   isPreview?: boolean;
// }

// const Template4: React.FC<TemplateProps> = ({ data, isPreview }) => {
//   const {
//     logoUrl,
//     labName,
//     addressLine1,
//     addressLine2,
//     cityPostalCode,
//     phone,
//     email,
//     website,
//   } = data;

//   return (
//     <div
//       className={cn(
//         "flex items-center justify-between gap-6",
//         isPreview ? "p-4 border rounded-md bg-white min-h-[100px]" : ""
//       )}
//     >
//       {/* Left Side: Contact Info */}
//       <div className="text-xs text-muted-foreground space-y-0.5">
//         <p>{addressLine1 || "[Adresse Ligne 1]"}</p>
//         {addressLine2 && <p>{addressLine2}</p>}
//         <p>{cityPostalCode || "[Ville, CP]"}</p>
//         <Separator className="my-1" /> {/* Horizontal separator */}
//         {phone && <p>Tél : {phone}</p>}
//         {email && <p>{email}</p>}
//         {website && <p className="text-blue-600 hover:underline">{website}</p>}
//       </div>
//       {/* Vertical Separator */}
//       <Separator orientation="vertical" className="h-16" />{" "}
//       {/* Vertical Rule */}
//       {/* Right Side: Lab Name & Logo */}
//       <div className="flex flex-col items-end text-right gap-2">
//         <p className="font-bold text-lg">{labName || "[Nom Laboratoire]"}</p>
//         {/* Logo */}
//         <Avatar className="h-12 w-12 rounded-md border">
//           <AvatarImage
//             src={logoUrl || undefined}
//             alt="Logo"
//             className="object-contain p-0.5"
//           />{" "}
//           {/* Small padding */}
//           <AvatarFallback className="rounded-md bg-muted">
//             <ImageIcon className="h-6 w-6 text-muted-foreground" />
//           </AvatarFallback>
//         </Avatar>
//       </div>
//     </div>
//   );
// };

// export default Template4;

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

const Template3: React.FC<TemplateProps> = ({ data, isPreview }) => {
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
      className={`flex flex-col items-center text-center gap-2  ${
        isPreview ? "p-4 border rounded-md bg-white min-h-[100px]" : " "
      }`}
    >
      <div className=" template-heading-shadow w-full py-4 flex items-center justify-center flex-col border-slate-600 border-[1px] shadow-lg mb-2 rounded-[50%] ">
        {/* Logo */}
        <div className="mb-2">
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
        <div className="text-xs space-y-0.5">
          <p className="font-bold text-sm">{labName || "[Nom Laboratoire]"}</p>
          <p>{addressLine1 || "[Adresse Ligne 1]"}</p>
          {addressLine2 && <p>{addressLine2}</p>}
          {cityPostalCode && <p>{cityPostalCode}</p>}
          {/* <p>{cityPostalCode || "[Ville, CP]"}</p> */}
          <p>
            {phone && <span>Tél : {phone}</span>}
            {phone && email && <span> | </span>}
            {email && <span>Email : {email}</span>}
          </p>
          {website && <p>{website}</p>}
        </div>
      </div>
    </div>
  );
};

export default Template3;
