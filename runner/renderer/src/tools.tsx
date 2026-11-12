import { FileUp, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import cpgLogo from "./assets/cpg-logo.png";
import { PortalToolDialog } from "./components/PortalToolDialog";
import { PortalToolSearch } from "./components/PortalToolSearch";
import { ToolSidebar } from "./components/ToolSidebar";
import { filePathOf, openExternal } from "./lib/desktop";
import { portalUrl } from "./lib/portal";

type ToolEntry = {
  id: string;
  name: string;
  version: string;
  description: string | null;
};

const PACK_EXTENSION = ".cpgpack";

function packPaths(files: FileList | File[]): string[] {
  return Array.from(files)
    .filter((file) => file.name.toLowerCase().endsWith(PACK_EXTENSION))
    .map(filePathOf)
    .filter((target) => target.length > 0);
}

const STEPS = [
  "Add a tool from the portal, or open a .cpgpack you were given.",
  "Install its environment once; later runs start straight away.",
  "Choose input files and run. Outputs are copied to your output folder.",
];

/**
 * What the window shows before a tool is open: on a first run, the way to get
 * one — the portal's search and a pack — with what the app does. Choosing a
 * tool afterwards happens in the sidebar.
 */
export function ToolsPage() {
  const bridge = window.cpgRunner;
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [portalTarget, setPortalTarget] = useState<{
    name: string;
    version: string;
  } | null>(null);
  const firstRun = tools.length === 0;
  const portal = portalUrl();

  const refresh = async () => {
    if (bridge) setTools(await bridge.tools());
  };

  useEffect(() => {
    // The bridge is fixed for the window's lifetime.
    void window.cpgRunner?.tools().then(setTools);
  }, []);

  const importPacks = async (load: () => Promise<ToolEntry[]>) => {
    if (!bridge) return;
    setBusy(true);
    try {
      const added = await load();
      if (added.length > 0) await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const importDropped = (files: FileList) => {
    const paths = packPaths(files);
    if (paths.length === 0) {
      toast.error("Drop a .cpgpack file exported from a tool page");
      return;
    }
    if (bridge) void importPacks(() => bridge.importPackPaths(paths));
  };

  return (
    <div className="flex h-full">
      <ToolSidebar activeToolId={null} />

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-2xl">
          <img src={cpgLogo} alt="CPG" className="mb-6 h-16 w-auto" />

          <h1 className="text-3xl font-bold">
            {firstRun ? "Add your first tool to get started" : "Choose a tool"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {firstRun
              ? "Tools from the CPG portal run on this computer. Input files never leave it; the portal supplies the tool definitions and the runtime image."
              : "Pick a tool in the sidebar to run it here, or add another one."}
          </p>

          {firstRun && (
            <div className="mt-8 grid gap-8">
              <section>
                <h2 className="mb-3 text-sm font-semibold">
                  Search the CPG portal
                </h2>
                <PortalToolSearch onPick={setPortalTarget} />
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold">Or add a pack</h2>
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-4",
                    dragging && "border-primary bg-muted",
                  )}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    importDropped(event.dataTransfer.files);
                  }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !bridge}
                    onClick={() =>
                      bridge && void importPacks(() => bridge.importPacks())
                    }
                  >
                    {busy ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <FileUp />
                    )}
                    {busy ? "Reading the pack…" : "Add tool from file system"}
                  </Button>
                  <p className="text-muted-foreground text-xs">
                    {busy
                      ? "Reading the pack and starting its runner…"
                      : "or drop a .cpgpack here"}
                  </p>
                </div>
              </section>
            </div>
          )}

          <section className="mt-10">
            <h2 className="mb-3 text-sm font-semibold">How it works</h2>
            <ol className="text-muted-foreground grid gap-2 text-sm">
              {STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="bg-muted text-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="text-muted-foreground mt-4 text-xs">
              Everything runs in a container on this computer. The portal is
              only read when a tool is added.
            </p>
            <Button
              type="button"
              variant="link"
              className="mt-1 h-auto p-0 text-xs"
              onClick={() => openExternal(portal)}
            >
              Browse the CPG portal
            </Button>
          </section>
        </div>

        <PortalToolDialog
          target={portalTarget}
          installed={tools}
          onOpenChange={(open) => {
            if (!open) setPortalTarget(null);
          }}
          onAdded={() => void refresh()}
        />
      </main>
    </div>
  );
}
