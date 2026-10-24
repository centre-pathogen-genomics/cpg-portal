import { useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RunPublic } from "../../client";

/** Opens the tool's run form prefilled with what this run used. */
export default function RerunRunButton({ run }: { run: RunPublic }) {
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label="Rerun this run"
      onClick={() =>
        navigate({
          to: "/tools/$name",
          params: { name: run.tool.name },
          search: { rerun: run.id },
          resetScroll: true,
        })
      }
    >
      <RotateCcw className="size-4" />
      Rerun
    </Button>
  );
}
