"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RealtimeBadge } from "@/components/shared/realtime-badge";
import { PaymentSimulatorModal } from "@/components/shared/payment-simulator-modal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Zap, LogOut, User, Shield, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    role: string;
  };
  onRefreshData?: () => void;
}

export function Header({ user, onRefreshData }: HeaderProps) {
  const router = useRouter();
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Logged out successfully");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Logout failed");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 backdrop-blur-md">
        {/* Left Side: Brand on mobile, Domain indicator on desktop */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs">
              L
            </div>
            <span className="font-bold text-slate-900 text-sm">Livka Pay</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-mono bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>payments.livka.in</span>
          </div>
        </div>

        {/* Right Side: Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Network Badge */}
          <RealtimeBadge onEvent={onRefreshData} />

          {/* Simulator Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSimulatorOpen(true)}
            className="gap-1.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <Zap className="h-3.5 w-3.5 fill-emerald-600 text-emerald-600" />
            <span className="hidden sm:inline">Payment Simulator</span>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 pr-2.5 text-left text-xs transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white font-semibold text-xs">
                  {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="font-medium text-slate-800 leading-none">
                    {user?.name || "Admin"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono leading-tight">
                    {user?.role || "OWNER"}
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="p-2 text-xs">
                <p className="font-semibold text-slate-900">{user?.name || "Administrator"}</p>
                <p className="text-slate-500 font-mono text-[11px] truncate">
                  {user?.email || "admin@livka.in"}
                </p>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded w-fit">
                  <Shield className="h-3 w-3" />
                  Role: {user?.role || "OWNER"}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/settings")}
                className="gap-2 text-xs"
              >
                <User className="h-3.5 w-3.5" />
                Settings & Team
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="gap-2 text-xs text-rose-600 focus:text-rose-600 focus:bg-rose-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Simulator Modal */}
      <PaymentSimulatorModal
        open={simulatorOpen}
        onOpenChange={setSimulatorOpen}
        onSuccess={onRefreshData}
      />
    </>
  );
}
