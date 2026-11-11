import { spawn, type ChildProcess } from "node:child_process"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type OpenDialogOptions,
} from "electron"

import { splashHtml } from "./splash"

const SIDECAR_READY = /^CPG_RUNNER_READY (\{.*\})$/
// Generous: the packaged sidecar unpacks itself on first launch, and a machine
// under load can be slow. A wedged sidecar still fails, it just takes longer.
const SIDECAR_START_TIMEOUT_MS = 120_000
const SIDECAR_KILL_GRACE_MS = 3_000
const PACK_EXTENSION = ".cpgpack"

// Only the Docker documentation/download hosts may be opened in the browser.
const EXTERNAL_HOSTS: Record<string, true> = {
  "docs.docker.com": true,
  "www.docker.com": true,
  "get.docker.com": true,
}

export type ToolEntry = {
  id: string
  name: string
  version: string
  description: string | null
}

type ToolRecord = {
  id?: string
  name?: string
  version?: string
  description?: string | null
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

// Development: a separate UI origin (vite, with hot reload) and a data
// directory of its own, so a dev session never touches real installs.
if (process.env.CPG_RUNNER_DATA_DIR) {
  app.setPath("userData", path.resolve(process.env.CPG_RUNNER_DATA_DIR))
}
const uiOrigin = (process.env.CPG_RUNNER_UI_URL || "").replace(/\/+$/, "")
const uiDir =
  process.env.CPG_RUNNER_UI_DIR ||
  path.join(process.resourcesPath, "renderer")

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
// a first run. Passed in by the dev script or the environment.
const portalUrl = (process.env.CPG_RUNNER_PORTAL_URL || "").replace(/\/+$/, "")

const token = randomUUID()

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let shuttingDown = false
let lastToolId: string | null = null
const sidecars = new Map<string, Sidecar>()
const starting = new Map<string, Promise<number>>()
const sidecarStderr = new Map<string, string[]>()

function sidecarBinaryPath(): string {
  return (
    process.env.CPG_RUNNER_SIDECAR ||
    path.join(process.resourcesPath, "sidecar", "cpg-runner")
  )
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

function stderrText(toolId: string): string {
  return (sidecarStderr.get(toolId) ?? []).join("").trim()
}

function readPack(file: string): { id: string; files: Record<string, string> } {
  const document = JSON.parse(fs.readFileSync(file, "utf-8")) as PackDocument
  const id = document.tool?.tool?.id
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("The pack does not name a tool.")
  }
  if (!document.tool?.tool?.name || !document.runner) {
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
  return { id, files }
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
    }
  } catch (error) {
    console.error(`Could not read tool ${toolId}: ${String(error)}`)
    return null
  }
}

function listTools(): ToolEntry[] {
  let ids: string[]
  try {
    ids = fs.readdirSync(toolsRoot(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }
  return ids
    .map(entryFor)
    .filter((entry): entry is ToolEntry => entry !== null)
    .sort((left, right) => left.name.localeCompare(right.name))
}

// One pack per tool: importing replaces what was there, which is how a tool is
// updated to a new version.
function importPack(file: string): ToolEntry {
  const { id, files } = readPack(file)
  const directory = packDir(id)
  fs.mkdirSync(directory, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, name), content)
  }
  // A pack without an environment must not keep the previous one's.
  if (!("environment.yml" in files)) {
    fs.rmSync(path.join(directory, "environment.yml"), { force: true })
  }
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
  return argv.filter((argument) => argument.toLowerCase().endsWith(PACK_EXTENSION))
}

function stopSidecar(toolId: string): void {
  const sidecar = sidecars.get(toolId)
  sidecars.delete(toolId)
  if (!sidecar) return
  const { child } = sidecar
  if (child.exitCode !== null) return
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
  // From source, `dist/electron/main.js` sits three levels below the repository.
  return path.resolve(
    path.dirname(process.argv[1] ?? ""),
    "../../../frontend/public/assets/images/cpg-logo.png",
  )
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
      splashHtml(logoDataUrl()),
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
    icon: iconFile(),
    // Shown once the first page has painted, so the splash stays until then.
    show: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [
        `--cpg-token=${token}`,
        ...(portalUrl ? [`--cpg-portal=${portalUrl}`] : []),
      ],
    },
  })
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
  })
  mainWindow = window
  return window
}

function toolUrl(port: number, view: string): string {
  const query = new URLSearchParams({ token })
  if (uiOrigin) {
    // The renderer is served by vite; the API stays on the sidecar, so the
    // window is told where it is.
    query.set("api", `http://127.0.0.1:${port}`)
    return `${uiOrigin}${view}?${query}`
  }
  return `http://127.0.0.1:${port}${view}?${query}`
}

// The tool list and the empty state come from the packaged renderer. A tool's
// page comes from that tool's sidecar, which is the origin its API lives on.
async function showHome(): Promise<void> {
  const window = createWindow()
  const tools = listTools()
  if (tools.length === 0) {
    if (uiOrigin) {
      await window.loadURL(`${uiOrigin}/?${new URLSearchParams({ token })}`)
    } else {
      await window.loadFile(path.join(uiDir, "index.html"))
    }
    closeSplash()
    if (!window.isVisible()) window.show()
    return
  }
  const toolId =
    lastToolId && tools.some((tool) => tool.id === lastToolId)
      ? lastToolId
      : tools[0].id
  const port = await ensureSidecarWithRetry(toolId)
  await window.loadURL(toolUrl(port, "/"))
  if (!window.isVisible()) window.show()
}

async function showTool(toolId: string): Promise<void> {
  const window = createWindow()
  try {
    const port = await ensureSidecarWithRetry(toolId)
    lastToolId = toolId
    await window.loadURL(toolUrl(port, "/tool"))
  } catch (error) {
    console.error(`Could not open ${toolId}: ${String(error)}`)
    throw error
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
          "--ui-dir",
          uiDir,
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
      if (shuttingDown) return
      if (!ready) {
        reject(
          new Error(
            `The runner service stopped before it was ready (exit ${
              code ?? `signal ${signal}`
            }).`,
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
    const url = new URL(rawUrl)
    if (url.protocol === "https:" && EXTERNAL_HOSTS[url.hostname] === true) {
      return true
    }
    // The portal this app belongs to, where tools are downloaded from.
    return portalUrl !== "" && url.origin === new URL(portalUrl).origin
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
}

// A pack opened from the file manager arrives before the app is ready, so it is
// held here and imported once the window can show the result.
const openedBeforeReady: string[] = []

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

  app.on("window-all-closed", () => {
    closeSplash()
    app.quit()
  })

  app.on("before-quit", () => {
    shuttingDown = true
    closeSplash()
    stopAllSidecars()
  })

  app
    .whenReady()
    .then(async () => {
      if (!app.isPackaged && process.platform === "darwin") {
        // The bundle carries the icon; a dev run would show Electron's.
        try {
          app.dock?.setIcon(iconFile())
        } catch (error) {
          console.error(`Could not set the dock icon: ${String(error)}`)
        }
      }
      registerIpcHandlers()
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
