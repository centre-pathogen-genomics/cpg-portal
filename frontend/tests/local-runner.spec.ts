import { expect, test } from "@playwright/test"
import { firstSuperuser, firstSuperuserPassword } from "./config"

const apiUrl = process.env.VITE_API_URL ?? "http://localhost:8000"

async function adminToken() {
  const response = await fetch(`${apiUrl}/api/v1/login/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      username: firstSuperuser,
      password: firstSuperuserPassword,
    }),
  })
  if (!response.ok) throw new Error(`Admin login failed: ${response.status}`)
  const data = await response.json()
  return data.access_token as string
}

async function createTool(token: string, name: string) {
  const response = await fetch(`${apiUrl}/api/v1/tools/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
      version: "1.0",
      is_default: true,
      command: "true",
      enabled: true,
      params: [],
      targets: [],
    }),
  })
  if (!response.ok) {
    throw new Error(`Tool creation failed: ${response.status}`)
  }
  return (await response.json()) as { id: string; name: string }
}

async function deleteTool(token: string, toolId: string) {
  await fetch(`${apiUrl}/api/v1/tools/${toolId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
}

const tinyZip = new Uint8Array([80, 75, 5, 6, 0, 0, 0, 0])

test("Run locally downloads that tool's pack", async ({ page }) => {
  const token = await adminToken()
  const name = `localrunner${Date.now()}`
  const tool = await createTool(token, name)

  try {
    // The tool page reads the signed-in user from the query cache, so enter
    // through in-app navigation: a full page load straight to /tools/<name>
    // can still render as anonymous while the user query is in flight.
    await page.goto("/")
    await expect(page.getByRole("button", { name: "User" })).toBeVisible()
    const search = page.getByRole("searchbox", { name: "Search the Portal" })
    await search.fill(name)
    await search.press("Enter")
    await expect(page).toHaveURL(new RegExp(`/search/${name}$`))

    const toolCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: name })
      .first()
    await expect(toolCard).toBeVisible()
    await toolCard.getByText(name, { exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/tools/${name}$`))

    // The pack is built for the visitor's own platform, read from the browser.
    const platform = await page.evaluate(() => {
      const ua = navigator.userAgent
      if (ua.includes("Mac")) return "mac-arm64"
      if (ua.includes("Win")) return "win-x64"
      return "linux-x64"
    })

    let packUrl = ""
    await page.route(/\/runner-pack\?/, async (route) => {
      // The Authorization header makes this a preflighted cross-origin
      // request; the real backend answers that and only the download is faked.
      if (route.request().method() !== "GET") {
        await route.fallback()
        return
      }
      packUrl = route.request().url()
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Content-Disposition": `attachment; filename="${name}-1.0.cpgpack"`,
        },
        body: JSON.stringify({
          schema_version: 1,
          tool: { name },
          runner: { platform, docker_arch: "linux-arm64" },
        }),
      })
    })

    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: "Run locally" }).click()
    const download = await downloadPromise

    expect(packUrl).toContain(`platform=${platform}`)
    expect(packUrl).toContain("version=1.0")
    expect(download.suggestedFilename()).toMatch(/\.cpgpack$/)
    // One click, one download: the app is not offered from the tool page.
    await expect(page.getByRole("dialog")).toHaveCount(0)

    await page.unroute(/\/runner-pack\?/)
  } finally {
    await deleteTool(token, tool.id)
  }
})

test("The Local Runner page downloads the app for a chosen platform", async ({
  page,
}) => {
  // Registered before the page asks for the build with HEAD.
  await page.route(/\/api\/v1\/runner\/app\//, async (route) => {
    if (route.request().method() === "HEAD") {
      // Cross-origin, so the synthetic answer needs CORS for both the
      // request and the ETag the page reads back.
      await route.fulfill({
        status: 200,
        headers: {
          etag: '"build1234"',
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "ETag",
        },
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/zip",
      headers: {
        "Content-Disposition": 'attachment; filename="cpg-runner-linux-x64.zip"',
      },
      body: Buffer.from(tinyZip),
    })
  })

  await page.goto("/local-runner")
  await expect(
    page.getByRole("heading", { name: "Run tools on your own computer" }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Local Runner", exact: true }),
  ).toBeVisible()

  await page.getByRole("combobox", { name: "Platform" }).click()
  await expect(page.getByRole("option")).toHaveCount(4)
  await page.getByRole("option", { name: "Linux (x64)" }).click()

  const appLink = page.getByRole("link", { name: "Download CPG Runner" })
  // The link is pinned to the build the server reports, so a cached older
  // build can never be handed out again.
  await expect(appLink).toHaveAttribute(
    "href",
    /\/api\/v1\/runner\/app\/linux-x64\?v=build1234$/,
  )
  await expect(page.getByText("build build1234")).toBeVisible()

  const appDownloadPromise = page.waitForEvent("download")
  await appLink.click()
  const appDownload = await appDownloadPromise
  expect(appDownload.suggestedFilename()).toContain("linux-x64")

  await page.unroute(/\/api\/v1\/runner\/app\//)
})
