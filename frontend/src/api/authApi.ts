import { apiRequest } from "./apiClient";
import type { BootstrapDto, PreferencePatch, PreferencesDto, UserDto } from "./types";

export const authApi = {
  bootstrap: (signal?: AbortSignal) => apiRequest<BootstrapDto>("/api/me/bootstrap", { signal }),
  register: (input: { name: string; email: string; password: string }) => apiRequest<UserDto>("/api/auth/register", { method: "POST", body: input }),
  login: (input: { email: string; password: string }) => apiRequest<UserDto>("/api/auth/login", { method: "POST", body: input }),
  logout: () => apiRequest<{ message: string }>("/api/auth/logout", { method: "POST", body: {} }),
  forgotPassword: async (email: string) => (await apiRequest<{ message: string }>("/api/auth/forgot-password", { method: "POST", body: { email } })).message,
  resetPassword: async (token: string, password: string) => (await apiRequest<{ message: string }>("/api/auth/reset-password", { method: "POST", body: { token, password } })).message,
  updatePreferences: (patch: PreferencePatch) => apiRequest<PreferencesDto>("/api/me/preferences", { method: "PATCH", body: patch }),
};
