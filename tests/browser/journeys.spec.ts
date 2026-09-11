import { test, expect } from "@playwright/test";
test("search to sourced profile and copyable setup", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Find the right tools for your agent.",
  );
  await page
    .getByRole("link", { name: "Find programming documentation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Microsoft Learn", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "View Microsoft Learn profile" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Verification history" }),
  ).toBeVisible();
  await page.getByText("Set up in VS Code", { exact: true }).click();
  await expect(page.locator("details[open] pre")).toContainText(
    "https://learn.microsoft.com/api/mcp",
  );
  await page
    .locator("details[open]")
    .getByRole("button", { name: "Copy configuration" })
    .click();
  await expect(
    page.getByText(/Copied|Select and copy the text below/).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("hard constraints and unknown controls remain shareable", async ({
  page,
}) => {
  await page.goto("/?q=Search%20public%20websites%20without%20an%20API%20key");
  await expect(page.getByLabel("Authentication", { exact: true })).toHaveValue(
    "none",
  );
  await expect(
    page.getByRole("heading", { name: "Firecrawl", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Brave Search", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Setup", { exact: true }).selectOption("local");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/setup=local/);
  await expect(
    page.getByRole("heading", { name: "No suitable matches" }),
  ).toBeVisible();
  await page.getByLabel("Include unknown requirements").check();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/includeUnknown=true/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("untrusted search text remains inert and empty results are honest", async ({
  page,
}) => {
  let dialogs = 0;
  page.on("dialog", async (d) => {
    dialogs++;
    await d.dismiss();
  });
  const payload = "<img src=x onerror=alert(1)>";
  await page.goto("/?q=" + encodeURIComponent(payload));
  await expect(page.getByLabel("Describe your task")).toHaveValue(payload);
  await expect(page.locator("main img")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "No suitable matches" }),
  ).toBeVisible();
  expect(dialogs).toBe(0);
  await page
    .getByRole("link", { name: "How checks work", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How checks work",
  );
  await page
    .getByRole("link", { name: "Connect your agent", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Connect your agent to Basic",
  );
});
test("desktop and mobile render evidence and keyboard navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/?q=Find%20programming%20documentation");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Microsoft Learn", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `work/qa-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
