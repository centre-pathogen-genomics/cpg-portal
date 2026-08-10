import { expect, test } from "@playwright/test"
import type { ToolPublic, ToolUpdate } from "@/client"
import { firstSuperuser, firstSuperuserPassword } from "./config"
import { createUser } from "./utils/privateApi"
import { randomEmail, randomPassword } from "./utils/random"
import { logInUser } from "./utils/user"

const apiUrl = process.env.VITE_API_URL ?? "http://localhost:8000"
const toolName = "Sleep"

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

async function readTool(name = toolName) {
  const token = await adminToken()
  const response = await fetch(`${apiUrl}/api/v1/tools/name/${name}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Tool read failed: ${response.status}`)
  return (await response.json()) as ToolPublic
}

function updateFromTool(tool: ToolPublic): ToolUpdate {
  return {
    name: tool.name,
    version: tool.version,
    image: tool.image,
    description: tool.description,
    explanation_of_results_markdown: tool.explanation_of_results_markdown,
    url: tool.url,
    github_repo: tool.github_repo,
    docs_url: tool.docs_url,
    paper_doi: tool.paper_doi,
    license: tool.license,
    citation_markdown: tool.citation_markdown,
    badges: tool.badges,
    tags: tool.tags,
    command: tool.command,
    conda_env: tool.conda_env,
    post_install: tool.post_install,
    setup_files: tool.setup_files,
    params: tool.params,
    targets: tool.targets,
    llm_summary_enabled: tool.llm_summary_enabled,
    favourited_count: tool.favourited_count,
    run_count: tool.run_count,
    enabled: tool.enabled,
    status: tool.status,
    installation_log: tool.installation_log,
  }
}

async function updateTool(tool: ToolPublic, body: ToolUpdate) {
  const token = await adminToken()
  const response = await fetch(`${apiUrl}/api/v1/tools/${tool.id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Tool update failed: ${response.status}`)
  return (await response.json()) as ToolPublic
}

test.describe
  .serial("Tools editor", () => {
    let originalTool: ToolPublic

    test.beforeEach(async () => {
      originalTool = await readTool()
    })

    test.afterEach(async () => {
      if (originalTool) {
        const currentTool = await readTool(originalTool.name).catch(
          () => undefined,
        )
        await updateTool(
          currentTool ?? originalTool,
          updateFromTool(originalTool),
        )
      }
    })

    test("Superuser can open the Sleep editor", async ({ page }) => {
      await page.goto(`/tools/${toolName}/edit`)

      await expect(
        page.getByRole("heading", { name: `Edit ${toolName}` }),
      ).toBeVisible()
      await expect(page.getByRole("button", { name: "Save" })).toBeVisible()
    })

    test("Editing a simple field saves and is reflected on the tool page", async ({
      page,
    }) => {
      const description = `Playwright updated description ${Date.now()}`

      await page.goto(`/tools/${toolName}/edit`)
      await page.getByLabel("Description").fill(description)
      await page.getByRole("button", { name: "Save" }).click()

      await expect(page).toHaveURL(new RegExp(`/tools/${toolName}$`))
      await expect(page.getByText("Tool updated successfully")).toBeVisible()
      await expect(page.getByText(description)).toBeVisible()
    })

    test("Adding and removing a param submits the expected data", async ({
      page,
    }) => {
      const paramName = `playwright_param_${Date.now()}`

      await page.goto(`/tools/${toolName}/edit`)
      const editorForm = page.locator("#tool-editor-form")
      await page.getByRole("tab", { name: "Inputs" }).click()
      await page.getByRole("button", { name: "Add param" }).click()
      await editorForm.getByLabel("Name").last().fill(paramName)
      await page.getByRole("button", { name: "Save" }).click()
      await expect(page).toHaveURL(new RegExp(`/tools/${toolName}$`))

      let updatedTool = await readTool()
      expect(
        updatedTool.params?.some((param) => param.name === paramName),
      ).toBe(true)

      await page.goto(`/tools/${toolName}/edit`)
      await page.getByRole("tab", { name: "Inputs" }).click()
      await page.getByRole("button", { name: "Remove param" }).last().click()
      await page.getByRole("button", { name: "Save" }).click()
      await expect(page).toHaveURL(new RegExp(`/tools/${toolName}$`))

      updatedTool = await readTool()
      expect(
        updatedTool.params?.some((param) => param.name === paramName),
      ).toBe(false)
    })
  })

test.describe("Tools editor access control", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Anonymous users cannot access the edit page", async ({ page }) => {
    await page.goto(`/tools/${toolName}/edit`)

    await expect(page).toHaveURL(/\/login/)
    await expect(
      page.getByRole("heading", { name: `Edit ${toolName}` }),
    ).not.toBeVisible()
  })

  test("Non-superusers cannot access the edit page", async ({ page }) => {
    const email = randomEmail()
    const password = randomPassword()
    await createUser({ email, password })
    await logInUser(page, email, password)

    await page.goto(`/tools/${toolName}/edit`)

    await expect(page).not.toHaveURL(new RegExp(`/tools/${toolName}/edit$`))
    await expect(
      page.getByRole("heading", { name: `Edit ${toolName}` }),
    ).not.toBeVisible()
  })
})
