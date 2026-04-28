import { Link, useLocation } from "wouter";
import { LayoutDashboard, History, Settings, Users, TrendingUp, LogOut, ChevronDown, Target, BarChart2, ClipboardList } from "lucide-react";
import { Button } from "./ui/button";
import { useAgencyUser } from "@/hooks/useAgencyUser";
import { useClerk, useUser } from "@clerk/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useBranding } from "@/contexts/branding";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isAdmin } = useAgencyUser();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { brandName, brandColor, logoUrl } = useBranding();

  const navigation = [
    { name: "Current Week", href: "/dashboard", icon: LayoutDashboard, adminOnly: false },
    { name: "Past Reports", href: "/history", icon: History, adminOnly: false },
    { name: "Leads", href: "/leads", icon: Target, adminOnly: false },
    { name: "Medicare Analytics", href: "/metrics", icon: BarChart2, adminOnly: false },
    { name: "Sales", href: "/admin-sales", icon: ClipboardList, adminOnly: true },
    { name: "Team", href: "/team", icon: Users, adminOnly: true },
    { name: "Settings", href: "/settings", icon: Settings, adminOnly: false },
  ].filter((item) => !item.adminOnly || isAdmin);

  const isActive = (href: string) => location === href;

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.emailAddresses?.[0]?.emailAddress?.charAt(0).toUpperCase() ?? "?";

  const displayName = user?.fullName || user?.emailAddresses?.[0]?.emailAddress || "Agent";
  const agencyShortName = brandName.split(" ").slice(0, 2).join(" ");

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col md:flex-row">
      {/* Mobile Nav */}
      <div className="md:hidden border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="h-9 w-auto object-contain max-w-[160px]" />
          ) : (
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary-foreground" />
            </div>
          )}
          <div className="font-semibold text-base text-foreground tracking-tight">{agencyShortName}</div>
        </div>
        <div className="flex gap-1.5">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive(item.href) ? "default" : "ghost"}
                size="sm"
                className="gap-1.5"
              >
                <item.icon className="w-4 h-4" />
                <span className="sr-only sm:not-sr-only text-xs">{item.name}</span>
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 flex-col text-slate-100" style={{ backgroundColor: "var(--panel-bg, #0f172a)" }}>
        <div className="h-16 flex items-center px-4 border-b border-white/10">
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="h-[45px] w-auto object-contain max-w-[220px]" />
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: brandColor }}
              >
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-white text-sm leading-none">{agencyShortName}</div>
                <div className="text-xs text-white/50 mt-0.5">Insurance Agency</div>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm ${
                    active
                      ? "text-white font-medium"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                  style={active ? { backgroundColor: brandColor } : undefined}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="px-3 py-4 border-t border-white/10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors text-left">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="text-white text-xs font-semibold" style={{ backgroundColor: brandColor }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-100 truncate">{displayName}</div>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 border-0 font-normal mt-0.5 bg-white/10 text-slate-300"
                  >
                    {isAdmin ? "Admin" : "Agent"}
                  </Badge>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-48">
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => signOut({ redirectUrl: "/" })}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full min-w-0 p-4 md:p-8 overflow-x-auto">
        {children}
      </main>
    </div>
  );
}
