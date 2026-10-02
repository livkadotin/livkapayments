"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  ShoppingBag,
  Link as LinkIcon,
  QrCode,
  RotateCcw,
  Globe,
  Users,
  BarChart3,
  Code2,
  Settings,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Payments", href: "/dashboard/payments", icon: CreditCard },
  { name: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
  { name: "Payment Links", href: "/dashboard/payment-links", icon: LinkIcon },
  { name: "QR Payments", href: "/dashboard/qr", icon: QrCode },
  { name: "Refunds", href: "/dashboard/refunds", icon: RotateCcw },
  { name: "Websites", href: "/dashboard/websites", icon: Globe, highlight: true },
  { name: "Customers", href: "/dashboard/customers", icon: Users },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Developers", href: "/dashboard/developers", icon: Code2 },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-40 bg-white border-r border-slate-200/80">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-slate-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-sm shadow-emerald-500/20 font-bold text-lg">
          L
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900 tracking-tight text-base">Livka</span>
            <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800 tracking-wide">
              PAY
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Central Infrastructure</span>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 flex flex-col justify-between overflow-y-auto px-3 py-4">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-emerald-50 text-emerald-800 font-semibold shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive ? "text-emerald-700" : "text-slate-400 group-hover:text-slate-600"
                  )}
                />
                <span className="flex-1">{item.name}</span>
                {item.highlight && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Multi-Tenant
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-100 px-3 space-y-2">
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Razorpay Connected</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 leading-tight">
              One central account routing to all connected websites.
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>Livka Pay v1.0</span>
            <a
              href="https://livka.in"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-slate-600 transition-colors"
            >
              Main Site <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
