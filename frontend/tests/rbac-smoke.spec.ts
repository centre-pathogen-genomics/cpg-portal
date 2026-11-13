import { expect, test } from "@playwright/test"

import { firstSuperuser } from "./config.ts"

test("rbac page renders and role lifecycle works", async ({ page }) => {
  const roleName = `smoke_role_${Date.now()}`

  await page.goto("/rbac")
  await expect(
    page.getByRole("heading", { name: "Access Control" }),
  ).toBeVisible()
  await expect(page.getByRole("tab", { name: "Roles" })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await expect(page.getByText("researcher").first()).toBeVisible()
  await expect(page.getByText("Default", { exact: true }).first()).toBeVisible()
  await expect(
    page.getByText("files:read", { exact: true }).first(),
  ).toBeVisible()

  await page.getByRole("tab", { name: "Permissions" }).click()
  await expect(
    page.getByText("trakka:send", { exact: true }).first(),
  ).toBeVisible()
  const permissionChip = page.getByText(
    "copy_file: Copy a file (or pair) the user has access to into their own saved files.",
    { exact: true },
  )
  await expect(permissionChip).toBeVisible()
  await permissionChip.hover()
  await expect(page.getByRole("tooltip")).toContainText("saved=True")

  await page.getByRole("tab", { name: "Users" }).click()
  await page.getByRole("combobox", { name: "User" }).click()
  await page.getByPlaceholder("Search users...").fill(firstSuperuser)
  await expect(
    page.getByRole("option").filter({ hasText: firstSuperuser }),
  ).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByRole("tab", { name: "Roles" }).click()
  await page.getByRole("button", { name: "Create role" }).first().click()

  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Name").fill(roleName)
  await dialog.getByLabel("Description").fill("Created by the smoke test")
  await dialog.getByRole("combobox", { name: "Permissions" }).click()
  await expect(
    page.getByRole("option", { name: /Send Newick trees to Trakka/ }),
  ).toBeVisible()
  await page.getByRole("option", { name: "trakka:send" }).click()
  await page.keyboard.press("Escape")
  await dialog.getByRole("button", { name: "Create role" }).click()

  await expect(page.getByText(roleName).first()).toBeVisible()

  await page.getByRole("button", { name: "Delete" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click()
  await expect(page.getByText(roleName)).toHaveCount(0)
})
