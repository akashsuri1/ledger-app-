import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const backendUrl = `http://127.0.0.1:${process.env.M8_BACKEND_PORT ?? 18082}`;
const password = "correct horse battery staple";

async function registerAndCreateCompany(page: Page, companyName: string) {
  const email = `m8-browser-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("M8 Browser Owner");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/company-setup/);
  await page.locator("#initial-company-name").fill(companyName);
  await page.getByRole("button", { name: "Create Company" }).click();
  await expect(page).toHaveURL(/dashboard/);
  return email;
}

async function companyId(page: Page, name: string) {
  const response = await page.request.get(`${backendUrl}/api/me/bootstrap`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as { data: { companies: Array<{ id: number; name: string }> } };
  const company = body.data.companies.find(item => item.name === name);
  expect(company).toBeDefined();
  return company!.id;
}

function legacyBrowserWorkspace() {
  return {
    format: "ledgerflow-backup", version: 1, scope: "full", createdAt: "2026-09-15T10:00:00Z",
    data: {
      companies: [{ id: 900, name: "M8 Legacy Browser Co", address: "", phone: "", gstin: "", email: "",
        createdAt: "2026-01-01T00:00:00Z", settings: {
          statementHeader: "Statement of Account", statementFooter: "", print: {
            defaultTransactionLimit: 25, showRunningBalance: true, showNotes: false,
            showAttachment: true, showBusinessAddress: true, showBusinessPhone: true,
            showBusinessGstin: true, showGeneratedDate: true, showPageNumbers: true,
            paperSize: "A4", orientation: "portrait", fontSize: "normal", customFooter: "",
          },
        },
      }],
      activeCompanyId: 900,
      regions: [{ id: 901, companyId: 900, name: "North" }],
      parties: [{ id: 902, companyId: 900, name: "Legacy Party", phone: "", regionId: 901,
        address: "", gstin: "", notes: "", createdAt: "2026-01-01T00:00:00Z" }],
      transactions: [{ id: 903, companyId: 900, partyId: 902, type: "CREDIT", amount: 5000,
        transactionDate: "2026-09-15", description: "Legacy invoice", notes: "",
        createdAt: "2026-09-15T10:00:00Z" }],
      applicationSettings: { appearance: { fontFamily: "inter", baseFontSize: 16, uiScale: 100,
        density: "comfortable", tableDensity: "normal", accentColor: "blue", theme: "light" } },
    },
  };
}

test("new user registration, first company, and protected dashboard", async ({ page }) => {
  await registerAndCreateCompany(page, "M8 Browser Company");
  await expect(page.getByText("M8 Browser Company").first()).toBeVisible();
});

test("ledger, reports, and attachment browser journey", async ({ page }) => {
  const email = await registerAndCreateCompany(page, "M8 Ledger Co");
  const company = await companyId(page, "M8 Ledger Co");

  await test.step("create Region and Party", async () => {
    await page.goto("/regions");
    await page.getByRole("button", { name: "Add Region" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add Region" });
    await dialog.getByLabel("Region Name *").fill("Punjab");
    await dialog.getByRole("button", { name: "Add Region" }).click();
    await expect(dialog).toBeHidden();
    await page.goto("/parties");
    await page.getByRole("button", { name: "Add Party" }).click();
    const partyDialog = page.getByRole("dialog", { name: "Add Party" });
    await partyDialog.getByLabel("Party Name *").fill("ABC Traders");
    await partyDialog.getByLabel("Region *").selectOption({ label: "Punjab" });
    await partyDialog.getByRole("button", { name: "Save Party" }).click();
    await expect(partyDialog).toBeHidden();
  });
  const partiesResponse = await page.request.get(`${backendUrl}/api/companies/${company}/parties`);
  const parties = await partiesResponse.json() as { data: Array<{ id: number; name: string }> };
  const party = parties.data.find(item => item.name === "ABC Traders")!.id;

  await test.step("create Credit and Debit with a PDF", async () => {
    await page.goto("/transactions");
    await page.getByRole("main").getByRole("button", { name: "Add Transaction" }).click();
    const credit = page.getByRole("dialog", { name: "Add Transaction" });
    await credit.locator("select").first().selectOption(String(party));
    await credit.locator('input[type="number"]').fill("25000");
    await credit.locator('input[type="date"]').fill("2026-09-15");
    await credit.getByPlaceholder("Invoice, payment, purchase...").fill("Invoice 25k");
    await credit.locator('input[type="file"]').setInputFiles({
      name: "invoice.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nM8 browser invoice"),
    });
    await credit.getByRole("button", { name: "Save Transaction" }).click();
    await expect(credit).toBeHidden();
    await page.getByRole("main").getByRole("button", { name: "Add Transaction" }).click();
    const debit = page.getByRole("dialog", { name: "Add Transaction" });
    await debit.locator("select").first().selectOption(String(party));
    await debit.getByRole("button", { name: "Debit" }).click();
    await debit.locator('input[type="number"]').fill("10000");
    await debit.locator('input[type="date"]').fill("2026-09-15");
    await debit.getByPlaceholder("Invoice, payment, purchase...").fill("Payment 10k");
    await debit.getByRole("button", { name: "Save Transaction" }).click();
    await expect(debit).toBeHidden();
  });

  await test.step("verify Dashboard and Party Statement", async () => {
    const dashboardResponse = await page.request.get(`${backendUrl}/api/companies/${company}/dashboard`);
    const dashboard = await dashboardResponse.json() as { data: { netBalance: number } };
    expect(dashboard.data.netBalance).toBe(15000);
    await page.goto("/reports");
    await page.getByRole("combobox", { name: "Party", exact: true }).selectOption(String(party));
    await expect(page.getByRole("heading", { name: "ABC Traders" })).toBeVisible();
    const statementResponse = await page.request.get(`${backendUrl}/api/companies/${company}/reports/party-statement?partyId=${party}`);
    const statement = await statementResponse.json() as { data: { openingBalance: number; totalCredit: number; totalDebit: number; closingBalance: number } };
    expect(statement.data.closingBalance).toBe(statement.data.openingBalance + statement.data.totalCredit - statement.data.totalDebit);
    expect(statement.data.closingBalance).toBe(15000);
    const regionResponse = await page.request.get(`${backendUrl}/api/companies/${company}/reports/regions`);
    const regionReport = await regionResponse.json() as { data: { totals: { netBalance: number; transactionCount: number } } };
    expect(regionReport.data.totals.netBalance).toBe(15000);
    expect(regionReport.data.totals.transactionCount).toBe(2);
  });

  const transactionResponse = await page.request.get(`${backendUrl}/api/companies/${company}/transactions`);
  const transactionPage = await transactionResponse.json() as { data: Array<{ id: number; description: string }> };
  const creditId = transactionPage.data.find(item => item.description === "Invoice 25k")!.id;
  const debitId = transactionPage.data.find(item => item.description === "Payment 10k")!.id;
  const originalPdf = Buffer.from("%PDF-1.4\nM8 browser invoice");

  await test.step("download, replace, and remove the attachment", async () => {
    await page.goto("/transactions");
    const invoiceRow = page.getByRole("row").filter({ hasText: "Invoice 25k" });
    await invoiceRow.getByRole("button", { name: "View transaction" }).click();
    const details = page.getByRole("dialog", { name: "Transaction Details" });
    const attachmentDownload = page.waitForEvent("download");
    await details.getByRole("button", { name: /Download attachment/ }).click();
    const downloaded = await attachmentDownload;
    expect(downloaded.suggestedFilename()).toBe("invoice.pdf");
    const savedPdf = test.info().outputPath("downloaded-invoice.pdf");
    await downloaded.saveAs(savedPdf);
    expect(readFileSync(savedPdf)).toEqual(originalPdf);
    await details.getByRole("button", { name: "Close dialog" }).click();

    await invoiceRow.getByRole("button", { name: "Edit transaction" }).click();
    const edit = page.getByRole("dialog", { name: "Edit Transaction" });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]);
    await edit.locator('input[type="file"]').setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: png });
    await edit.getByRole("button", { name: "Save Changes" }).click();
    await expect(edit).toBeHidden();
    const replacedResponse = await page.request.get(`${backendUrl}/api/companies/${company}/transactions/${creditId}/attachment`);
    expect(replacedResponse.ok()).toBeTruthy();
    expect(Buffer.from(await replacedResponse.body())).toEqual(png);

    await invoiceRow.getByRole("button", { name: "Edit transaction" }).click();
    const remove = page.getByRole("dialog", { name: "Edit Transaction" });
    await remove.getByRole("button", { name: "Remove" }).click();
    await remove.getByRole("button", { name: "Save Changes" }).click();
    await expect(remove).toBeHidden();
    const missingResponse = await page.request.get(`${backendUrl}/api/companies/${company}/transactions/${creditId}/attachment`);
    expect(missingResponse.status()).toBe(404);

    const paymentRow = page.getByRole("row").filter({ hasText: "Payment 10k" });
    await paymentRow.getByRole("button", { name: "Edit transaction" }).click();
    const paymentEdit = page.getByRole("dialog", { name: "Edit Transaction" });
    await paymentEdit.locator('input[type="file"]').setInputFiles({
      name: "payment.pdf", mimeType: "application/pdf", buffer: originalPdf,
    });
    await paymentEdit.getByRole("button", { name: "Save Changes" }).click();
    await expect(paymentEdit).toBeHidden();
  });

  await test.step("change persisted company settings before backup", async () => {
    await page.goto("/settings");
    await page.getByLabel("Statement heading").fill("M8 Verified Statement");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("No unsaved changes")).toBeVisible();
  });

  let backupPath = "";
  await test.step("encrypted backup and restore as a new company", async () => {
    await page.goto("/backup");
    const passphrase = "M8 safe backup passphrase";
    await page.getByLabel("Backup passphrase").fill(passphrase);
    await page.getByLabel("Confirm passphrase").fill(passphrase);
    const backupDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download encrypted backup" }).click();
    const archive = await backupDownload;
    backupPath = test.info().outputPath("company.lfbak");
    await archive.saveAs(backupPath);
    expect(readFileSync(backupPath).length).toBeGreaterThan(100);
    await page.locator('input[type="file"][accept*=".lfbak"]').setInputFiles(backupPath);
    await page.getByPlaceholder("Backup passphrase").fill(passphrase);
    await page.getByRole("button", { name: "Validate backup" }).click();
    await expect(page.getByRole("heading", { name: "Valid encrypted backup" })).toBeVisible();
    await page.getByPlaceholder(/optional new name/).fill("M8 Restored Co");
    await page.getByRole("button", { name: "Restore as new company" }).click();
    await expect(page.getByText("M8 Restored Co restored as a new company")).toBeVisible();
    const restored = await companyId(page, "M8 Restored Co");
    const restoredDashboard = await page.request.get(`${backendUrl}/api/companies/${restored}/dashboard`);
    const restoredValue = await restoredDashboard.json() as { data: { netBalance: number } };
    expect(restoredValue.data.netBalance).toBe(15000);
    const restoredTransactions = await page.request.get(`${backendUrl}/api/companies/${restored}/transactions`);
    const restoredPage = await restoredTransactions.json() as { data: Array<{ id: number; description: string }> };
    const restoredPayment = restoredPage.data.find(item => item.description === "Payment 10k")!.id;
    const restoredAttachment = await page.request.get(`${backendUrl}/api/companies/${restored}/transactions/${restoredPayment}/attachment`);
    expect(Buffer.from(await restoredAttachment.body())).toEqual(originalPdf);
    const restoredSettings = await page.request.get(`${backendUrl}/api/companies/${restored}/settings`);
    expect((await restoredSettings.json() as { data: { statementHeader: string } }).data.statementHeader)
      .toBe("M8 Verified Statement");
  });

  await test.step("switch among source, restored, and empty companies", async () => {
    const switcher = page.locator('button[aria-haspopup="menu"]');
    await switcher.click();
    await page.getByRole("menuitemradio", { name: /M8 Restored Co/ }).click();
    await expect(switcher).toContainText("M8 Restored Co");
    await switcher.click();
    await page.getByRole("menuitem", { name: "Add company" }).click();
    const create = page.getByRole("dialog", { name: "Add company" });
    await create.locator("#company-name").fill("M8 Empty Co");
    await create.getByRole("button", { name: "Create company" }).click();
    await expect(switcher).toContainText("M8 Empty Co");
    await page.goto("/parties");
    await expect(page.getByText("ABC Traders")).toHaveCount(0);
    await switcher.click();
    await page.getByRole("menuitemradio", { name: /M8 Ledger Co/ }).click();
    await expect(switcher).toContainText("M8 Ledger Co");
    await expect(page.getByText("ABC Traders").first()).toBeVisible();

    await page.route(`**/api/companies/${company}/parties*`, async route => {
      await new Promise(resolve => setTimeout(resolve, 800));
      await route.continue();
    });
    await switcher.click();
    await page.getByRole("menuitemradio", { name: /M8 Restored Co/ }).click();
    await switcher.click();
    await page.getByRole("menuitemradio", { name: /M8 Empty Co/ }).click();
    await page.waitForTimeout(1000);
    await expect(switcher).toContainText("M8 Empty Co");
    await expect(page.getByText("ABC Traders")).toHaveCount(0);
    await page.unroute(`**/api/companies/${company}/parties*`);
    await switcher.click();
    await page.getByRole("menuitemradio", { name: /M8 Ledger Co/ }).click();
  });

  await test.step("logout blocks protected routes and login selects an authorized company", async () => {
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/login/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/select-company/);
    await page.locator("article").filter({ hasText: "M8 Ledger Co" })
      .getByRole("button", { name: "Open company" }).click();
    await expect(page).toHaveURL(/dashboard/);
  });

  await test.step("preview and import legacy browser data", async () => {
    await page.evaluate(value => localStorage.setItem("ledgerflow-workspace", JSON.stringify(value)),
      legacyBrowserWorkspace());
    await page.goto("/backup");
    await expect(page.getByRole("heading", { name: "Legacy browser ledger detected" })).toBeVisible();
    const previewResponse = page.waitForResponse(response => response.url().includes("/api/import/legacy/preview"));
    await page.getByRole("button", { name: "Preview browser import" }).click();
    const inspected = await previewResponse;
    expect(inspected.ok(), await inspected.text()).toBeTruthy();
    await page.getByRole("button", { name: "Import into backend" }).click();
    await expect(page.getByText("Browser ledger imported. The original browser data was retained.")).toBeVisible();
    const legacyId = await companyId(page, "M8 Legacy Browser Co");
    const legacyDashboard = await page.request.get(`${backendUrl}/api/companies/${legacyId}/dashboard`);
    const legacyValue = await legacyDashboard.json() as { data: { netBalance: number } };
    expect(legacyValue.data.netBalance).toBe(5000);
    const retained = await page.evaluate(() => ({
      source: localStorage.getItem("ledgerflow-workspace"),
      completed: localStorage.getItem("ledgerflow-legacy-import-completed"),
    }));
    expect(retained.source).toBeTruthy();
    expect(retained.completed).toBe("true");
  });

  await test.step("delete transaction and party and verify recalculation and attachment cleanup", async () => {
    await page.goto("/transactions");
    const creditRow = page.getByRole("row").filter({ hasText: "Invoice 25k" });
    await creditRow.getByRole("button", { name: "Delete transaction" }).click();
    await page.getByRole("dialog", { name: "Delete Transaction?" })
      .getByRole("button", { name: "Delete Transaction" }).click();
    const recalculated = await page.request.get(`${backendUrl}/api/companies/${company}/dashboard`);
    expect((await recalculated.json() as { data: { netBalance: number } }).data.netBalance).toBe(-10000);
    await page.goto("/parties");
    const partyRow = page.getByRole("row").filter({ hasText: "ABC Traders" });
    await partyRow.getByRole("button", { name: "Delete party" }).click();
    await page.getByRole("dialog", { name: "Delete Party?" })
      .getByRole("button", { name: /Delete Party/ }).click();
    await expect(page.getByText("ABC Traders")).toHaveCount(0);
    const deletedAttachment = await page.request.get(`${backendUrl}/api/companies/${company}/transactions/${debitId}/attachment`);
    expect(deletedAttachment.status()).toBe(404);
  });
});

test("recovers visibly when an attachment upload or backend request fails", async ({ page }) => {
  await registerAndCreateCompany(page, "M8 Recovery Co");
  const company = await companyId(page, "M8 Recovery Co");
  await page.goto("/regions");
  await page.getByRole("button", { name: "Add Region" }).click();
  const regionDialog = page.getByRole("dialog", { name: "Add Region" });
  await regionDialog.getByLabel("Region Name *").fill("Recovery Region");
  await regionDialog.getByRole("button", { name: "Add Region" }).click();
  await expect(regionDialog).toBeHidden();
  await page.goto("/parties");
  await page.getByRole("button", { name: "Add Party" }).click();
  const partyDialog = page.getByRole("dialog", { name: "Add Party" });
  await partyDialog.getByLabel("Party Name *").fill("Recovery Party");
  await partyDialog.getByLabel("Region *").selectOption({ label: "Recovery Region" });
  await partyDialog.getByRole("button", { name: "Save Party" }).click();
  await expect(partyDialog).toBeHidden();
  const recoveryPartiesResponse = await page.request.get(`${backendUrl}/api/companies/${company}/parties`);
  const recoveryParties = await recoveryPartiesResponse.json() as { data: Array<{ id: number; name: string }> };
  const recoveryParty = recoveryParties.data.find(item => item.name === "Recovery Party")!.id;

  await page.route(`**/api/companies/${company}/transactions/*/attachment`, async route => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({
        error: { code: "ATTACHMENT_STORAGE_UNAVAILABLE", message: "Simulated attachment outage." },
      }) });
    } else await route.continue();
  });
  await page.goto("/transactions");
  await page.getByRole("main").getByRole("button", { name: "Add Transaction" }).click();
  const transaction = page.getByRole("dialog", { name: "Add Transaction" });
  await transaction.locator("select").first().selectOption(String(recoveryParty));
  await transaction.locator('input[type="number"]').fill("321");
  await transaction.locator('input[type="date"]').fill("2026-09-16");
  await transaction.getByPlaceholder("Invoice, payment, purchase...").fill("Saved before failed attachment");
  await transaction.locator('input[type="file"]').setInputFiles({
    name: "unavailable.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nrecovery"),
  });
  await transaction.getByRole("button", { name: "Save Transaction" }).click();
  await expect(transaction).toBeHidden();
  await expect(page.getByText(/Transaction created, but its attachment was not saved: Simulated attachment outage/)).toBeVisible();
  const dashboard = await page.request.get(`${backendUrl}/api/companies/${company}/dashboard`);
  expect((await dashboard.json() as { data: { netBalance: number } }).data.netBalance).toBe(321);

  await page.route(`${backendUrl}/api/**`, route => route.abort("connectionrefused"));
  await page.reload();
  await expect(page.getByRole("alert")).toHaveText("LedgerFlow could not reach the backend.");
});
