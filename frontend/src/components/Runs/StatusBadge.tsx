import { LoaderCircle } from "lucide-react";
import { HiCheckCircle, HiXCircle } from "react-icons/hi";
import { MdCancel, MdSchedule } from "react-icons/md";
import { cn } from "@/lib/utils";
import type { RunStatus } from "../../client";

const styles: Record<RunStatus, string> = {
  running: "border-blue-500 text-blue-600",
  failed: "border-red-500 text-red-500",
  completed: "border-green-500 text-green-600",
  pending: "border-purple-500 text-purple-600",
  cancelled: "border-gray-500 text-gray-500",
};

const icons: Record<RunStatus, React.ReactNode> = {
  running: <LoaderCircle className="size-[0.9em] animate-spin" />,
  failed: <HiXCircle className="size-[0.95em]" />,
  completed: <HiCheckCircle className="size-[0.95em]" />,
  pending: <MdSchedule className="size-[0.95em]" />,
  cancelled: <MdCancel className="size-[0.95em]" />,
};

/**
 * Just the status icon, for the compact list view, where the label would take
 * the room the details need. The title and the accessible name keep the status
 * itself readable.
 */
export function StatusIcon({
  status,
  className,
}: {
  status: RunStatus;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center", styles[status], className)}
      title={status}
      aria-label={status}
    >
      {icons[status]}
    </span>
  );
}

function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1 py-1 text-xs font-bold uppercase rounded",
        styles[status],
      )}
    >
      {icons[status]}
      {status}
    </span>
  );
}

export default StatusBadge;
