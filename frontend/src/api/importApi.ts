import { apiRequest } from "./apiClient";
import type { LegacyPreviewDto, LegacyResultDto } from "./types";

export const importApi = {
  preview: (workspace: unknown) => apiRequest<LegacyPreviewDto>("/api/import/legacy/preview", { method: "POST", body: workspace }),
  commit: (workspace: unknown) => apiRequest<LegacyResultDto>("/api/import/legacy/commit", { method: "POST", body: workspace }),
};
