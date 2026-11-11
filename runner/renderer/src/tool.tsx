import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import RenderMarkdown from "@/components/Common/Markdown"
import ToolRunForm from "@/components/Tools/ToolRunForm"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api, ApiError, errorMessage } from "./api"
import { DockerSetupDialog } from "./components/DockerSetupDialog"
import { InstallDialog } from "./components/InstallDialog"
import { LocalFilePicker } from "./components/LocalFilePicker"
import { RunSettingsCard } from "./components/RunSettingsCard"
import { navigate } from "./router"
import {
  currentInstallState,
  unwrapTool,
  type DoctorReport,
  type FileTypesMap,
  type RunRecord,
  type Settings,
  type StatusPayload,
  type ToolConfig,
  type ToolPayload,
} from "./contracts"

const FIELD_ERROR = /^(?:Missing required parameter|Invalid value for parameter): (.+)$/

export function ToolPage() {
  const [tool, setTool] = useState<ToolConfig | null>(null)
  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [fileTypes, setFileTypes] = useState<FileTypesMap>({})
  const [forcedDoctor, setForcedDoctor] = useState<DoctorReport | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [installDismissed, setInstallDismissed] = useState(false)

  const refreshStatus = useCallback(async () => {
    const next = await api.get<StatusPayload>("/status")
    setStatus(next)
    setForcedDoctor(null)
    return next
  }, [])

  const loadAll = useCallback(async () => {
    try {
      const [toolPayload, statusPayload, settingsPayload, types] =
        await Promise.all([
          api.get<ToolPayload>("/tool"),
          api.get<StatusPayload>("/status"),
          api.get<Settings>("/settings"),
          api.get<FileTypesMap>("/file-types"),
        ])
      const loadedTool = unwrapTool(toolPayload)
      setTool(loadedTool)
      setStatus(statusPayload)
      setSettings(settingsPayload)
      setFileTypes(types)
      setLoadError(null)
    } catch (error) {
      setLoadError(errorMessage(error))
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const effectiveDoctor = forcedDoctor ?? status?.doctor ?? null
  const doctorReady = effectiveDoctor?.ready === true
  const installState = status ? currentInstallState(status) : null
  const installOpen =
    !!status &&
    doctorReady &&
    installState !== "installed" &&
    !installDismissed
  const shouldPoll = (status?.installing ?? false) || installOpen

  useEffect(() => {
    if (!shouldPoll) return
    const interval = setInterval(() => {
      void refreshStatus().catch(() => {})
    }, 2000)
    return () => clearInterval(interval)
  }, [shouldPoll, refreshStatus])

  const canRun =
    !!settings && doctorReady && installState === "installed"

  const blockedReason = !doctorReady
    ? "Docker is not ready."
    : installState !== "installed"
      ? "The tool environment is not installed."
      : null

  async function saveSettings(draft: Settings) {
    try {
      await api.put("/settings", draft)
      setSettings(draft)
      toast.success("Settings saved")
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  // The portal's run form drives a local run: files come from this computer,
  // and the run is created by the sidecar instead of the portal.
  async function submitLocally({
    params,
    cpus,
  }: {
    params: Record<string, unknown>
    cpus: number
  }) {
    try {
      const record = await api.post<RunRecord>("/runs", { params, cpus })
      navigate(`/run?id=${record.id}`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const doctor = (error.payload as { doctor?: DoctorReport } | null)
          ?.doctor
        if (doctor) setForcedDoctor(doctor)
        setInstallDismissed(false)
        void refreshStatus().catch(() => {})
      }
      const message = errorMessage(error)
      if (!FIELD_ERROR.test(message)) toast.error(message)
      throw error
    }
  }

  function fieldError(error: unknown): Record<string, string> | null {
    const message = errorMessage(error)
    const field = FIELD_ERROR.exec(message)
    return field ? { [field[1]]: message } : null
  }

  async function reinstall() {
    try {
      await api.delete("/install")
      setInstallDismissed(false)
      await refreshStatus()
      toast.success("Environment removed; install it again to run tools")
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <p className="text-destructive text-sm">{loadError}</p>
        <Button onClick={() => void loadAll()}>Retry</Button>
      </div>
    )
  }

  if (!tool || !settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b px-8 py-6">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{tool.name}</h1>
              {tool.version && (
                <Badge variant="secondary">v{tool.version}</Badge>
              )}
            </div>
            {tool.description && (
              <div className="mt-2">
                <RenderMarkdown markdown={tool.description} />
              </div>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => navigate("/")}
          >
            All tools
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto px-8 py-6">
        <div className="mx-auto grid max-w-3xl gap-6">
          <RunSettingsCard
            settings={settings}
            disabled={!doctorReady}
            onSave={saveSettings}
          />

          <div className="grid gap-3">
            <ToolRunForm
              formKey={tool.id}
              params={tool.params}
              minCpus={tool.min_cpus}
              maxCpus={tool.max_cpus}
              defaultCpus={settings.cpus}
              isDisabled={!canRun}
              submitLabel="Run locally"
              onSubmit={submitLocally}
              mapError={fieldError}
              renderFilePicker={({ param, values, onChange, disabled }) => (
                <LocalFilePicker
                  param={param}
                  values={values}
                  fileTypes={fileTypes}
                  disabled={disabled}
                  onChange={onChange}
                />
              )}
            />
            {blockedReason && (
              <p className="text-muted-foreground text-sm">{blockedReason}</p>
            )}
          </div>

          {tool.explanation_of_results_markdown && (
            <section className="border-t pt-6">
              <RenderMarkdown
                markdown={tool.explanation_of_results_markdown}
              />
            </section>
          )}
        </div>
      </main>

      <footer className="flex shrink-0 items-center justify-between gap-4 border-t px-8 py-3">
        <p className="text-muted-foreground text-xs">
          Input files stay on this computer; outputs go to the folder in run
          settings.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!doctorReady}
            onClick={() => void reinstall()}
          >
            Reinstall environment
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => window.close()}
          >
            Quit
          </Button>
        </div>
      </footer>

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
    </div>
  )
}
