import type { Param } from "@/client"
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"
import RenderMarkdown from "@/components/Common/Markdown"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { buildVisibilityMap } from "@/lib/run-params"
import { api, ApiError, errorMessage } from "./api"
import { DockerSetupDialog } from "./components/DockerSetupDialog"
import { InstallDialog } from "./components/InstallDialog"
import { LocalParamsForm } from "./components/LocalParamsForm"
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

function initialValues(params: Param[]): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const param of params) {
    if (param.param_type === "file") {
      values[param.name] = []
    } else if (param.param_type === "bool") {
      values[param.name] = param.default === true
    } else {
      values[param.name] = param.default ?? ""
    }
  }
  return values
}

export function ToolPage() {
  const [tool, setTool] = useState<ToolConfig | null>(null)
  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [fileTypes, setFileTypes] = useState<FileTypesMap>({})
  const [forcedDoctor, setForcedDoctor] = useState<DoctorReport | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
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
      setValues(initialValues(loadedTool.params))
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

  const visibility = useMemo(
    () => buildVisibilityMap(tool?.params ?? [], values),
    [tool, values],
  )

  const canRun =
    !!settings &&
    doctorReady &&
    installState === "installed" &&
    !submitting

  const blockedReason = !doctorReady
    ? "Docker is not ready."
    : installState !== "installed"
      ? "The tool environment is not installed."
      : null

  function updateValue(name: string, value: unknown) {
    setValues((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => {
      if (!previous[name]) return previous
      const next = { ...previous }
      delete next[name]
      return next
    })
  }

  async function saveSettings(draft: Settings) {
    try {
      await api.put("/settings", draft)
      setSettings(draft)
      toast.success("Settings saved")
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settings || submitting || !doctorReady || installState !== "installed")
      return
    setSubmitting(true)
    setErrors({})
    try {
      const record = await api.post<RunRecord>("/runs", {
        params: values,
        cpus: settings.cpus,
      })
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
      const field = FIELD_ERROR.exec(message)
      if (field) {
        setErrors({ [field[1]]: message })
      } else {
        toast.error(message)
      }
    } finally {
      setSubmitting(false)
    }
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
            tool={tool}
            settings={settings}
            disabled={!doctorReady}
            onSave={saveSettings}
          />

          <form className="grid gap-5" onSubmit={(event) => void submit(event)}>
            <LocalParamsForm
              params={tool.params}
              values={values}
              visible={visibility}
              fileTypes={fileTypes}
              errors={errors}
              disabled={!canRun}
              onChange={updateValue}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!canRun}>
                {submitting ? "Starting…" : "Run locally"}
              </Button>
              {blockedReason && (
                <p className="text-muted-foreground text-sm">{blockedReason}</p>
              )}
            </div>
          </form>

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
