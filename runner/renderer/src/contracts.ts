import type { Param } from "@/client"

export type FileTypeMeta = {
  extensions: string[]
  file_format: string
  mime_types: string[]
}

export type FileTypesMap = Record<string, FileTypeMeta>

export type ToolTarget = {
  path: string
  target_type?: string
  required?: boolean
}

export type SetupFile = {
  name: string
  content: string
}

/** The `tool` object written into tool.json next to the desktop app. */
export type ToolConfig = {
  id: string
  name: string
  version: string
  description: string | null
  explanation_of_results_markdown: string | null
  command: string
  params: Param[]
  targets: ToolTarget[]
  setup_files: SetupFile[]
  post_install: string | null
  min_cpus: number
  max_cpus: number | null
  default_cpus: number | null
}

/** `GET /api/tool` may return the manifest wrapper or the tool itself. */
export type ToolPayload =
  | ToolConfig
  | { schema_version: number; tool: ToolConfig }

export function unwrapTool(payload: ToolPayload): ToolConfig {
  return "tool" in payload && payload.tool ? payload.tool : (payload as ToolConfig)
}

export type Settings = {
  cpus: number
  output_dir: string
  network: boolean
}

export type DoctorAction = {
  id: string
  label: string
}

export type BlockingReason =
  | "docker_cli"
  | "docker_daemon"
  | "docker_permission"
  | "wsl"
  | null

export type DoctorReport = {
  platform: "darwin" | "windows" | "linux"
  docker: {
    cli: boolean
    daemon: boolean
    version: string | null
    error: string | null
  }
  desktop: { installed: boolean; path: string | null }
  wsl: { present: boolean; version2: boolean } | null
  ready: boolean
  blocking: BlockingReason
  actions: DoctorAction[]
  instructions: string
  download_url: string
}

export type InstallState =
  | "docker_missing"
  | "image_missing"
  | "env_missing"
  | "installed"

export type StatusPayload = {
  docker: { available: boolean; version: string | null }
  doctor: DoctorReport
  image: { present: boolean; tag: string }
  env: { needed: boolean; installed: boolean }
  settings: Settings
  installing: boolean
}

export function currentInstallState(status: StatusPayload): InstallState {
  if (!status.docker.available) return "docker_missing"
  if (!status.image.present) return "image_missing"
  if (status.env.needed && !status.env.installed) return "env_missing"
  return "installed"
}

export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type RunFile = {
  name: string
  path: string
  size: number
}

export type RunRecord = {
  id: string
  status: RunStatus
  command?: string
  cpus?: number
  params?: Record<string, unknown>
  stdout?: string
  exit_code?: number | null
  error?: string | null
  output_dir?: string | null
  files?: RunFile[]
  created_at?: string | null
  started_at?: string | null
  finished_at?: string | null
}

export function isRunActive(status: RunStatus | undefined): boolean {
  return status === "pending" || status === "running"
}

export type InstallMessage =
  | { type: "log"; line: string }
  | { type: "state"; state: string }

export type RunLogMessage =
  | { type: "log"; line: string }
  | { type: "status"; status: RunStatus; exit_code?: number | null }
