import { type ChildProcess, spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse,
} from "node:http"
import { connect as netConnect, type Socket } from "node:net"
import path from "node:path"
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
  nativeTheme,
  Notification,
  type OpenDialogOptions,
  screen,
  shell,
} from "electron"

import { splashHtml } from "./splash"

const SIDECAR_READY = /^CPG_RUNNER_READY (\{.*\})$/
// Generous: the packaged sidecar unpacks itself on first launch, and a machine
// under load can be slow. A wedged sidecar still fails, it just takes longer.
const SIDECAR_START_TIMEOUT_MS = 120_000
const SIDECAR_KILL_GRACE_MS = 3_000
const PACK_EXTENSION = ".cpgpack"
// Format of the app's own data under <userData>, and how often it looks for a
// newer build of itself.
const DATA_SCHEMA_VERSION = 1
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

// The main window's remembered (and smallest acceptable) size. Bounds are
// saved under userData on close and reused on the next launch.
const MIN_WINDOW_WIDTH = 640
const MIN_WINDOW_HEIGHT = 520
const WINDOW_BOUNDS_FILE = "window-bounds.json"

// What a click may hand to the system browser: any http(s) address, because
// every open is user-initiated (a tool's docs, a paper, the portal). Other
// schemes are refused, so a pack cannot trigger `file:` or a custom protocol
// handler behind the visitor's back.
const ALLOWED_EXTERNAL_SCHEMES: Record<string, true> = {
  "http:": true,
  "https:": true,
}

export type ToolEntry = {
  id: string
  name: string
  version: string
  description: string | null
  /** The portal's picture URL, so a window without a cached copy still shows it. */
  image: string | null
  /** Why this tool cannot be read, when its files no longer parse. */
  problem: string | null
}

type ToolRecord = {
  id?: string
  name?: string
  version?: string
  description?: string | null
  image?: string | null
}

// `tool.json` inside an installed pack.
type ToolFile = { schema_version?: number; tool?: ToolRecord }

// A downloaded pack: the two files plus what the tool page showed the user.
type PackDocument = {
  schema_version?: number
  tool?: ToolFile
  runner?: Record<string, unknown>
  environment_yml?: string | null
  readme?: string
}

type Sidecar = { child: ChildProcess; port: number }

// What the sidebar needs from the portal's catalogue.
type PortalToolSummary = {
  name: string
  version: string
  description: string | null
  image: string | null
  tags: string[]
}

type PortalToolDetail = PortalToolSummary & {
  url: string | null
  docs_url: string | null
  paper_doi: string | null
  license: string | null
  github_repo: string | null
  badges: { badge?: string | null; url?: string | null }[]
  versions: string[]
}

// Development: the window loads the renderer from vite, with hot reload, and a
// data directory of its own, so a dev session never touches real installs. The
// window still goes through the app server for the API (see `startAppServer`),
// which is why `appUrl` passes its origin along.
if (process.env.CPG_RUNNER_DATA_DIR) {
  app.setPath("userData", path.resolve(process.env.CPG_RUNNER_DATA_DIR))
}
const uiOrigin = (process.env.CPG_RUNNER_UI_URL || "").replace(/\/+$/, "")
const uiDir =
  process.env.CPG_RUNNER_UI_DIR || path.join(process.resourcesPath, "renderer")

// Packaged, the preload sits in the app's dist; from source, next to the main
// script Electron was given. `__dirname` is the source folder once bundled, so
// it cannot be used here.
function preloadPath(): string {
  if (process.env.CPG_RUNNER_PRELOAD) {
    return path.resolve(process.env.CPG_RUNNER_PRELOAD)
  }
  if (app.isPackaged) {
    return path.join(app.getAppPath(), "dist", "electron", "preload.js")
  }
  return path.join(path.dirname(process.argv[1] ?? ""), "preload.js")
}

// Where the app's own portal lives, e.g. to send the user to the tool list on
// a first run. Passed in by the dev script or the environment; a portal the
// user chose in Settings replaces it, and is remembered across launches.
let portalUrl = (process.env.CPG_RUNNER_PORTAL_URL || "").replace(/\/+$/, "")

// The user's choices — a portal and a theme — under the app's own data
// directory, so the native shell can read them before the window exists.
const SETTINGS_FILE = "settings.json"

type AppSettings = { portal_url?: unknown; theme?: unknown }

function readSettings(): AppSettings {
  try {
    const file = path.join(app.getPath("userData"), SETTINGS_FILE)
    return JSON.parse(fs.readFileSync(file, "utf-8")) as AppSettings
  } catch {
    // No choices yet, or a file that cannot be read: keep the defaults.
    return {}
  }
}

function writeSettings(patch: AppSettings): void {
  const file = path.join(app.getPath("userData"), SETTINGS_FILE)
  fs.writeFileSync(
    file,
    JSON.stringify({ ...readSettings(), ...patch }, null, 2),
  )
}

/** The theme the user chose, or "system" before any choice. */
function storedShellTheme(): "dark" | "light" | "system" {
  const stored = readSettings().theme
  return stored === "dark" || stored === "light" || stored === "system"
    ? stored
    : "system"
}

// The app's own chrome — title bar, menus, dialogs — and the background the
// window loads onto follow the page's theme, applied before the first paint
// so the shell never flashes a different colour.
let shellTheme: "dark" | "light" | "system" = "system"

/** Whether the shell paints dark, resolving "system" against the OS. */
function shellDark(): boolean {
  return (
    shellTheme === "dark" ||
    (shellTheme === "system" && nativeTheme.shouldUseDarkColors)
  )
}

/** The page's background colour for the effective theme. */
function shellBackground(): string {
  return shellDark() ? "#0d1b26" : "#f5f9fb"
}

/** A portal address the app can actually reach: http(s) with no path. */
function normalizePortalUrl(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      "Enter the portal's address, e.g. https://portal.example.org",
    )
  }
  const url = value.trim().replace(/\/+$/, "")
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("That is not a valid portal address")
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("The portal address must start with http:// or https://")
  }
  return url
}

const token = randomUUID()

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let shuttingDown = false
let lastToolId: string | null = null
// The window is served by the app itself and never changed: tools are routes
// on that one origin, and their API calls go through its proxy.
let windowLoaded = false
let uiServerPort = 0
const sidecars = new Map<string, Sidecar>()
// Sidecars this app stopped on purpose: their exit is not a crash.
const stoppingSidecars = new Set<string>()
const starting = new Map<string, Promise<number>>()
const sidecarStderr = new Map<string, string[]>()

function sidecarBinaryPath(): string {
  if (process.env.CPG_RUNNER_SIDECAR) return process.env.CPG_RUNNER_SIDECAR
  const name = process.platform === "win32" ? "cpg-runner.exe" : "cpg-runner"
  // A one-folder build: the executable sits next to its libraries, which
  // starts in well under a second instead of unpacking on every launch.
  return app.isPackaged
    ? path.join(process.resourcesPath, "sidecar", "cpg-runner", name)
    : path.join(app.getAppPath(), "sidecar", "dist", "cpg-runner", name)
}

function portalBase(): string {
  return portalUrl.replace(/\/+$/, "")
}

// The app's own version. Packaged, electron-builder stamps package.json into
// the bundle and Electron reports it; launched from a script, Electron reports
// its own version instead, so the package.json above the bundled main is read.
function appVersion(): string {
  if (app.isPackaged) return app.getVersion()
  const main = path.dirname(process.argv[1] ?? "")
  for (const directory of [path.resolve(main, "..", ".."), main]) {
    const file = path.join(directory, "package.json")
    try {
      const version = (
        JSON.parse(fs.readFileSync(file, "utf-8")) as {
          version?: unknown
        }
      ).version
      if (typeof version === "string" && version !== "") return version
    } catch {
      // No package.json here: the next candidate, or Electron's own version.
    }
  }
  return app.getVersion()
}

async function portalGet<T>(path: string): Promise<T> {
  const response = await fetch(`${portalBase()}${path}`, {
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`The portal answered ${response.status}`)
  return (await response.json()) as T
}

type PortalRow = {
  name: string
  version?: string
  description?: string | null
  image?: string | null
  tags?: string[] | null
}

function portalSummary(tool: PortalRow): PortalToolSummary {
  return {
    name: tool.name,
    version: tool.version ?? "",
    description: tool.description ?? null,
    image: tool.image ?? null,
    tags: tool.tags ?? [],
  }
}

// The tools the portal offers, one row per name.
async function listPortalTools(): Promise<PortalToolSummary[]> {
  const payload = await portalGet<{ data: PortalRow[] }>(
    "/api/v1/tools/?limit=100",
  )
  return payload.data
    .map(portalSummary)
    .sort((left, right) => left.name.localeCompare(right.name))
}

// The portal's own search, so a name beyond the first page is found too.
async function searchPortalTools(query: string): Promise<PortalToolSummary[]> {
  const params = new URLSearchParams({ limit: "50", search: query })
  const payload = await portalGet<{ data: PortalRow[] }>(
    `/api/v1/tools/?${params.toString()}`,
  )
  return payload.data
    .map(portalSummary)
    .sort((left, right) => left.name.localeCompare(right.name))
}

async function portalToolDetail(
  name: string,
  version?: string,
): Promise<PortalToolDetail> {
  const query = version ? `?version=${encodeURIComponent(version)}` : ""
  type PortalTool = {
    name: string
    version?: string
    description?: string | null
    image?: string | null
    url?: string | null
    docs_url?: string | null
    paper_doi?: string | null
    license?: string | null
    github_repo?: string | null
    tags?: string[] | null
    badges?: { badge?: string | null; url?: string | null }[] | null
  }
  const tool = await portalGet<PortalTool>(
    `/api/v1/tools/name/${encodeURIComponent(name)}${query}`,
  )
  const versions = await portalGet<{ version?: string }[]>(
    `/api/v1/tools/name/${encodeURIComponent(name)}/versions`,
  )
  return {
    name: tool.name,
    version: tool.version ?? "",
    description: tool.description ?? null,
    image: tool.image ?? null,
    url: tool.url ?? null,
    docs_url: tool.docs_url ?? null,
    paper_doi: tool.paper_doi ?? null,
    license: tool.license ?? null,
    github_repo: tool.github_repo ?? null,
    tags: tool.tags ?? [],
    badges: tool.badges ?? [],
    versions: versions.map((entry) => entry.version ?? ""),
  }
}

function platformName(): string {
  const arch = process.arch === "arm64" ? "arm64" : "x64"
  const os =
    process.platform === "darwin"
      ? "mac"
      : process.platform === "win32"
        ? "win"
        : "linux"
  return `${os}-${arch}`
}

// Downloads a portal tool as a pack and installs it, replacing the local copy
// of the same name and version (matched by name and version, not by the id a
// pack happens to carry).
async function addPortalTool(target: {
  name: string
  version?: string
}): Promise<ToolEntry> {
  const query = new URLSearchParams({ platform: platformName() })
  if (target.version) query.set("version", target.version)
  const response = await fetch(
    `${portalBase()}/api/v1/tools/name/${encodeURIComponent(target.name)}/runner-pack?${query}`,
    { signal: AbortSignal.timeout(60_000) },
  )
  if (!response.ok) throw new Error(`The portal answered ${response.status}`)
  const file = path.join(
    app.getPath("temp"),
    `cpg-portal-${Date.now()}.cpgpack`,
  )
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()))
  try {
    const entry = importPack(file)
    // A replaced tool has to install its environment again.
    fs.rmSync(path.join(dataDir(entry.id), "environments"), {
      recursive: true,
      force: true,
    })
    void ensureToolImage(entry.id)
    return entry
  } finally {
    fs.rmSync(file, { force: true })
  }
}

function toolsRoot(): string {
  return path.join(app.getPath("userData"), "tools")
}

function packDir(toolId: string): string {
  return path.join(toolsRoot(), toolId, "pack")
}

function dataDir(toolId: string): string {
  return path.join(toolsRoot(), toolId, "data")
}

function readPack(file: string): {
  id: string
  name: string
  version: string
  files: Record<string, string>
} {
  const document = JSON.parse(fs.readFileSync(file, "utf-8")) as PackDocument
  // A pack from a newer app is refused by name rather than half-read.
  if (
    typeof document.schema_version === "number" &&
    document.schema_version > 1
  ) {
    throw new Error("This pack was made by a newer CPG Runner; update the app.")
  }
  const tool = document.tool?.tool
  const id = tool?.id
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("The pack does not name a tool.")
  }
  if (!tool?.name || !document.runner) {
    throw new Error("The pack is missing its tool or runner configuration.")
  }
  const files: Record<string, string> = {
    "tool.json": JSON.stringify(document.tool, null, 2),
    "runner.json": JSON.stringify(document.runner, null, 2),
  }
  if (document.environment_yml) {
    files["environment.yml"] = document.environment_yml
  }
  if (document.readme) {
    files["README.txt"] = document.readme
  }
  return { id, name: tool.name, version: tool.version ?? "", files }
}

function entryFor(toolId: string): ToolEntry | null {
  try {
    const file = JSON.parse(
      fs.readFileSync(path.join(packDir(toolId), "tool.json"), "utf-8"),
    ) as ToolFile
    const tool = file.tool
    if (!tool?.id || !tool.name) return null
    return {
      id: tool.id,
      name: tool.name,
      version: tool.version ?? "",
      description: tool.description ?? null,
      image: tool.image ?? null,
      problem: null,
    }
  } catch (error) {
    console.error(`Could not read tool ${toolId}: ${String(error)}`)
    return null
  }
}

// A tool whose files no longer parse keeps its place in the sidebar: the user
// has to see it to remove it, and hiding it would look like data loss.
function unreadableEntry(toolId: string): ToolEntry {
  return {
    id: toolId,
    name: `Unreadable tool ${toolId.slice(0, 8)}`,
    version: "",
    description: null,
    image: null,
    problem: "CPG Runner could not read this tool's files.",
  }
}

// The tool's picture, downloaded once so the window shows it offline too.
async function downloadToolImage(toolId: string, url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return
  const directory = dataDir(toolId)
  const imagePath = path.join(directory, "tool-image")
  if (fs.existsSync(imagePath)) return
  try {
    const response = await fetch(url)
    if (!response.ok) return
    const bytes = Buffer.from(await response.arrayBuffer())
    const type = response.headers.get("content-type") ?? "image/png"
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(imagePath, bytes)
    fs.writeFileSync(`${imagePath}.type`, type)
    // The window may have asked for its pictures before this one arrived.
    mainWindow?.webContents.send("runner:tools-changed")
  } catch (error) {
    console.error(`Could not cache the picture of ${toolId}: ${String(error)}`)
  }
}

async function ensureToolImage(toolId: string): Promise<void> {
  try {
    const payload = JSON.parse(
      fs.readFileSync(path.join(packDir(toolId), "tool.json"), "utf-8"),
    ) as ToolFile
    const url = payload.tool?.image
    if (typeof url !== "string") return
    await downloadToolImage(toolId, url)
  } catch (error) {
    console.error(`Could not read the picture of ${toolId}: ${String(error)}`)
  }
}

// Cached pictures as data URLs, for every installed tool.
function toolImages(): Record<string, string> {
  const images: Record<string, string> = {}
  for (const tool of listTools()) {
    const imagePath = path.join(dataDir(tool.id), "tool-image")
    if (!fs.existsSync(imagePath)) continue
    let type = "image/png"
    try {
      const stored = fs.readFileSync(`${imagePath}.type`, "utf-8")
      type = stored.split(";")[0].trim() || type
    } catch {
      // Without a recorded type, a PNG is the safe guess.
    }
    images[tool.id] =
      `data:${type};base64,${fs.readFileSync(imagePath).toString("base64")}`
  }
  return images
}

function listTools(): ToolEntry[] {
  let ids: string[]
  try {
    ids = fs
      .readdirSync(toolsRoot(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }
  return ids
    .map((id) => entryFor(id) ?? unreadableEntry(id))
    .sort((left, right) => left.name.localeCompare(right.name))
}

// A tool's identity to a person is its name and version, not the id a pack
// carries: that id comes from whichever server made the pack, so the same tool
// can arrive under different ids (a local portal vs the public one). Importing
// a pack therefore drops any existing copy with the same name and version,
// whatever id it has, while a different version keeps its own entry.
function replaceSameNameAndVersion(
  name: string,
  version: string,
  incomingId: string,
): void {
  let ids: string[]
  try {
    ids = fs.readdirSync(toolsRoot())
  } catch {
    return
  }
  for (const candidate of ids) {
    if (candidate === incomingId) continue
    const entry = entryFor(candidate)
    if (!entry || entry.name !== name || entry.version !== version) continue
    stopSidecar(candidate)
    fs.rmSync(path.join(toolsRoot(), candidate), {
      recursive: true,
      force: true,
    })
  }
}

// One pack per tool: importing replaces what was there, which is how a tool is
// updated to a new version.
function importPack(file: string): ToolEntry {
  const { id, name, version, files } = readPack(file)
  replaceSameNameAndVersion(name, version, id)
  const directory = packDir(id)
  fs.mkdirSync(directory, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, name), content)
  }
  // A pack without an environment must not keep the previous one's.
  if (!("environment.yml" in files)) {
    fs.rmSync(path.join(directory, "environment.yml"), { force: true })
  }
  // The running runner service read the old pack files at startup, so it has
  // to go: the next visit starts one that reads the new ones.
  stopSidecar(id)
  const entry = entryFor(id)
  if (!entry) throw new Error("The pack could not be read back.")
  return entry
}

// Importing reports failures instead of showing a dialog, so the caller decides:
// a blocked dialog while the app starts would wedge it.
function importPackFiles(files: string[]): {
  imported: ToolEntry[]
  failures: string[]
} {
  const imported: ToolEntry[] = []
  const failures: string[] = []
  for (const file of files) {
    try {
      imported.push(importPack(file))
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.error(`Could not import ${file}: ${reason}`)
      failures.push(`${file}: ${reason}`)
    }
  }
  return { imported, failures }
}

function reportImportFailures(failures: string[]): void {
  if (failures.length === 0) return
  // After the window is up, so a startup import cannot block the app.
  setImmediate(() => {
    dialog.showErrorBox(
      "Some tool packs could not be added",
      failures.join("\n\n"),
    )
  })
}

function packArguments(argv: string[]): string[] {
  return argv.filter((argument) =>
    argument.toLowerCase().endsWith(PACK_EXTENSION),
  )
}

function stopSidecar(toolId: string): void {
  const sidecar = sidecars.get(toolId)
  sidecars.delete(toolId)
  if (!sidecar) return
  const { child } = sidecar
  if (child.exitCode !== null) return
  stoppingSidecars.add(toolId)
  child.kill("SIGTERM")
  const timer = setTimeout(() => {
    child.kill("SIGKILL")
  }, SIDECAR_KILL_GRACE_MS)
  timer.unref?.()
  child.once("exit", () => clearTimeout(timer))
}

function stopAllSidecars(): void {
  for (const toolId of [...sidecars.keys()]) {
    stopSidecar(toolId)
  }
}

function fail(title: string, detail: string): void {
  if (shuttingDown) return
  console.error(`[fail] ${title}: ${detail}`)
  closeSplash()
  dialog.showErrorBox(title, detail)
}

// The portal's own mark, so the app looks like the product while it starts.
function logoFile(): string {
  if (process.env.CPG_RUNNER_LOGO) {
    return path.resolve(process.env.CPG_RUNNER_LOGO)
  }
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "logo.png")
  }
  // From source, the bundled main sits either two or three levels below the
  // runner, depending on how it was built; the renderer keeps the same file.
  const here = path.dirname(process.argv[1] ?? "")
  const candidates = [
    path.resolve(here, "../../renderer/src/assets/cpg-logo.png"),
    path.resolve(here, "../../../renderer/src/assets/cpg-logo.png"),
  ]
  return candidates.find((file) => fs.existsSync(file)) ?? candidates[0]
}

// The app icon: the round CPG mark. Packaged, electron-builder embeds it in
// the bundle and this copy serves the window and the dock as well.
function iconFile(): string {
  if (process.env.CPG_RUNNER_ICON) {
    return path.resolve(process.env.CPG_RUNNER_ICON)
  }
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "icon.png")
  }
  return path.resolve(
    path.dirname(process.argv[1] ?? ""),
    "..",
    "..",
    "build",
    "icon.png",
  )
}

// A data: document may not load a file:// image, so the logo travels inline.
function logoDataUrl(): string {
  try {
    return `data:image/png;base64,${fs.readFileSync(logoFile()).toString("base64")}`
  } catch (error) {
    console.error(`Could not read the logo at ${logoFile()}: ${String(error)}`)
    return ""
  }
}

function showSplash(): void {
  if (splashWindow) return
  splashWindow = new BrowserWindow({
    width: 380,
    height: 300,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    backgroundColor: "#ffffff",
    icon: iconFile(),
    webPreferences: { sandbox: true, contextIsolation: true },
  })
  splashWindow.once("ready-to-show", () => splashWindow?.show())
  const watchdog = setTimeout(() => {
    if (!splashWindow) return
    console.error("Splash closed by its watchdog")
    closeSplash()
  }, 60_000)
  watchdog.unref?.()
  splashWindow.on("closed", () => {
    splashWindow = null
  })
  void splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(
      splashHtml(logoDataUrl(), shellDark()),
    )}`,
  )
}

function closeSplash(): void {
  splashWindow?.destroy()
  splashWindow = null
}

function createWindow(): BrowserWindow {
  if (mainWindow) return mainWindow
  const preload = preloadPath()
  if (!fs.existsSync(preload)) {
    // Without the preload the window has no bridge: no pickers, no imports.
    console.error(`Preload script not found at ${preload}`)
  }
  const window = new BrowserWindow({
    width: 1100,
    height: 800,
    // The last run's size and place, when it still fits on a screen; the
    // defaults above apply otherwise.
    ...storedWindowBounds(),
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    icon: iconFile(),
    // The page paints over this; matching it stops a flash while it loads.
    backgroundColor: shellBackground(),
    // Shown once the first page has painted, so the splash stays until then.
    show: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [
        `--cpg-token=${token}`,
        `--cpg-version=${appVersion()}`,
        ...(portalUrl ? [`--cpg-portal=${portalUrl}`] : []),
      ],
    },
  })
  // Remember the size and place for the next launch (macOS keeps the app alive
  // with the window closed, so saving on close covers Cmd+Q too).
  window.on("close", () => saveWindowBounds(window))
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      void shell.openExternal(url)
    }
    return { action: "deny" }
  })
  window.once("ready-to-show", () => {
    closeSplash()
    window.show()
  })
  // Every later navigation (opening another tool) also ends the splash;
  // `ready-to-show` only fires once per window.
  window.webContents.on("did-finish-load", () => {
    closeSplash()
    if (!window.isVisible()) window.show()
  })
  window.on("closed", () => {
    mainWindow = null
    windowLoaded = false
  })
  mainWindow = window
  return window
}

// The one address the window loads: vite in development (hot reload), the
// app's own server otherwise. Both reach the tools through the proxy below.
function appUrl(view: string): string {
  const query = new URLSearchParams({ token })
  if (uiOrigin) query.set("api", `http://127.0.0.1:${uiServerPort}`)
  const base = uiOrigin || `http://127.0.0.1:${uiServerPort}`
  return `${base}${view}?${query.toString()}`
}

// The renderer serves the tool list and the empty state as well as a tool's
// page: every page is a route on the app's one origin, never a sidecar's.
async function showHome(): Promise<void> {
  const window = createWindow()
  const tools = listTools()
  if (tools.length === 0) {
    await window.loadURL(appUrl("/"))
    windowLoaded = true
    closeSplash()
    if (!window.isVisible()) window.show()
    return
  }
  const toolId =
    lastToolId && tools.some((tool) => tool.id === lastToolId)
      ? lastToolId
      : tools[0].id
  await window.loadURL(appUrl(`/t/${toolId}/tool`))
  lastToolId = toolId
  windowLoaded = true
  if (!window.isVisible()) window.show()
}

// -- docker leftovers -----------------------------------------------------
//
// A tool's conda environment lives in a docker named volume, not under the
// tool's data dir, so deleting the pack leaves it behind. The same minimal
// PATH problem applies as in the sidecar (runner/sidecar/cpg_runner/
// docker_cli.py): an app started from Finder or the Start menu may not find
// `docker`, so the known install locations are searched too.

function dockerCandidates(): string[] {
  const home = app.getPath("home")
  if (process.platform === "darwin") {
    return [
      path.join(home, ".docker", "bin", "docker"),
      "/Applications/Docker.app/Contents/Resources/bin/docker",
      "/usr/local/bin/docker",
      "/opt/homebrew/bin/docker",
    ]
  }
  if (process.platform === "win32") {
    const candidates: string[] = []
    for (const base of [
      process.env.ProgramFiles,
      process.env.LOCALAPPDATA,
      process.env.ProgramData,
      "C:\\Program Files",
    ]) {
      if (base) {
        candidates.push(
          path.join(base, "Docker", "Docker", "resources", "bin", "docker.exe"),
        )
      }
    }
    candidates.push(path.join(home, ".docker", "bin", "docker.exe"))
    return candidates
  }
  return [
    path.join(home, ".docker", "bin", "docker"),
    "/usr/bin/docker",
    "/usr/local/bin/docker",
    "/snap/bin/docker",
  ]
}

function resolveDockerBinary(): string {
  const configured = (process.env.DOCKER_BIN ?? "").trim()
  if (configured && (path.isAbsolute(configured) || configured.includes(path.sep))) {
    return configured
  }
  const name =
    configured || (process.platform === "win32" ? "docker.exe" : "docker")
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue
    const candidate = path.join(dir, name)
    if (fs.existsSync(candidate)) return candidate
  }
  for (const candidate of dockerCandidates()) {
    if (fs.existsSync(candidate)) return candidate
  }
  return configured || name
}

function runDocker(args: string[]): Promise<number> {
  const { promise, resolve } = Promise.withResolvers<number>()
  const child = spawn(resolveDockerBinary(), args, { stdio: "ignore" })
  child.on("error", (error) => {
    console.error(`docker ${args.join(" ")} failed: ${String(error)}`)
    resolve(1)
  })
  child.on("exit", (code) => resolve(code ?? 1))
  return promise
}

/**
 * Delete the docker volumes a removed tool owned. Best effort: a missing
 * volume or a stopped docker daemon must never block removing the tool, so
 * failures are logged and the caller carries on.
 *
 * `remainingTools` is how many tools are left after this one is gone: the
 * shared package cache (`cpg-runner-conda-pkgs`, hundreds of MB) is only
 * dropped when no tool can use it any more.
 */
async function removeToolVolumes(
  toolId: string,
  remainingTools: number,
): Promise<void> {
  await runDocker(["volume", "rm", "-f", `cpg-runner-conda-${toolId}`])
  if (remainingTools === 0) {
    await runDocker(["volume", "rm", "-f", "cpg-runner-conda-pkgs"])
  }
}

// Deleting a tool takes its pack, runner data and docker volumes; outputs
// already copied to the output folder stay. The tool's server stops first,
// then the window is told to leave that tool's route, so no poll is left
// answering 502s.
async function removeTool(toolId: string): Promise<void> {
  stopSidecar(toolId)
  fs.rmSync(path.join(toolsRoot(), toolId), { recursive: true, force: true })
  // The pack/data deletion above does not touch docker: remove the tool's
  // conda volume (and, once the last tool is gone, the shared package cache).
  await removeToolVolumes(toolId, listTools().length)
  if (lastToolId === toolId) lastToolId = null
  // The page decides where to go when the tool it shows is the one that went.
  mainWindow?.webContents.send("runner:tool-removed", { toolId })
  mainWindow?.webContents.send("runner:tools-changed")
}

async function showTool(toolId: string): Promise<void> {
  const window = createWindow()
  lastToolId = toolId
  // Move the window onto the tool's route at once and start the runner
  // service in parallel: the page paints (or shows its loading state) while
  // the sidecar boots, and the proxy waits for the sidecar to report ready
  // before forwarding the page's first API calls. A switch therefore never
  // freezes on the tool the user is leaving.
  if (windowLoaded) {
    window.webContents.send("runner:show-tool", { toolId })
  } else {
    await window.loadURL(appUrl(`/t/${toolId}/tool`))
    windowLoaded = true
  }
  try {
    await ensureSidecarWithRetry(toolId)
  } catch (error) {
    console.error(`Could not open ${toolId}: ${String(error)}`)
    // The window is already on the tool's route; its requests answered 502
    // and the page shows the error state, whose Retry boots the sidecar.
  }
  if (!window.isVisible()) window.show()
}

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

// A first launch can outlast the start timeout on a loaded machine. The late
// sidecar has registered itself by then, so one retry opens the tool.
async function ensureSidecarWithRetry(toolId: string): Promise<number> {
  try {
    return await ensureSidecar(toolId)
  } catch (error) {
    console.error(`Retrying the runner service for ${toolId}: ${String(error)}`)
    await delay(5_000)
    return ensureSidecar(toolId)
  }
}

// -- the app's own server ------------------------------------------------

// `/t/<tool>/api/...` is the tool's API; anything else is a page of the app.
const API_PATH = /^\/t\/([^/]+)(\/api\/.*)$/

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
}

/**
 * One origin for the window: the renderer's files, and under `/t/<tool>/` a
 * pass-through to that tool's sidecar. The page therefore never changes origin
 * when it opens another tool, and its API calls are same-origin in the app.
 * Development keeps vite for the files and uses this only for the proxy, which
 * is why the proxy answers CORS.
 */
function startAppServer(): Promise<number> {
  const { promise, resolve, reject } = Promise.withResolvers<number>()
  const server = createServer((request, response) => {
    void handleAppRequest(request, response)
  })
  server.on("upgrade", (request, socket, head) => {
    void handleAppUpgrade(request, socket as Socket, head)
  })
  server.on("error", reject)
  server.listen(0, "127.0.0.1", () => {
    const address = server.address()
    uiServerPort = typeof address === "object" && address ? address.port : 0
    resolve(uiServerPort)
  })
  return promise
}

function allowCors(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin
  response.setHeader("Access-Control-Allow-Origin", origin ?? "*")
  response.setHeader("Vary", "Origin")
  response.setHeader("Access-Control-Allow-Headers", "*")
  response.setHeader("Access-Control-Allow-Methods", "*")
}

async function handleAppRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  allowCors(request, response)
  if (request.method === "OPTIONS") {
    response.writeHead(204)
    response.end()
    return
  }
  const url = new URL(request.url ?? "/", "http://127.0.0.1")
  const match = API_PATH.exec(url.pathname)
  if (match) {
    await proxyRequest(
      request,
      response,
      decodeURIComponent(match[1]),
      `${match[2]}${url.search}`,
    )
    return
  }
  serveRenderer(url.pathname, response)
}

async function proxyRequest(
  request: IncomingMessage,
  response: ServerResponse,
  toolId: string,
  pathAndQuery: string,
): Promise<void> {
  let port: number
  try {
    // Await readiness (with the same retry a switch uses): a first boot on a
    // loaded machine can outlast the start timeout, and the page's first
    // requests now arrive while the sidecar is still starting.
    port = await ensureSidecarWithRetry(toolId)
  } catch (error) {
    response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" })
    response.end(`Could not open ${toolId}: ${String(error)}`)
    return
  }
  const upstream = httpRequest(
    {
      host: "127.0.0.1",
      port,
      path: pathAndQuery,
      method: request.method,
      headers: { ...request.headers, host: `127.0.0.1:${port}` },
    },
    (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.headers,
      )
      upstreamResponse.pipe(response)
    },
  )
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502)
    response.end()
  })
  request.pipe(upstream)
}

async function handleAppUpgrade(
  request: IncomingMessage,
  socket: Socket,
  head: Buffer,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1")
  const match = API_PATH.exec(url.pathname)
  if (!match) {
    socket.destroy()
    return
  }
  const toolId = decodeURIComponent(match[1])
  let port: number
  try {
    port = await ensureSidecarWithRetry(toolId)
  } catch {
    socket.destroy()
    return
  }
  const upstream = netConnect(port, "127.0.0.1", () => {
    const headers = Object.entries(request.headers).filter(
      ([key]) => key.toLowerCase() !== "host",
    )
    const lines = [
      `${request.method} ${match[2]}${url.search} HTTP/1.1`,
      `Host: 127.0.0.1:${port}`,
      ...headers.map(
        ([key, value]) =>
          `${key}: ${Array.isArray(value) ? value.join(", ") : value}`,
      ),
    ]
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`)
    if (head.length > 0) upstream.write(head)
    socket.pipe(upstream).pipe(socket)
  })
  upstream.on("error", () => socket.destroy())
  socket.on("error", () => upstream.destroy())
}

function serveRenderer(pathname: string, response: ServerResponse): void {
  const root = path.resolve(uiDir)
  let file = path.resolve(root, `.${pathname}`)
  if (
    !file.startsWith(root + path.sep) ||
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  ) {
    file = path.join(root, "index.html")
  }
  if (!fs.existsSync(file)) {
    response.writeHead(404)
    response.end()
    return
  }
  response.writeHead(200, {
    "Content-Type":
      CONTENT_TYPES[path.extname(file).toLowerCase()] ??
      "application/octet-stream",
    "Cache-Control": "no-cache",
  })
  fs.createReadStream(file).pipe(response)
}

async function ensureSidecar(toolId: string): Promise<number> {
  const running = sidecars.get(toolId)
  if (running) return running.port
  const inFlight = starting.get(toolId)
  if (inFlight) return inFlight

  const promise = startSidecar(toolId)
  starting.set(toolId, promise)
  try {
    const port = await promise
    return port
  } finally {
    starting.delete(toolId)
  }
}

// The sidecar announces its port on the one line it writes to stdout.
function readReadyPort(line: string): number | null {
  const match = SIDECAR_READY.exec(line)
  if (!match) return null
  let payload: unknown
  try {
    payload = JSON.parse(match[1])
  } catch {
    return null
  }
  if (typeof payload !== "object" || payload === null || !("port" in payload)) {
    return null
  }
  const port = Number(payload.port)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null
  return port
}

function startSidecar(toolId: string): Promise<number> {
  const { promise, resolve, reject } = Promise.withResolvers<number>()
  const resources = packDir(toolId)
  if (!fs.existsSync(path.join(resources, "tool.json"))) {
    reject(new Error("This tool is not installed any more."))
    return promise
  }
  void ensureToolImage(toolId)

  let child: ChildProcess
  try {
    child = spawn(
      sidecarBinaryPath(),
      [
        "--port",
        "0",
        "--data-dir",
        dataDir(toolId),
        "--documents-dir",
        app.getPath("documents"),
        "--resources-dir",
        resources,
      ],
      {
        env: {
          ...process.env,
          CPG_RUNNER_TOKEN: token,
          DOCKER_BIN: process.env.DOCKER_BIN || "docker",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
  } catch (error) {
    reject(error instanceof Error ? error : new Error(String(error)))
    return promise
  }

  const chunks: string[] = []
  sidecarStderr.set(toolId, chunks)
  child.stderr?.setEncoding("utf-8")
  child.stderr?.on("data", (chunk: string) => {
    chunks.push(String(chunk))
    if (chunks.length > 500) chunks.shift()
  })
  child.on("error", (error) => {
    reject(error)
  })

  let buffer = ""
  let ready = false
  const timeout = setTimeout(() => {
    if (ready) return
    // A slow sidecar is not a broken one: report what it said, keep it alive
    // so a late ready still opens the tool.
    const detail = `The runner service did not report ready in time.\n\n${chunks.join("").trim()}`
    console.error(`[${toolId}] ${detail}`)
    reject(new Error(detail))
  }, SIDECAR_START_TIMEOUT_MS)
  timeout.unref?.()

  child.stdout?.setEncoding("utf-8")
  child.stdout?.on("data", (chunk: string) => {
    buffer += String(chunk)
    let newline = buffer.indexOf("\n")
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      newline = buffer.indexOf("\n")
      if (ready) continue
      const port = readReadyPort(line)
      if (port === null) continue
      ready = true
      clearTimeout(timeout)
      sidecars.set(toolId, { child, port })
      resolve(port)
    }
  })

  child.on("exit", (code, signal) => {
    clearTimeout(timeout)
    sidecars.delete(toolId)
    if (stoppingSidecars.delete(toolId)) return
    if (shuttingDown) return
    if (!ready) {
      // What the service said is the only clue to why it refused to start, so
      // it travels with the error to the page.
      reject(
        new Error(
          `The runner service stopped before it was ready (exit ${
            code ?? `signal ${signal}`
          }).\n\n${chunks.join("").trim()}`,
        ),
      )
      return
    }
    fail(
      "CPG Runner stopped",
      `The runner service exited (code ${
        code ?? `signal ${signal}`
      }).\n\n${chunks.join("").trim()}`,
    )
  })
  return promise
}

function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    return ALLOWED_EXTERNAL_SCHEMES[new URL(rawUrl).protocol] === true
  } catch {
    return false
  }
}

function registerIpcHandlers(): void {
  ipcMain.on("runner:ready", () => {
    closeSplash()
    if (mainWindow && !mainWindow.isVisible()) mainWindow.show()
  })

  ipcMain.handle("runner:tools", (): ToolEntry[] => listTools())

  ipcMain.handle("runner:get-portal-url", (): string => portalUrl)

  ipcMain.handle("runner:set-portal-url", (_event, raw: unknown): void => {
    portalUrl = normalizePortalUrl(raw)
    writeSettings({ portal_url: portalUrl })
  })

  // The page repaints itself; the native chrome and the load background have
  // to follow, so the shell never shows a different colour.
  ipcMain.handle(
    "runner:set-shell-theme",
    (_event, payload: { theme?: unknown; resolved?: unknown }): void => {
      const theme = payload?.theme
      if (theme !== "dark" && theme !== "light" && theme !== "system") return
      shellTheme = theme
      nativeTheme.themeSource = theme
      writeSettings({ theme })
      if (payload?.resolved === "dark" || payload?.resolved === "light") {
        mainWindow?.setBackgroundColor(
          payload.resolved === "dark" ? "#0d1b26" : "#f5f9fb",
        )
      }
    },
  )

  ipcMain.handle("runner:update", () => pendingUpdate)
  ipcMain.handle(
    "runner:tool-images",
    (): Record<string, string> => toolImages(),
  )

  // A picture the window saw first (e.g. the tool's own URL) is kept here.
  ipcMain.handle(
    "runner:cache-tool-image",
    (_event, target: { toolId?: unknown; url?: unknown }) => {
      const toolId = target?.toolId
      const url = target?.url
      if (typeof toolId !== "string" || typeof url !== "string") return
      return downloadToolImage(toolId, url)
    },
  )

  ipcMain.handle("runner:portal-tools", () => listPortalTools())

  ipcMain.handle("runner:portal-search", (_event, query: string) =>
    searchPortalTools(query),
  )

  ipcMain.handle(
    "runner:portal-tool",
    (_event, target: { name: string; version?: string }) =>
      portalToolDetail(target.name, target.version),
  )

  ipcMain.handle(
    "runner:add-portal-tool",
    async (_event, target: { name: string; version?: string }) => {
      const entry = await addPortalTool(target)
      await showTool(entry.id)
      return entry
    },
  )

  ipcMain.handle("runner:import-packs", async (): Promise<ToolEntry[]> => {
    const options: OpenDialogOptions = {
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "CPG Runner packs", extensions: [PACK_EXTENSION.slice(1)] },
      ],
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return []
    const { imported, failures } = importPackFiles(result.filePaths)
    if (imported.length > 0) await showTool(imported[0].id)
    if (failures.length > 0) throw new Error(failures.join("\n"))
    return imported
  })

  ipcMain.handle(
    "runner:import-paths",
    async (_event, files: string[]): Promise<ToolEntry[]> => {
      const { imported, failures } = importPackFiles(files)
      if (imported.length > 0) await showTool(imported[0].id)
      if (failures.length > 0) throw new Error(failures.join("\n"))
      return imported
    },
  )

  ipcMain.handle("runner:open-tool", async (_event, toolId: string) => {
    await showTool(toolId)
  })

  ipcMain.handle("runner:remove-tool", async (_event, toolId: string) => {
    await removeTool(toolId)
  })

  ipcMain.handle("runner:home", async () => {
    await showHome()
  })

  ipcMain.handle(
    "runner:pick-files",
    async (
      _event,
      options: { extensions?: string[]; multiple?: boolean } | undefined,
    ): Promise<string[]> => {
      const extensions = (options?.extensions ?? []).map((extension) =>
        extension.replace(/^\./, ""),
      )
      const properties: NonNullable<OpenDialogOptions["properties"]> = [
        "openFile",
      ]
      if (options?.multiple) properties.push("multiSelections")
      const dialogOptions: OpenDialogOptions = {
        properties,
        filters: extensions.length
          ? [{ name: "Supported files", extensions }]
          : undefined,
      }
      const result = mainWindow
        ? await dialog.showOpenDialog(mainWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)
      return result.canceled ? [] : result.filePaths
    },
  )

  ipcMain.handle(
    "runner:pick-directory",
    async (_event, defaultPath?: string): Promise<string | null> => {
      const dialogOptions: OpenDialogOptions = {
        properties: ["openDirectory", "createDirectory"],
        defaultPath,
      }
      const result = mainWindow
        ? await dialog.showOpenDialog(mainWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)
      return result.canceled || result.filePaths.length === 0
        ? null
        : result.filePaths[0]
    },
  )

  ipcMain.handle("runner:reveal", (_event, target: string): void => {
    shell.showItemInFolder(target)
  })

  ipcMain.handle(
    "runner:open-path",
    (_event, target: string): Promise<string> => shell.openPath(target),
  )

  ipcMain.handle(
    "runner:open-external",
    async (_event, url: string): Promise<boolean> => {
      if (!isAllowedExternalUrl(url)) {
        throw new Error(`Blocked external URL: ${url}`)
      }
      await shell.openExternal(url)
      return true
    },
  )

  // A run finished while the window is backgrounded: a desktop notification,
  // thin and never loud (no permission check here, so it fails silently).
  ipcMain.on(
    "runner:notify",
    (_event, payload: { title?: unknown; body?: unknown }): void => {
      const title = typeof payload?.title === "string" ? payload.title : ""
      const body = typeof payload?.body === "string" ? payload.body : ""
      if (title === "" && body === "") return
      try {
        if (Notification.isSupported()) {
          new Notification({ title, body }).show()
        }
      } catch (error) {
        console.error(`Could not show a notification: ${String(error)}`)
      }
    },
  )
}

// -- the application menu -------------------------------------------------

/**
 * A menu without the development conveniences Electron ships by default
 * (Reload, Toggle DevTools). macOS keeps the standard role menus plus a Help
 * entry for the portal; elsewhere there is no menu bar, so the keyboard
 * shortcuts people expect (quit, copy/paste) come from the OS.
 */
function installApplicationMenu(): void {
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null)
    return
  }
  const template: MenuItemConstructorOptions[] = [
    {
      // The app menu: name/about, then the services and quit.
      role: "appMenu",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "CPG Runner help",
          enabled: isAllowedExternalUrl(portalBase()),
          click: () => {
            const url = portalBase()
            if (isAllowedExternalUrl(url)) {
              void shell.openExternal(url)
            }
          },
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// -- the main window's size and place --------------------------------

type WindowBounds = {
  width: number
  height: number
  x?: number
  y?: number
}

// The bounds from the last run, when they still fit on a connected screen.
// A window that would open entirely off-screen falls back to the defaults.
function storedWindowBounds(): WindowBounds | null {
  try {
    const raw = JSON.parse(
      fs.readFileSync(
        path.join(app.getPath("userData"), WINDOW_BOUNDS_FILE),
        "utf-8",
      ),
    ) as Record<string, unknown>
    const width = typeof raw.width === "number" ? raw.width : 0
    const height = typeof raw.height === "number" ? raw.height : 0
    if (width < MIN_WINDOW_WIDTH || height < MIN_WINDOW_HEIGHT) return null
    const x = typeof raw.x === "number" ? raw.x : undefined
    const y = typeof raw.y === "number" ? raw.y : undefined
    if (x !== undefined && y !== undefined) {
      const onScreen = screen.getAllDisplays().some((display) => {
        const area = display.workArea
        return (
          x < area.x + area.width &&
          x + width > area.x &&
          y < area.y + area.height &&
          y + height > area.y
        )
      })
      if (!onScreen) return null
    }
    return {
      width,
      height,
      ...(x !== undefined ? { x } : {}),
      ...(y !== undefined ? { y } : {}),
    }
  } catch {
    // No record yet, or one that cannot be read: use the defaults.
    return null
  }
}

function saveWindowBounds(window: BrowserWindow): void {
  try {
    const bounds = window.getNormalBounds()
    if (bounds.width < MIN_WINDOW_WIDTH || bounds.height < MIN_WINDOW_HEIGHT) {
      return
    }
    const file = path.join(app.getPath("userData"), WINDOW_BOUNDS_FILE)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, `${JSON.stringify(bounds, null, 2)}\n`)
  } catch (error) {
    console.error(`Could not save the window bounds: ${String(error)}`)
  }
}

// A pack opened from the file manager arrives before the app is ready, so it is
// held here and imported once the window can show the result.
const openedBeforeReady: string[] = []

// -- updates --------------------------------------------------------------

type AppUpdate = { version: string; url: string }

// The build the portal announced, kept so a window that loads later still
// learns about it.
let pendingUpdate: AppUpdate | null = null

// The name a platform's app is published under in the portal's artifacts.
function runnerPlatform(): string | null {
  if (process.platform === "darwin") {
    return process.arch === "arm64" ? "mac-arm64" : "mac-x64"
  }
  if (process.platform === "win32") return "win-x64"
  if (process.platform === "linux") return "linux-x64"
  return null
}

// Numeric comparison, part by part: 1.10.0 is newer than 1.9.0, and a suffix
// (1.0.0-beta) counts as 0 so a prerelease never outranks its release.
function isNewerVersion(candidate: string, current: string): boolean {
  const split = (version: string) =>
    version.split(/[.\-+]/).map((part) => Number.parseInt(part, 10) || 0)
  const left = split(candidate)
  const right = split(current)
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const candidatePart = left[index] ?? 0
    const currentPart = right[index] ?? 0
    if (candidatePart !== currentPart) return candidatePart > currentPart
  }
  return false
}

// The download stays on the portal: this app never replaces itself.
async function checkForAppUpdate(): Promise<void> {
  if (portalUrl === "") return
  const platform = runnerPlatform()
  if (platform === null) return
  try {
    const response = await fetch(
      `${portalBase()}/api/v1/runner/app/${platform}/latest`,
      { signal: AbortSignal.timeout(15_000) },
    )
    if (!response.ok) return
    const payload = (await response.json()) as {
      version?: string
      url?: string
    }
    const version = payload.version ?? ""
    const url = payload.url ?? ""
    if (version === "" || url === "") return
    if (!isNewerVersion(version, appVersion())) return
    pendingUpdate = { version, url }
    mainWindow?.webContents.send("runner:update-available", pendingUpdate)
  } catch (error) {
    console.error(`Could not check for an app update: ${String(error)}`)
  }
}

// -- the app's own data ---------------------------------------------------

// One entry per change of the data format: the step that turns version n-1
// into n. Empty while the first format is still the only one.
const DATA_MIGRATIONS: Record<number, () => void> = {}

type DataSchema = { schema_version?: number; last_app_version?: string }

// Tools, runs and settings outlive app updates, so their format is recorded:
// a build that finds a newer format refuses to open tools instead of
// misreading them, and an older one migrates forward before it does.
function ensureDataSchema(): boolean {
  const file = path.join(app.getPath("userData"), "schema.json")
  let stored: DataSchema = {}
  try {
    stored = JSON.parse(fs.readFileSync(file, "utf-8")) as DataSchema
  } catch {
    // No record yet, or one that cannot be read: this build defines the format.
  }
  const storedVersion =
    typeof stored.schema_version === "number" ? stored.schema_version : 0
  if (storedVersion > DATA_SCHEMA_VERSION) {
    fail(
      "CPG Runner is out of date",
      "These tools were created by a newer version of CPG Runner. Download the latest build to use them.",
    )
    app.quit()
    return false
  }
  for (let next = storedVersion + 1; next <= DATA_SCHEMA_VERSION; next += 1) {
    DATA_MIGRATIONS[next]?.()
  }
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(
      file,
      `${JSON.stringify(
        {
          schema_version: DATA_SCHEMA_VERSION,
          last_app_version: appVersion(),
        },
        null,
        2,
      )}\n`,
    )
  } catch (error) {
    console.error(`Could not record the data format: ${String(error)}`)
  }
  return true
}

function start(): void {
  app.on("open-file", (event, filePath) => {
    event.preventDefault()
    if (!filePath.toLowerCase().endsWith(PACK_EXTENSION)) return
    if (!app.isReady()) {
      openedBeforeReady.push(filePath)
      return
    }
    const { imported, failures } = importPackFiles([filePath])
    if (imported.length > 0) void showTool(imported[0].id)
    reportImportFailures(failures)
  })

  app.on("second-instance", (_event, argv) => {
    const packs = packArguments(argv)
    if (packs.length > 0) {
      const { imported, failures } = importPackFiles(packs)
      reportImportFailures(failures)
      if (imported.length > 0) {
        void showTool(imported[0].id)
        return
      }
    }
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  // macOS keeps the app (and its sidecars) alive when every window closes,
  // like any other Cocoa app; the dock icon reopens it. Elsewhere closing the
  // last window quits, and `before-quit` tears the sidecars down.
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      closeSplash()
      app.quit()
    }
  })

  // Clicking the dock icon (or Cmd-Tab) with no window open brings it back.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void showHome()
    }
  })

  app.on("before-quit", () => {
    shuttingDown = true
    closeSplash()
    stopAllSidecars()
  })

  app
    .whenReady()
    .then(async () => {
      installApplicationMenu()
      if (!app.isPackaged && process.platform === "darwin") {
        // The bundle carries the icon; a dev run would show Electron's.
        try {
          app.dock?.setIcon(iconFile())
        } catch (error) {
          console.error(`Could not set the dock icon: ${String(error)}`)
        }
      }
      if (!ensureDataSchema()) return
      // Choices from Settings outrank what this build ships with.
      const savedPortal = readSettings().portal_url
      if (typeof savedPortal === "string" && savedPortal !== "") {
        portalUrl = savedPortal
      }
      shellTheme = storedShellTheme()
      nativeTheme.themeSource = shellTheme
      registerIpcHandlers()
      await startAppServer()
      // The splash covers the first paint only: opening a tool later shows the
      // tool page's own loading state instead.
      const splashTimer = setTimeout(() => showSplash(), 200)
      try {
        const packs = [...openedBeforeReady, ...packArguments(process.argv)]
        openedBeforeReady.length = 0
        if (packs.length > 0) {
          const { imported, failures } = importPackFiles(packs)
          reportImportFailures(failures)
          if (imported.length > 0) {
            await showTool(imported[0].id)
            return
          }
        }
        await showHome()
      } finally {
        clearTimeout(splashTimer)
        closeSplash()
        void checkForAppUpdate()
        setInterval(
          () => void checkForAppUpdate(),
          UPDATE_CHECK_INTERVAL_MS,
        ).unref()
      }
    })
    .catch((error) => {
      fail(
        "CPG Runner could not start",
        error instanceof Error ? error.message : String(error),
      )
    })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  start()
}
