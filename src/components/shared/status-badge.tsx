import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = (status || "").toUpperCase();

  switch (normalized) {
    case "PAID":
    case "CAPTURED":
    case "ACTIVE":
    case "PROCESSED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60",
            className
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {normalized}
        </span>
      );

    case "PENDING":
    case "CREATED":
    case "AUTHORIZED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60",
            className
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {normalized}
        </span>
      );

    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/60",
            className
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
          {normalized.replace("_", " ")}
        </span>
      );

    case "FAILED":
    case "CANCELLED":
    case "EXPIRED":
    case "REVOKED":
    case "INACTIVE":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60",
            className
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          {normalized}
        </span>
      );

    default:
      return (
        <Badge variant="outline" className={className}>
          {status}
        </Badge>
      );
  }
}
