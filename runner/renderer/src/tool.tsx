import {
  ChevronDown,
  Download,
  EllipsisVertical,
  ExternalLink,
  LoaderCircle,
  Monitor,
  Moon,
  Settings as SettingsIcon,
  Sun,
  Trash2,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import RenderMarkdown from "@/components/Common/Markdown";
import { ConfirmationDialog } from "@/components/Common/ConfirmationDialog";
import ToolRunForm from "@/components/Tools/ToolRunForm";
import { ToolSettings } from "@/components/Tools/ToolSettings";
import { ToolTabs } from "@/components/Tools/ToolTabs";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ApiError, api, errorMessage } from "./api";
import { DockerSetupDialog } from "./components/DockerSetupDialog";
import { InstallDialog } from "./components/InstallDialog";
import { LocalFilePicker } from "./components/LocalFilePicker";
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
import { portalToolUrl, portalUrl } from "./lib/portal";
import { useNavigate } from "@tanstack/react-router";
import cpgLogo from "./assets/cpg-logo.png";

const FIELD_ERROR =
  /^(?:Missing required parameter|Invalid value for parameter): (.+)$/;

/** Fixed for the window's lifetime; read once. */
const appVersion = window.cpgRunner?.appVersion ?? "";

/** Everything the tool page shows about one tool. */
type ToolPageSnapshot = {
  tool: ToolConfig;
  status: StatusPayload;
  settings: Settings;
  fileTypes: FileTypesMap;
  environment: string | null;
};

/**
 * The last loaded snapshot per tool, so switching back to a tool it already
 * showed paints at once and refreshes in the background instead of holding a
 * loading state. One snapshot per installed tool — bounded by the installed
 * catalogue, not by time.
 */
const toolPageCache = new Map<string, ToolPageSnapshot>();

const ASIDE_WIDTH_KEY = "cpg-runner.aside-width";
const ASIDE_MIN = 320;
const ASIDE_MAX = 640;
const ASIDE_DEFAULT = 400;

function readAsideWidth(): number {
  try {
    const raw = localStorage.getItem(ASIDE_WIDTH_KEY);
    if (raw !== null && raw !== "") {
      const value = Number(raw);
      if (Number.isFinite(value))
        return Math.min(ASIDE_MAX, Math.max(ASIDE_MIN, value));
    }
  } catch {
    // ignore
  }
  return ASIDE_DEFAULT;
}

export function ToolPage({ toolId }: { toolId: string }) {
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const [tool, setTool] = useState<ToolConfig | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [fileTypes, setFileTypes] = useState<FileTypesMap>({});
  const [environment, setEnvironment] = useState<string | null>(null);
  const [forcedDoctor, setForcedDoctor] = useState<DoctorReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Why this tool's files cannot be read, when the app could not parse them.
  const [problem, setProblem] = useState<string | null>(null);
  const [removeUnreadableOpen, setRemoveUnreadableOpen] = useState(false);
  // A tool switch keeps the page on screen: only the params are shown as
  // loading while the new tool's data arrives.
  const [loadingTool, setLoadingTool] = useState(false);
  const pendingTool = useRef(toolId);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [runName, setRunName] = useState("");
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const images = useToolImages();
  const [rerunRun, setRerunRun] = useState<RunRecord | null>(null);
  const [asideWidth, setAsideWidth] = useState(readAsideWidth);
  const asideWidthRef = useRef(asideWidth);
  asideWidthRef.current = asideWidth;

  const startAsideResize = (event: React.PointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = asideWidthRef.current;
    const move = (ev: PointerEvent) => {
      setAsideWidth(
        Math.min(
          ASIDE_MAX,
          Math.max(ASIDE_MIN, startWidth - (ev.clientX - startX)),
        ),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {
        localStorage.setItem(ASIDE_WIDTH_KEY, String(asideWidthRef.current));
      } catch {
        // ignore
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const [rerunChecked, setRerunChecked] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement | null>(null);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Answers for a tool the window has left must not overwrite the new one's.
  const loadSeq = useRef(0);

  const refreshStatus = useCallback(async () => {
    const seq = loadSeq.current;
    const next = await api.get<StatusPayload>("/status");
    // A tool switch bumps the sequence: this answer describes a tool the page
    // has left, so it must not overwrite the new tool's status.
    if (seq !== loadSeq.current) return next;
    setStatus(next);
    setForcedDoctor(null);
    return next;
  }, []);

  const loadAll = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const [toolPayload, statusPayload, settingsPayload, types, envPayload] =
        await Promise.all([
          api.get<ToolPayload>("/tool"),
          api.get<StatusPayload>("/status"),
          api.get<Settings>("/settings"),
          api.get<FileTypesMap>("/file-types"),
          api.get<{ yml: string | null }>("/environment"),
        ]);
      if (seq !== loadSeq.current) return;
      const loadedTool = unwrapTool(toolPayload);
      toolPageCache.set(pendingTool.current, {
        tool: loadedTool,
        status: statusPayload,
        settings: settingsPayload,
        fileTypes: types,
        environment: envPayload.yml,
      });
      setTool(loadedTool);
      setStatus(statusPayload);
      setSettings(settingsPayload);
      setFileTypes(types);
      setEnvironment(envPayload.yml);
      setLoadError(null);
    } catch (error) {
      if (seq !== loadSeq.current) return;
      // A snapshot fits the tool the page shows: keep it on screen and say
      // why it could not refresh, instead of dropping the page to its error
      // state. Without one, the error page (with Retry) is the honest view.
      if (toolPageCache.has(pendingTool.current)) {
        toast.error(errorMessage(error));
      } else {
        setLoadError(errorMessage(error));
      }
    }
  }, []);

  // Switching tools keeps this page mounted: the sidebar and the run settings
  // stay where they are and only the tool's own parts reload, so the window
  // never falls back to its empty state.
  useEffect(() => {
    pendingTool.current = toolId;
    setLoadingTool(true);
    setRunName("");
    setInstallDismissed(false);
    setRerunRun(null);
    setRerunChecked(true);
    setForcedDoctor(null);
    setDescriptionOpen(false);
    setLoadError(null);
    // A tool the user left and came back to paints at once from its last
    // snapshot; loadAll below refreshes it in the background. A first visit
    // drops the tool being left so the page shows its loading state for the
    // new tool, not the previous one's.
    const cached = toolPageCache.get(toolId);
    if (cached) {
      setTool(cached.tool);
      setStatus(cached.status);
      setSettings(cached.settings);
      setFileTypes(cached.fileTypes);
      setEnvironment(cached.environment);
      setLoadingTool(false);
    } else {
      setTool(null);
      setStatus(null);
      setSettings(null);
      setFileTypes({});
      setEnvironment(null);
    }
    // A tool whose files no longer parse still has a page: the reason comes
    // from the app, which is the only place that knows why.
    void window.cpgRunner
      ?.tools?.()
      .then((entries) => {
        if (pendingTool.current !== toolId) return;
        setProblem(
          entries.find((entry) => entry.id === toolId)?.problem ?? null,
        );
      })
      .catch(() => {});
    void loadAll().finally(() => {
      if (pendingTool.current === toolId) setLoadingTool(false);
    });
  }, [toolId, loadAll]);

  // The picture is shown from its URL until the main process keeps a copy.
  useEffect(() => {
    if (tool?.image && !images[tool.id]) {
      void window.cpgRunner?.cacheToolImage?.(tool.id, tool.image);
    }
  }, [tool?.id, tool?.image, images]);

  // "Show more" earns its line only when the text does not fit in one.
  useEffect(() => {
    const element = descriptionRef.current;
    if (!element || descriptionOpen) return;
    const measure = () => {
      setDescriptionOverflows(element.scrollWidth - element.clientWidth > 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [descriptionOpen, tool?.description]);

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
    : needsInstall
      ? "Install the tool environment to run this tool."
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
      void navigate({
        to: "/t/$toolId/run/$runId",
        params: { toolId, runId: record.id },
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const doctor = (error.payload as { doctor?: DoctorReport } | null)
          ?.doctor;
        // Only an install blocker reopens the install dialog; a folder that
        // already exists is just reported in a toast.
        if (doctor) {
          setForcedDoctor(doctor);
          setInstallDismissed(false);
        }
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

  // A tool whose files cannot be read has no other way out: the walk-away
  // route is removing it, or importing its pack again from the portal.
  async function removeUnreadable() {
    setRemoving(true);
    try {
      // The main process opens another tool, or the tool list.
      await window.cpgRunner?.removeTool?.(toolId);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRemoving(false);
      setRemoveUnreadableOpen(false);
    }
  }

  async function uninstall() {
    setUninstalling(true);
    try {
      await api.delete("/install");
      setInstallDismissed(false);
      await refreshStatus();
      toast.success("Environment removed; install it again to run tools");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUninstalling(false);
      setUninstallOpen(false);
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
          {problem && (
            <>
              <p className="text-muted-foreground max-w-md text-center text-sm">
                {problem}
              </p>
              <p className="text-muted-foreground max-w-md text-center text-xs">
                Importing the tool's pack again, or installing the build that
                created it, gets it working.
              </p>
            </>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => void loadAll()}>Retry</Button>
            {problem && (
              <>
                <Button
                  variant="outline"
                  onClick={() => void openExternal(portalUrl())}
                >
                  Open the portal
                </Button>
                <Button
                  variant="destructive"
                  disabled={removing}
                  onClick={() => setRemoveUnreadableOpen(true)}
                >
                  Remove tool
                </Button>
              </>
            )}
          </div>
        </div>
        <ConfirmationDialog
          open={removeUnreadableOpen}
          onOpenChange={setRemoveUnreadableOpen}
          title="Remove this tool?"
          description="Its files could not be read, and its runs are removed with it."
          confirmLabel="Remove tool"
          pending={removing}
          onConfirm={() => void removeUnreadable()}
        />
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

  // A tool's max_cpus bounds the portal's scheduler, so a local run may use
  // every CPU this computer has. When it equals min_cpus the tool wants exactly
  // that many, though: spare CPUs change nothing, so the control goes away.
  const fixedCpus =
    tool.max_cpus !== null && tool.max_cpus === tool.min_cpus
      ? tool.max_cpus
      : null;

  return (
    <div
      className="flex h-full"
      style={{ "--aside-w": `${asideWidth}px` } as React.CSSProperties}
    >
      <ToolSidebar activeToolId={toolId} />

      {/* A new tool starts with its own params and a fresh form: its values,
          the rerun prefill and the picked CPUs all belong to one tool. */}
      <ToolRunForm
        key={tool.id}
        formKey={tool.id}
        params={tool.params}
        minCpus={tool.min_cpus}
        maxCpus={fixedCpus}
        userMaxCpus={status.cpus_available}
        defaultCpus={settings.cpus}
        isDisabled={!canRun || loadingTool}
        submitLabel="Run locally"
        fillSubmit
        localCpus
        onSubmit={submitLocally}
        mapError={fieldError}
        initialValues={rerunValues}
        initialValuesReady={rerunChecked}
        initialThreads={rerunRun?.cpus ?? null}
        className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_var(--aside-w)]"
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
            <p className="mt-1 mb-2 text-sm text-foreground/70">
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
                    image={
                      images[tool.id] ??
                      tool.image ??
                      placeholderImage(tool.name)
                    }
                    name={tool.name}
                    version={tool.version}
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
                          {status.env.needed && status.env.installed && (
                            <DropdownMenuItem
                              onSelect={() => setUninstallOpen(true)}
                            >
                              <Wrench />
                              Uninstall environment
                            </DropdownMenuItem>
                          )}
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
                        <p className="text-sm">
                          {tool.description}
                          {descriptionOverflows && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground ml-1 h-5 gap-0.5 px-1 align-baseline text-xs"
                              aria-expanded={true}
                              onClick={() => setDescriptionOpen(false)}
                            >
                              Show less
                              <ChevronDown className="size-3.5 rotate-180" />
                            </Button>
                          )}
                        </p>
                      ) : (
                        <div className="flex min-w-0 items-center gap-1">
                          <p
                            ref={descriptionRef}
                            className="min-w-0 flex-1 truncate text-sm"
                          >
                            {tool.description}
                          </p>
                          {descriptionOverflows && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground h-5 shrink-0 gap-0.5 px-1 text-xs"
                              aria-expanded={false}
                              onClick={() => setDescriptionOpen(true)}
                            >
                              Show more
                              <ChevronDown className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </header>

              <section className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
                <div className="mx-auto max-w-6xl">
                  <ToolTabs
                    tool={tool}
                    environment={environment}
                    onOpenExternal={(url) => void openExternal(url)}
                    configure={
                      <>
                        <h2 className="mb-4 text-2xl font-semibold">
                          Configure tool
                        </h2>
                        <div className="grid gap-6">
                          <div>
                            {loadingTool ? (
                              <p
                                className="text-muted-foreground flex items-center gap-2 text-sm"
                                role="status"
                              >
                                <LoaderCircle className="size-4 animate-spin" />
                                Loading…
                              </p>
                            ) : (
                              params
                            )}
                          </div>

                          <p className="text-muted-foreground text-xs">
                            Input files stay on this computer; outputs go to the
                            output folder in the run settings.
                          </p>
                        </div>
                      </>
                    }
                  />
                </div>
              </section>
            </div>

            <aside className="relative flex min-h-0 flex-col border-l">
              <div
                aria-hidden
                onPointerDown={startAsideResize}
                className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize touch-none"
              />
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <div className="mb-4 flex items-center justify-between">
                  <img
                    src={cpgLogo}
                    alt="CPG"
                    className="h-14 w-auto shrink-0"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Global settings"
                      >
                        <SettingsIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => setTheme("light")}>
                        <Sun className="mr-2 h-4 w-4" />
                        Light
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("dark")}>
                        <Moon className="mr-2 h-4 w-4" />
                        Dark
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("system")}>
                        <Monitor className="mr-2 h-4 w-4" />
                        System
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled
                        className="text-muted-foreground focus:bg-transparent"
                      >
                        {appVersion
                          ? `CPG Runner v${appVersion}`
                          : "CPG Runner"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <h2 className="mb-3 text-lg font-semibold">Run settings</h2>
                <div className="grid gap-6 [&>*]:min-w-0">
                  {settingsPanel}

                  <ToolSettings
                    settings={settings}
                    updateSettings={updateSettings}
                    disabled={!doctorReady}
                    onPickDirectory={(current) => pickDirectory(current)}
                    onOpenPath={(path) => openPath(path)}
                  />
                </div>
              </div>
              <div className="bg-background shrink-0 border-t px-6 py-3">
                {blockedReason && !doctorReady && (
                  <p className="text-muted-foreground mb-2 text-sm">
                    {blockedReason}
                  </p>
                )}
                {needsInstall && (
                  <p className="mb-2">
                    <button
                      type="button"
                      onClick={() => setInstallDismissed(false)}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm underline-offset-2 hover:underline"
                    >
                      Install the tool environment to run this tool.
                    </button>
                  </p>
                )}
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
      <Dialog open={uninstallOpen} onOpenChange={setUninstallOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{`Uninstall the environment for ${tool?.name ?? "this tool"}?`}</DialogTitle>
            <DialogDescription>
              Its installed environment is deleted from this computer, so the
              tool cannot run until it is installed again. The tool itself, its
              runs and the outputs already copied stay where they are.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="destructive"
              disabled={uninstalling}
              onClick={() => void uninstall()}
            >
              {uninstalling && <LoaderCircle className="animate-spin" />}
              Uninstall environment
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={uninstalling}
              onClick={() => setUninstallOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
