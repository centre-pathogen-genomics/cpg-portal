import { FolderOpen } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { openPath, pickDirectory } from "../lib/desktop"
import type { Settings, ToolConfig } from "../contracts"

export function RunSettingsCard({
  tool,
  settings,
  disabled,
  onSave,
}: {
  tool: ToolConfig
  settings: Settings
  disabled: boolean
  onSave: (settings: Settings) => Promise<void>
}) {
  const [draft, setDraft] = useState<Settings>(settings)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const minCpus = tool.min_cpus || 1
  const maxCpus = tool.max_cpus ?? 1024

  async function save() {
    setSaving(true)
    try {
      await onSave(draft)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run settings</CardTitle>
        <CardDescription>
          Kept on this computer and reused for every run.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="runner-cpus">CPUs</Label>
          <Input
            id="runner-cpus"
            type="number"
            min={minCpus}
            max={maxCpus}
            disabled={disabled}
            value={draft.cpus}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10)
              if (Number.isNaN(next) || next < 1) return
              setDraft({ ...draft, cpus: next })
            }}
          />
          <p className="text-muted-foreground text-xs">
            {maxCpus === 1024
              ? `This tool needs at least ${minCpus} CPUs.`
              : `This tool allows ${minCpus}-${maxCpus} CPUs.`}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="runner-output">Output folder</Label>
          <div className="flex gap-2">
            <Input
              id="runner-output"
              readOnly
              value={draft.output_dir}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => {
                void pickDirectory(draft.output_dir).then((chosen) => {
                  if (chosen) setDraft({ ...draft, output_dir: chosen })
                })
              }}
            >
              Browse…
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => openPath(draft.output_dir)}
            >
              <FolderOpen />
              Open
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="runner-network">Allow network access</Label>
            <p className="text-muted-foreground text-xs">
              Turn this off for tools that must run offline.
            </p>
          </div>
          <Switch
            id="runner-network"
            checked={draft.network}
            disabled={disabled}
            onCheckedChange={(checked) =>
              setDraft({ ...draft, network: checked === true })
            }
          />
        </div>

        <div>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
