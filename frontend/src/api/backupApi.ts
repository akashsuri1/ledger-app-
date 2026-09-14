import { apiRequest, apiResponse } from "./apiClient";
import type { RestorePreviewDto, RestoreResultDto } from "./types";

function restoreForm(file: File, passphrase: string, companyName?: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("passphrase", passphrase);
  if (companyName?.trim()) form.append("companyName", companyName.trim());
  return form;
}

export const backupApi = {
  async create(companyId: number, passphrase: string) {
    const response = await apiResponse(`/api/companies/${companyId}/backup`, { method: "POST", body: { passphrase } });
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    return { blob: await response.blob(), fileName: decodeURIComponent(encoded ?? plain ?? "ledgerflow-backup.lfbak") };
  },
  preview: (file: File, passphrase: string) => apiRequest<RestorePreviewDto>("/api/backups/restore/preview", {
    method: "POST", rawBody: restoreForm(file, passphrase),
  }),
  commit: (file: File, passphrase: string, companyName?: string) => apiRequest<RestoreResultDto>("/api/backups/restore/commit", {
    method: "POST", rawBody: restoreForm(file, passphrase, companyName),
  }),
};
