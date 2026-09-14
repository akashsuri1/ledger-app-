import { apiRequest, apiResponse } from "./apiClient";
import type { AttachmentDto } from "./types";

function endpoint(companyId: number, transactionId: number) {
  return `/api/companies/${companyId}/transactions/${transactionId}/attachment`;
}

export const attachmentApi = {
  upload(companyId: number, transactionId: number, file: File) {
    const form = new FormData();
    form.append("file", file);
    return apiRequest<AttachmentDto>(endpoint(companyId, transactionId), { method: "POST", rawBody: form });
  },
  async download(companyId: number, transactionId: number) {
    const response = await apiResponse(endpoint(companyId, transactionId));
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    return { blob: await response.blob(), fileName: decodeURIComponent(utf8 ?? plain ?? "attachment") };
  },
  remove: (companyId: number, transactionId: number) =>
    apiRequest<{ message: string }>(endpoint(companyId, transactionId), { method: "DELETE", body: {} }),
};
