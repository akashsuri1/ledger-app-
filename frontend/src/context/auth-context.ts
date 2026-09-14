import { createContext } from "react";
import type { BootstrapDto, CompanyDto, PreferencePatch, PreferencesDto, UserDto } from "../api/types";

export interface AuthContextValue {
  user: UserDto | null;
  companies: CompanyDto[];
  preferences: PreferencesDto | null;
  loading: boolean;
  error: string | null;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  forgotPassword(email: string): Promise<string>;
  resetPassword(token: string, password: string): Promise<string>;
  refreshBootstrap(): Promise<BootstrapDto | null>;
  updatePreferences(patch: PreferencePatch): Promise<PreferencesDto>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
