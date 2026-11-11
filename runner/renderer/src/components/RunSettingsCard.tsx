import { FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "../contracts";
import { openPath, pickDirectory } from "../lib/desktop";

/**
 * The settings a local run needs beyond the run form: where outputs go and
 * whether the container may reach the network. CPUs are chosen per run in the
 * shared form, like on the portal.
 */
export function RunSettingsCard({
  settings,
  disabled,
  onSave,
}: {
  settings: Settings;
  disabled: boolean;
  onSave: (settings: Settings) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  async function save() {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="grid gap-4 pt-6">
        <div className="grid gap-2">
          <Label htmlFor="runner-output">Output folder</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="runner-output"
              readOnly
              value={draft.output_dir}
              className="w-full min-w-0 font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => {
                void pickDirectory(draft.output_dir).then((chosen) => {
                  if (chosen) setDraft({ ...draft, output_dir: chosen });
                });
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
  );
}
