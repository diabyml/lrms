// src/components/layout/MainLayout.tsx
import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom"; // Use NavLink for active styling
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";

import { CreateDoctorDialog } from "@/components/app/doctors/CreateDoctorDialog"; // Adjust path

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
import {
  ClipboardList,
  FlaskConical,
  Layers, // Test Types Icon
  LogOut, // User profile icon
  Menu, // Patients Icon
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Stethoscope, // App Logo Icon
  Users,
  Banknote,
  Wallet,
  BarChart,
  ShieldCheck,
  ReceiptText,
  Bell,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

import { Settings, FileText } from "lucide-react"; // Example icons
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const SIDEBAR_STORAGE_KEY = "lrms-sidebar-collapsed";

const navSections: NavSection[] = [
  {
    label: "Principal",
    items: [
      { to: "/patients", label: "Patients", icon: Users },
      { to: "/factures", label: "Factures", icon: ReceiptText },
      { to: "/ristournes", label: "Ristournes", icon: Banknote },
      { to: "/bilan-amo", label: "Bilan AMO", icon: ShieldCheck },
      { to: "/doctors", label: "Médecins", icon: Stethoscope },
      { to: "/stats", label: "Statistiques", icon: BarChart },
    ],
  },
  {
    label: "Facturation",
    items: [
      {
        to: "/patient-ristourne-search",
        label: "Recherche Ristournes",
        icon: Banknote,
      },
      {
        to: "/results-prices",
        label: "Bilans - Prix - Restants",
        icon: Layers,
      },
      { to: "/gestion-depenses", label: "Suivi des dépenses", icon: Wallet },
    ],
  },
  {
    label: "Laboratoire",
    items: [
      { to: "/test-types", label: "Types de Tests", icon: ClipboardList },
      { to: "/test-profiles", label: "Profils de Tests", icon: ClipboardList },
      { to: "/categories", label: "Catégories", icon: Layers },
      { to: "/atbs", label: "Gestion ATBs", icon: Layers },
      {
        to: "/pending-tests",
        label: "Examens en cours",
        icon: ListChecks,
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        to: "/settings/print-header",
        label: "En-tête Impression",
        icon: FileText,
      },
      {
        to: "/settings/invoice-ai",
        label: "IA Factures",
        icon: Sparkles,
      },
      {
        to: "/skip-range-management",
        label: "Paramètres Validations",
        icon: Settings,
      },
      { to: "/ecb-models", label: "Modèles ECB", icon: Layers },
      {
        to: "/hemoculture-models",
        label: "Modèles Hémoculture",
        icon: Layers,
      },
      {
        to: "/antibiotique-models",
        label: "Modèles Antibiotiques",
        icon: Layers,
      },
      { to: "/abbreviations", label: "Abbreviations", icon: Layers },
    ],
  },
];

const MainLayout: React.FC = () => {
  const { user } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  });

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Erreur de déconnexion:", error);
    }
    // Auth listener handles navigation implicitly
  };

  const navigate = useNavigate();

  // Pending tests count for bell badge
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    const fetchPendingCount = async () => {
      const { count } = await supabase
        .from("patient_result")
        .select("*", { count: "exact", head: true })
        .ilike("description", "%en cours%");
      setPendingCount(count ?? 0);
    };
    fetchPendingCount();

    const interval = setInterval(fetchPendingCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // Function to get user initials for Avatar fallback
  const getInitials = (email?: string | null) => {
    return email ? email.substring(0, 2).toUpperCase() : "??";
  };

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      String(isSidebarCollapsed)
    );
  }, [isSidebarCollapsed]);

  const SidebarNav = ({
    collapsed,
    mobile = false,
  }: {
    collapsed: boolean;
    mobile?: boolean;
  }) => (
    <nav
      className={`flex flex-col gap-5 py-4 ${
        collapsed && !mobile ? "px-2" : "px-3"
      }`}
    >
      {navSections.map((section) => (
        <div key={section.label} className="space-y-1">
          {(!collapsed || mobile) && (
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label}
            </div>
          )}
          <div className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              const navLink = (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      "group flex h-10 items-center rounded-md text-sm font-medium transition-colors",
                      collapsed && !mobile
                        ? "justify-center px-0"
                        : "gap-3 px-3",
                      isActive
                        ? collapsed && !mobile
                          ? "bg-accent text-black ring-1 ring-border"
                          : "bg-primary text-primary-foreground shadow-sm"
                        : collapsed && !mobile
                          ? "text-black hover:bg-accent hover:text-black"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    ].join(" ")
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`h-5 w-5 shrink-0 opacity-100 ${
                          collapsed && !mobile ? "stroke-[2.75]" : ""
                        }`}
                        style={
                          collapsed && !mobile
                            ? {
                                color: "#111827",
                                stroke: "#111827",
                              }
                            : undefined
                        }
                      />
                      {(!collapsed || mobile) && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </>
                  )}
                </NavLink>
              );

              if (!collapsed || mobile) return navLink;

              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const [isCreateDoctorDialogOpen, setIsCreateDoctorDialogOpen] =
    useState(false);

  const handleDoctorCreated = () => {
    console.log("Doctor created successfully!");
    // Option 1: Reload the window as requested
    window.location.reload();

    // Option 2: Or, if you have a local state for doctors, re-fetch them
    // fetchDoctorsList();
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full bg-muted/40 overflow-hidden">
      {/* Sidebar (Desktop) - Hidden on smaller screens */}
      <aside
        className={`hidden shrink-0 flex-col border-r bg-background transition-[width] duration-300 sm:flex ${
          isSidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div
          className={`relative flex h-16 items-center border-b px-3 ${
            isSidebarCollapsed ? "justify-center" : "justify-between gap-2"
          }`}
        >
          <div
            className={`flex min-w-0 items-center ${
              isSidebarCollapsed ? "justify-center" : "gap-2"
            }`}
          >
            <FlaskConical className="h-6 w-6 shrink-0 text-primary" />
            {!isSidebarCollapsed && (
              <span className="truncate font-semibold tracking-tight">LRMS</span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={
              isSidebarCollapsed
                ? "absolute -right-4 h-8 w-8 border bg-background shadow-sm hover:bg-accent"
                : "h-8 w-8"
            }
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            aria-label={
              isSidebarCollapsed
                ? "Développer la barre latérale"
                : "Réduire la barre latérale"
            }
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SidebarNav collapsed={isSidebarCollapsed} />
        </div>
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
              <SheetContent side="left" className="w-72 p-0 pt-10">
                <SidebarNav collapsed={false} mobile />
              </SheetContent>
            </Sheet>
          </div>

          {/* Placeholder for potential breadcrumbs or search bar */}
          <div className="flex-1 justify-between">
            <div></div>
            <Button
              onClick={() => setIsCreateDoctorDialogOpen(true)}
              className="ml-auto"
              variant={"default"}
            >
              Ajouter un Médecin
            </Button>
          </div>

          {/* Pending Tests Bell */}
          <Button
            variant="ghost"
            size="icon"
            className="relative mr-2"
            onClick={() => navigate("/pending-tests")}
            title="Examens en cours"
          >
            <Bell className="h-5 w-5" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </Button>

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
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 bg-white">
            <Outlet />
          </main>
      </div>

      <CreateDoctorDialog
        open={isCreateDoctorDialogOpen}
        onOpenChange={setIsCreateDoctorDialogOpen}
        onDoctorCreated={handleDoctorCreated}
      />
    </div>
    </TooltipProvider>
  );
};

export default MainLayout;
