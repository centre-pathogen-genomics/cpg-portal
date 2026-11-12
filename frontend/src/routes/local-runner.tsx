import { createFileRoute, redirect } from "@tanstack/react-router"
import { Download, LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { UsersService } from "@/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isLoggedIn } from "@/hooks/useAuth"
import { hasPermission } from "@/lib/permissions"
import {
  PLATFORMS,
  type Platform,
  detectPlatform,
  runnerAppUrl,
} from "@/lib/runner-platform"
import MainMenuBar from "../components/Common/MainMenuBar"

export const Route = createFileRoute("/local-runner")({
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
        search: { redirect: window.location.pathname },
      })
    }
    const response = await UsersService.readUserMe({ throwOnError: true })
    if (!hasPermission(response.data, "runner:download")) {
      throw redirect({ to: "/" })
    }
  },
  component: LocalRunner,
  head: () => ({ meta: [{ title: "Local Runner | CPG Portal" }] }),
})

function LocalRunner() {
  const [platform, setPlatform] = useState<Platform>(detectPlatform)
  // Identity of the build behind the app URL. Pinning the link to it makes a
  // download always the current build, even when an older one was cached.
  // `null` while the platform's build is being checked; `""` when the server
  // does not name one; a 404 means that platform is not published yet.
  const [appBuild, setAppBuild] = useState<string | null>(null)
  const [appMissing, setAppMissing] = useState(false)
  const appUrl = runnerAppUrl(platform)

  useEffect(() => {
    let cancelled = false
    setAppBuild(null)
    setAppMissing(false)
    fetch(appUrl, { method: "HEAD" })
      .then((response) => {
        const etag = response.headers.get("etag") ?? ""
        if (!cancelled && !response.ok && !etag) setAppMissing(true)
        return etag
      })
      .then((etag) => {
        if (!cancelled) setAppBuild(etag.replace(/"/g, ""))
      })
      .catch(() => {
        // Without the build, a fresh URL per attempt still beats a cache hit on
        // an older release: the server revalidates it and answers 304.
        if (!cancelled) setAppBuild(`t${Date.now()}`)
      })
    return () => {
      cancelled = true
    }
  }, [appUrl])

  const appHref = appBuild ? `${appUrl}?v=${appBuild}` : appUrl

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <MainMenuBar />
      <main className="flex-1 overflow-auto px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-4">
          <section>
            <h1 className="mb-2 text-3xl font-bold">
              Run tools on your own computer
            </h1>
            <h2 className="text-lg">
              CPG Runner, the desktop app behind every local tool
            </h2>
          </section>

          <p>
            The Portal normally runs a tool on its servers. CPG Runner runs the
            same tool, at the same version, on your own machine: The Portal
            still lists the tools and their settings, but the analysis and the
            files it reads stay on the computer you are sitting at. That suits
            data that cannot leave your network, and machines with more CPU than
            a shared server has free.
          </p>

          <p>
            CPG Runner needs{" "}
            <a
              href="https://docs.docker.com/desktop/setup/install/"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Docker Desktop
            </a>{" "}
            installed and running. It is one download for every tool: each tool
            arrives separately as a small <strong>pack</strong>, and the app
            installs that tool's environment the first time you open it.
          </p>

          <section className="grid gap-2 rounded-md border p-4">
            <h3 className="text-lg font-semibold">1. Download CPG Runner</h3>
            <p className="text-muted-foreground text-sm">
              Pick the platform of the computer that will run the tools, then
              download the app. You only need to do this once, and again when a
              new build is released.
            </p>
            <div className="grid gap-2 py-2">
              <Label htmlFor="local-runner-platform">Platform</Label>
              <Select
                value={platform}
                onValueChange={(value) => setPlatform(value as Platform)}
              >
                <SelectTrigger id="local-runner-platform" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {appMissing ? (
              <p className="text-muted-foreground text-sm">
                No CPG Runner build is published for{" "}
                {
                  PLATFORMS.find((option) => option.value === platform)
                    ?.label
                }{" "}
                yet.
              </p>
            ) : (
              <Button variant="outline" asChild>
                <a href={appHref} download>
                  {appBuild === null ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Download />
                  )}
                  Download CPG Runner
                </a>
              </Button>
            )}
            {appBuild && (
              <span className="text-muted-foreground font-mono text-xs">
                build {appBuild}
              </span>
            )}
          </section>

          <section className="grid gap-2 rounded-md border p-4">
            <h3 className="text-lg font-semibold">2. Download a tool pack</h3>
            <p className="text-muted-foreground text-sm">
              Open any tool in The Portal and choose <strong>Run locally</strong>
              . That downloads the pack: a few kilobytes with the tool, its
              version and its settings, built for the platform you downloaded
              the app for.
            </p>
          </section>

          <section className="grid gap-2 rounded-md border p-4">
            <h3 className="text-lg font-semibold">3. Open the pack</h3>
            <p className="text-muted-foreground text-sm">
              Double-click the downloaded <code>.cpgpack</code>, or drop it on
              the CPG Runner window, to add the tool to the app. The tool then
              appears in its sidebar, ready to run with the settings you know
              from The Portal.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-lg font-semibold">
              Where do the results go?
            </h3>
            <p>
              Outputs are written to the folder you pick in the app, which
              defaults to <code>Documents/CPG Runs</code>. Nothing is uploaded
              back to The Portal, so treat a local run like any other analysis
              on that machine: the results are yours to share.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}

export default LocalRunner
