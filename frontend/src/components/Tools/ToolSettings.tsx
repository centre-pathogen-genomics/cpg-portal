import { FolderOpen, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** The settings a local run needs beyond the run form: where outputs go and
 * how the container may reach the computer. CPUs are chosen per run in the
 * shared form, like on the portal. */
export type ToolRunSettings = {
  output_dir: string
  network: boolean
  clean_work_dir: boolean
  overwrite_output: boolean
}

/**
 * A desktop tool's run settings: output folder, network access, and how the
 * container's work folder is handled. It is a controlled component: every
 * change calls `updateSettings` with the patch, so the host decides when to
 * save. The folder picker and "open" actions are injected because they need
 * the host's file dialogs; the fields themselves are host-agnostic.
 */
export function ToolSettings({
  settings,
  updateSettings,
  disabled = false,
  onPickDirectory,
  onOpenPath,
}: {
  settings: ToolRunSettings
  updateSettings: (patch: Partial<ToolRunSettings>) => void | Promise<void>
  disabled?: boolean
  onPickDirectory: (current: string) => Promise<string | null> | string | null
  onOpenPath: (path: string) => void
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor="runner-output">Output folder</Label>
          <p className="mt-1 text-sm text-foreground/70">
            Finished runs are copied here.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Input
            id="runner-output"
            readOnly
            value={settings.output_dir}
            title={settings.output_dir}
            className="h-9 w-56 font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                void Promise.resolve(onPickDirectory(settings.output_dir)).then(
                  (chosen) => {
                    if (chosen) updateSettings({ output_dir: chosen })
                  },
                )
              }}
            >
              Browse…
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onOpenPath(settings.output_dir)}
            >
              <FolderOpen />
              Open
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor="runner-network">Allow network access</Label>
          <p className="mt-1 text-sm text-foreground/70">
            Turn this off for tools that must run offline.
          </p>
        </div>
        <Switch
          id="runner-network"
          checked={settings.network}
          disabled={disabled}
          onCheckedChange={(checked) =>
            updateSettings({ network: checked === true })
          }
        />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="runner-clean-work">Clean up work folder</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="About cleaning up the work folder"
                  className="text-muted-foreground inline-flex size-4 shrink-0 items-center justify-center"
                >
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                The .cpg_work folder is deleted once its outputs are copied.
                Keep it to inspect the files a run left behind.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-1 text-sm text-foreground/70">
            Delete the run&#39;s temporary work folder.
          </p>
        </div>
        <Switch
          id="runner-clean-work"
          checked={settings.clean_work_dir}
          disabled={disabled}
          onCheckedChange={(checked) =>
            updateSettings({ clean_work_dir: checked === true })
          }
        />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="runner-overwrite-output">
              Overwrite existing folder
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="About overwriting the output folder"
                  className="text-muted-foreground inline-flex size-4 shrink-0 items-center justify-center"
                >
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Only applies to named runs; unnamed runs always create a new
                folder.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-1 text-sm text-foreground/70">
            Replace an existing output folder.
          </p>
        </div>
        <Switch
          id="runner-overwrite-output"
          checked={settings.overwrite_output}
          disabled={disabled}
          onCheckedChange={(checked) =>
            updateSettings({ overwrite_output: checked === true })
          }
        />
      </div>
    </>
  )
}
