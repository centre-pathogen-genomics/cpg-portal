import {
  EllipsisVertical,
  ExternalLink,
  Download,
  FolderOpen,
  LoaderCircle,
  Trash2,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import RenderMarkdown from "@/components/Common/Markdown";
import ToolRunForm from "@/components/Tools/ToolRunForm";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, api, errorMessage, onApiBaseChange } from "./api";
import { DockerSetupDialog } from "./components/DockerSetupDialog";
import { InstallDialog } from "./components/InstallDialog";
import { LocalFilePicker } from "./components/LocalFilePicker";
import { ToolBadges } from "./components/ToolBadges";
import { ToolHeading } from "./components/ToolHeading";
import { placeholderImage, useToolImages } from "./components/ToolImage";
import { ToolSidebar } from "./components/ToolSidebar";
import {
  currentInstallState,
  type DoctorReport,
  type FileTypesMap,
  type RunRecord,
  type Settings,
  type StatusPayload,
  type ToolConfig,
  type ToolPayload,
  unwrapTool,
} from "./contracts";
import { openExternal, openPath, pickDirectory } from "./lib/desktop";
import { portalToolUrl } from "./lib/portal";
import { navigate } from "./router";

const FIELD_ERROR =
  /^(?:Missing required parameter|Invalid value for parameter): (.+)$/;

export function ToolPage() {
  const [tool, setTool] = useState<ToolConfig | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [fileTypes, setFileTypes] = useState<FileTypesMap>({});
  const [forcedDoctor, setForcedDoctor] = useState<DoctorReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [runName, setRunName] = useState("");
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const images = useToolImages();
  const [rerunRun, setRerunRun] = useState<RunRecord | null>(null);
  const [rerunChecked, setRerunChecked] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Answers for a tool the window has left must not overwrite the new one's.
  const loadSeq = useRef(0);

  const refreshStatus = useCallback(async () => {
    const next = await api.get<StatusPayload>("/status");
    setStatus(next);
    setForcedDoctor(null);
    return next;
  }, []);

  const loadAll = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const [toolPayload, statusPayload, settingsPayload, types] =
        await Promise.all([
          api.get<ToolPayload>("/tool"),
          api.get<StatusPayload>("/status"),
          api.get<Settings>("/settings"),
          api.get<FileTypesMap>("/file-types"),
        ]);
      if (seq !== loadSeq.current) return;
      const loadedTool = unwrapTool(toolPayload);
      setTool(loadedTool);
      setStatus(statusPayload);
      setSettings(settingsPayload);
      setFileTypes(types);
      setLoadError(null);
    } catch (error) {
      if (seq === loadSeq.current) setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Another tool's runner: reload its data, keeping the old one on screen
  // until the new one answers instead of blanking the page.
  useEffect(
    () =>
      onApiBaseChange(() => {
        setInstallDismissed(false);
        void loadAll();
      }),
    [loadAll],
  );

  // A rerun arrives as ?rerun=<run id>: its values prefill the form.
  useEffect(() => {
    const rerunId = new URLSearchParams(window.location.search).get("rerun");
    if (!rerunId) {
      setRerunChecked(true);
      return;
    }
    void api
      .get<RunRecord>(`/runs/${rerunId}`)
      .then((record) => setRerunRun(record))
      .catch(() => toast.error("Could not load the run to repeat"))
      .finally(() => setRerunChecked(true));
  }, []);

  const effectiveDoctor = forcedDoctor ?? status?.doctor ?? null;
  const doctorReady = effectiveDoctor?.ready === true;
  const installState = status ? currentInstallState(status) : null;
  const installOpen =
    !!status &&
    doctorReady &&
    installState !== "installed" &&
    !installDismissed;
  const shouldPoll = (status?.installing ?? false) || installOpen;

  useEffect(() => {
    if (!shouldPoll) return;
    const interval = setInterval(() => {
      void refreshStatus().catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [shouldPoll, refreshStatus]);

  const canRun = !!settings && doctorReady && installState === "installed";
  const needsInstall = !!status && doctorReady && installState !== "installed";

  const blockedReason = !doctorReady
    ? "Docker is not ready."
    : installState !== "installed"
      ? "The tool environment is not installed."
      : null;

  // Settings save as they change: there is nothing to confirm afterwards.
  async function updateSettings(patch: Partial<Settings>) {
    if (!settings) return;
    const previous = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await api.put("/settings", next);
    } catch (error) {
      setSettings(previous);
      toast.error(errorMessage(error));
    }
  }

  // The portal's run form drives a local run: files come from this computer,
  // and the run is created by the sidecar instead of the portal.
  async function submitLocally({
    params,
    cpus,
  }: {
    params: Record<string, unknown>;
    cpus: number;
  }) {
    try {
      const record = await api.post<RunRecord>("/runs", {
        params,
        cpus,
        name: runName.trim() || undefined,
      });
      navigate(`/run?id=${record.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const doctor = (error.payload as { doctor?: DoctorReport } | null)
          ?.doctor;
        if (doctor) setForcedDoctor(doctor);
        setInstallDismissed(false);
        void refreshStatus().catch(() => {});
      }
      const message = errorMessage(error);
      if (!FIELD_ERROR.test(message)) toast.error(message);
      throw error;
    }
  }

  function fieldError(error: unknown): Record<string, string> | null {
    const message = errorMessage(error);
    const field = FIELD_ERROR.exec(message);
    return field ? { [field[1]]: message } : null;
  }

  async function removeCurrent() {
    if (!tool) return;
    setRemoving(true);
    try {
      // The main process opens another tool, or the tool list.
      await window.cpgRunner?.removeTool?.(tool.id);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRemoving(false);
      setRemoveOpen(false);
    }
  }

  async function reinstall() {
    try {
      await api.delete("/install");
      setInstallDismissed(false);
      await refreshStatus();
      toast.success("Environment removed; install it again to run tools");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  // The sidebar is the app's frame: it stays while a tool's data loads or
  // fails, so switching tools never leaves an empty window behind.
  if (loadError) {
    return (
      <div className="flex h-full">
        <ToolSidebar activeToolId={null} />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8">
          <p className="text-destructive text-sm">{loadError}</p>
          <Button onClick={() => void loadAll()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!tool || !settings || !status) {
    return (
      <div className="flex h-full">
        <ToolSidebar activeToolId={null} />
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  // A run recorded by an older version has no file paths, only the names the
  // tool saw: those are not paths, so such files have to be picked again.
  const fileParamNames = new Set(
    tool.params
      .filter((param) => param.param_type === "file")
      .map((param) => param.name),
  );
  const rerunValues = rerunRun
    ? {
        ...Object.fromEntries(
          Object.entries(rerunRun.params ?? {}).filter(
            ([name]) => !fileParamNames.has(name),
          ),
        ),
        ...(rerunRun.param_files ?? {}),
      }
    : undefined;

  return (
    <div className="flex h-full">
      <ToolSidebar activeToolId={tool.id} />

      <ToolRunForm
        formKey={tool.id}
        params={tool.params}
        minCpus={tool.min_cpus}
        userMaxCpus={status.cpus_available}
        defaultCpus={settings.cpus}
        isDisabled={!canRun}
        submitLabel="Run locally"
        fillSubmit
        onSubmit={submitLocally}
        mapError={fieldError}
        initialValues={rerunValues}
        initialValuesReady={rerunChecked}
        initialThreads={rerunRun?.cpus ?? null}
        className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px]"
        renderFilePicker={({ param, values, onChange, disabled }) => (
          <LocalFilePicker
            param={param}
            values={values}
            fileTypes={fileTypes}
            disabled={disabled}
            onChange={onChange}
          />
        )}
        extras={
          <div>
            <Label htmlFor="CPG_RUNNER_RUN_NAME">Run name</Label>
            <p className="mb-2 text-muted-foreground text-xs">
              Optional, named automatically if left blank
            </p>
            <Input
              id="CPG_RUNNER_RUN_NAME"
              value={runName}
              disabled={!canRun}
              onChange={(event) => setRunName(event.target.value)}
            />
          </div>
        }
        renderShell={({ params, settings: settingsPanel, submit }) => (
          <>
            <div className="flex min-h-0 min-w-0 flex-col">
              <header className="shrink-0 px-8 py-4">
                <div className="mx-auto max-w-6xl">
                  <ToolHeading
                    image={images[tool.id] ?? placeholderImage(tool.name)}
                    name={tool.name}
                    version={tool.version}
                    badges={<ToolBadges tool={tool} />}
                  >
                    <div className="flex shrink-0 items-center gap-2">
                      {needsInstall && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setInstallDismissed(false)}
                        >
                          <Download />
                          Install
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground shrink-0"
                            aria-label="Tool actions"
                          >
                            <EllipsisVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem
                            onSelect={() =>
                              openExternal(portalToolUrl(tool.name))
                            }
                          >
                            <ExternalLink />
                            Open in The CPG Portal
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!doctorReady}
                            onSelect={() => void reinstall()}
                          >
                            <Wrench />
                            Reinstall environment
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setRemoveOpen(true)}
                          >
                            <Trash2 />
                            Remove tool
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </ToolHeading>
                  {tool.description && (
                    <div className="mt-2">
                      {descriptionOpen ? (
                        <>
                          <p className="text-sm">{tool.description}</p>
                          <button
                            type="button"
                            className="hover:text-primary mt-1 text-xs font-medium"
                            onClick={() => setDescriptionOpen(false)}
                          >
                            Show less
                          </button>
                        </>
                      ) : (
                        // One line: the text truncates and the way to expand
                        // it sits at its end instead of taking a line.
                        <div className="flex min-w-0 items-baseline gap-1">
                          <p className="min-w-0 truncate text-sm">
                            {tool.description}
                          </p>
                          <button
                            type="button"
                            className="hover:text-primary shrink-0 text-xs font-medium"
                            onClick={() => setDescriptionOpen(true)}
                          >
                            Show more…
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </header>

              <section className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
                <div className="mx-auto max-w-6xl">
                  <h2 className="mb-4 text-2xl font-semibold">
                    Configure Tool
                  </h2>
                  <div className="grid gap-6">
                    <div>{params}</div>

                    {blockedReason && (
                      <p className="text-muted-foreground text-sm">
                        {blockedReason}
                      </p>
                    )}

                    {tool.explanation_of_results_markdown && (
                      <section className="border-t pt-6">
                        <RenderMarkdown
                          markdown={tool.explanation_of_results_markdown}
                        />
                      </section>
                    )}

                    <p className="text-muted-foreground text-xs">
                      Input files stay on this computer; outputs go to the
                      output folder in the run settings.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <aside className="flex min-h-0 flex-col border-l">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <h2 className="mb-4 text-sm font-semibold">Run settings</h2>
                <div className="grid gap-6">
                  {settingsPanel}

                  <div>
                    <Label htmlFor="runner-output">Output folder</Label>
                    <p className="mb-2 text-muted-foreground text-xs">
                      Finished runs are copied here.
                    </p>
                    <Input
                      id="runner-output"
                      readOnly
                      value={settings.output_dir}
                      className="font-mono text-xs"
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!doctorReady}
                        onClick={() => {
                          void pickDirectory(settings.output_dir).then(
                            (chosen) => {
                              if (chosen)
                                void updateSettings({ output_dir: chosen });
                            },
                          );
                        }}
                      >
                        Browse…
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!doctorReady}
                        onClick={() => openPath(settings.output_dir)}
                      >
                        <FolderOpen />
                        Open
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label htmlFor="runner-network">
                        Allow network access
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Turn this off for tools that must run offline.
                      </p>
                    </div>
                    <Switch
                      id="runner-network"
                      checked={settings.network}
                      disabled={!doctorReady}
                      onCheckedChange={(checked) =>
                        void updateSettings({ network: checked === true })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label htmlFor="runner-clean-work">
                        Clean up work folder
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Delete the run&#39;s .cpg_work folder once its outputs
                        are copied. Keep it to inspect the files a run left
                        behind.
                      </p>
                    </div>
                    <Switch
                      id="runner-clean-work"
                      checked={settings.clean_work_dir}
                      disabled={!doctorReady}
                      onCheckedChange={(checked) =>
                        void updateSettings({
                          clean_work_dir: checked === true,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="bg-background shrink-0 border-t px-6 py-4">
                {submit}
              </div>
            </aside>
          </>
        )}
      />

      <DockerSetupDialog
        open={!!effectiveDoctor && !effectiveDoctor.ready}
        doctor={effectiveDoctor}
        onRefresh={() => void refreshStatus()}
      />
      <InstallDialog
        open={installOpen}
        tool={tool}
        installing={status?.installing ?? false}
        onRefreshStatus={() => void refreshStatus()}
        onDismiss={() => setInstallDismissed(true)}
      />
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{`Remove ${tool?.name ?? "this tool"}?`}</DialogTitle>
            <DialogDescription>
              Its pack and installed environment are deleted from this computer.
              Runs and the outputs already copied stay where they are.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="destructive"
              disabled={removing}
              onClick={() => void removeCurrent()}
            >
              {removing && <LoaderCircle className="animate-spin" />}
              Remove tool
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={removing}
              onClick={() => setRemoveOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
