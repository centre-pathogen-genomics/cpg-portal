import { Monitor, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useTheme, type Theme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { portalUrl, setPortalUrl } from "../lib/portal"

/** This build's version, fixed for the window's lifetime. */
const appVersion = window.cpgRunner?.appVersion ?? ""

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { theme, setTheme } = useTheme()
  // The address being edited; reset to the live value whenever the dialog
  // opens, so a failed save never leaves a half-entered one.
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDraft(portalUrl())
    setError(null)
  }, [open])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      // The main process validates and remembers the address; the window's
      // mirror follows, so every link and fetch uses the new portal at once.
      await window.cpgRunner?.setPortalUrl(draft)
      setPortalUrl(draft)
      toast.success("Portal URL updated")
      onOpenChange(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            How the app looks, and which portal it reads tools from.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label>Appearance</Label>
            <RadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as Theme)}
              className="grid grid-cols-3 gap-2"
            >
              {THEMES.map((option) => {
                const Icon = option.icon
                const selected = theme === option.value
                return (
                  <Label
                    key={option.value}
                    htmlFor={`theme-${option.value}`}
                    className={cn(
                      "flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-normal",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-accent",
                    )}
                  >
                    <RadioGroupItem
                      id={`theme-${option.value}`}
                      value={option.value}
                      className="sr-only"
                    />
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </Label>
                )
              })}
            </RadioGroup>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="portal-url">Portal API URL</Label>
            <Input
              id="portal-url"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="https://portal.example.org"
              spellCheck={false}
              disabled={saving}
            />
            <p className="text-muted-foreground text-xs">
              The portal this app reads tools, packs and updates from. It must
              be a full http:// or https:// address.
            </p>
            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>
        </div>
        <DialogFooter className="items-center justify-between">
          <span className="text-muted-foreground text-xs">
            {appVersion ? `CPG Runner v${appVersion}` : "CPG Runner"}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={saving || draft.trim() === ""}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
