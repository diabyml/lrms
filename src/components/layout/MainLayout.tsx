// src/components/layout/MainLayout.tsx
import React from "react";
import { NavLink, Outlet } from "react-router-dom"; // Use NavLink for active styling
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";

// Import shadcn/ui components and icons
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"; // For mobile menu
import { TooltipProvider } from "@/components/ui/tooltip"; // For icon-only sidebar option later
import {
  ClipboardList,
  FlaskConical,
  Layers, // Test Types Icon
  LogOut, // User profile icon
  Menu, // Patients Icon
  Stethoscope, // App Logo Icon
  Users,
  Banknote,
} from "lucide-react";

import { Settings, FileText } from "lucide-react"; // Example icons

const MainLayout: React.FC = () => {
  const { user } = useAuth();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Erreur de déconnexion:", error);
    }
    // Auth listener handles navigation implicitly
  };

  // Function to get user initials for Avatar fallback
  const getInitials = (email?: string | null) => {
    return email ? email.substring(0, 2).toUpperCase() : "??";
  };

  // Define navigation items
  const navItems = [
    { to: "/patients", label: "Patients", icon: Users },
    { to: "/doctors", label: "Médecins", icon: Stethoscope }, // Doctors in French
    { to: "/test-types", label: "Types de Tests", icon: ClipboardList }, // Test Types in French
    { to: "/categories", label: "Catégories", icon: Layers }, // Add this item
    { to: "/ristournes", label: "Ristournes", icon: Banknote }, // Add ristourne management
    {
      to: "/settings/print-header",
      label: "En-tête Impression",
      icon: FileText,
    },
    {
      to: "/skip-range-management",
      label: "Parametres Validations",
      icon: Settings,
    },
    // ECB Model Management
    {
      to: "/ecb-models",
      label: "Modèles ECB",
      icon: Layers,
    },
    {
      to: "/atbs",
      label: "Gestion ATBs",
      icon: Layers,
    },
    // Add other main navigation items here
  ];

  // Sidebar content, reusable for desktop and mobile sheet
  const sidebarContent = (
    <nav className="flex flex-col gap-2 px-2 sm:px-4 py-4">
      {/* Use NavLink for automatic active class styling */}
      {navItems.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          // Use a function to conditionally apply classes based on `isActive`
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground" // Active state style
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground" // Inactive state style
            }`
          }
          // Optionally end prop if you only want exact matches
          // end
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen w-full bg-muted/40">
      {/* Sidebar (Desktop) - Hidden on smaller screens */}
      <aside className="hidden sm:flex flex-col w-64 border-r bg-background">
        <div className="flex items-center gap-2 h-16 border-b px-6">
          <FlaskConical className="h-6 w-6 text-primary" />
          <span className="font-semibold tracking-tight">LRMS</span>
        </div>
        {sidebarContent}
        {/* Optional: Add footer or other sidebar elements here */}
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
          {/* Mobile Menu Button */}
          <div className="sm:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Ouvrir le menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 pt-10">
                {" "}
                {/* Adjust padding */}
                {/* Reuse sidebar content inside the mobile sheet */}
                {sidebarContent}
              </SheetContent>
            </Sheet>
          </div>

          {/* Placeholder for potential breadcrumbs or search bar */}
          <div className="flex-1"></div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full"
              >
                <Avatar className="h-9 w-9">
                  {/* Add AvatarImage if you store user profile picture URLs */}
                  {/* <AvatarImage src={user?.user_metadata?.avatar_url} alt="Avatar" /> */}
                  <AvatarFallback>{getInitials(user?.email)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Connecté en tant que
                  </p>
                  <p className="text-xs leading-none text-muted-foreground truncate">
                    {user?.email || "Utilisateur"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* Optional: Add link to profile/settings page here later */}
              {/* <DropdownMenuItem>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Profil</span>
                </DropdownMenuItem> */}
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Se déconnecter</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content - Outlet renders the matched child route */}
        {/* Added TooltipProvider required by shadcn Tooltip */}
        <TooltipProvider>
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 bg-white">
            <Outlet />
          </main>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default MainLayout;
