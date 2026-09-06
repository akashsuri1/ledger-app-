import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  ReactNode,
} from "react";

import {
  SettingsContext,
} from "./settings-context";

import type {
  SettingsContextValue,
} from "./settings-context";

import type {
  AccentColor,
  AppFontFamily,
  AppearanceSettings,
  AppSettings,
  AppSettingsPatch,
  BusinessSettings,
  PrintFontSize,
  PrintSettings,
  ResolvedAppearanceTheme,
  SettingsStorageError,
  TableDensity,
  UiDensity,
} from "../types/settings";

import {
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_BUSINESS_SETTINGS,
  DEFAULT_PRINT_SETTINGS,
  DEFAULT_SETTINGS,
  loadSettings,
  mergeSettings,
  saveSettings,
} from "../utils/settingsStorage";

import type {
  SettingsSaveResult,
} from "../utils/settingsStorage";

interface ProviderState {
  settings: AppSettings;
  storageError:
    SettingsStorageError | null;
  isPersisted: boolean;
}

interface AccentTokens {
  base: string;
  hover: string;
  soft: string;
  foreground: string;
}

const FONT_FAMILIES: Record<
  AppFontFamily,
  string
> = {
  inter:
    'Inter, "Segoe UI", Arial, sans-serif',
  system:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "segoe-ui":
    '"Segoe UI", Arial, sans-serif',
  arial: "Arial, sans-serif",
};

const ACCENT_TOKENS: Record<
  AccentColor,
  AccentTokens
> = {
  blue: {
    base: "#2563eb",
    hover: "#1d4ed8",
    soft: "#dbeafe",
    foreground: "#ffffff",
  },
  indigo: {
    base: "#4f46e5",
    hover: "#4338ca",
    soft: "#e0e7ff",
    foreground: "#ffffff",
  },
  emerald: {
    base: "#047857",
    hover: "#065f46",
    soft: "#d1fae5",
    foreground: "#ffffff",
  },
  slate: {
    base: "#475569",
    hover: "#334155",
    soft: "#e2e8f0",
    foreground: "#ffffff",
  },
};

const DENSITY_SCALE: Record<
  UiDensity,
  string
> = {
  compact: "0.85",
  comfortable: "1",
  spacious: "1.15",
};

const CONTROL_HEIGHT: Record<
  UiDensity,
  string
> = {
  compact: "2rem",
  comfortable: "2.5rem",
  spacious: "2.875rem",
};

const CARD_SPACING: Record<
  UiDensity,
  string
> = {
  compact: "0.875rem",
  comfortable: "1.25rem",
  spacious: "1.75rem",
};

const TABLE_ROW_HEIGHT: Record<
  TableDensity,
  string
> = {
  compact: "2.25rem",
  normal: "2.75rem",
  comfortable: "3.25rem",
};

const PRINT_FONT_SIZE: Record<
  PrintFontSize,
  string
> = {
  small: "9pt",
  normal: "10pt",
  large: "11pt",
};

function resolveTheme(
  settings: AppearanceSettings,
  darkModeQuery:
    MediaQueryList | null,
): ResolvedAppearanceTheme {
  if (settings.theme !== "system") {
    return settings.theme;
  }

  return darkModeQuery?.matches
    ? "dark"
    : "light";
}

function applySettingsToDocument(
  appearance: AppearanceSettings,
  printFontSize: PrintFontSize,
) {
  if (typeof document === "undefined") {
    return () => undefined;
  }

  const root =
    document.documentElement;
  const darkModeQuery =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
      ? window.matchMedia(
          "(prefers-color-scheme: dark)",
        )
      : null;
  const accent =
    ACCENT_TOKENS[
      appearance.accentColor
    ];
  const effectiveFontSize =
    appearance.baseFontSize *
    (appearance.uiScale / 100);

  root.dataset.themePreference =
    appearance.theme;
  root.dataset.theme = resolveTheme(
    appearance,
    darkModeQuery,
  );
  root.dataset.accent =
    appearance.accentColor;
  root.dataset.density =
    appearance.density;
  root.dataset.tableDensity =
    appearance.tableDensity;
  root.dataset.fontFamily =
    appearance.fontFamily;
  root.dataset.uiScale = String(
    appearance.uiScale,
  );
  root.dataset.printFontSize =
    printFontSize;

  root.style.setProperty(
    "--ledger-font-family",
    FONT_FAMILIES[
      appearance.fontFamily
    ],
  );
  root.style.setProperty(
    "--ledger-base-font-size",
    `${appearance.baseFontSize}px`,
  );
  root.style.setProperty(
    "--ledger-ui-scale",
    String(
      appearance.uiScale / 100,
    ),
  );
  root.style.setProperty(
    "--ledger-ui-scale-percent",
    `${appearance.uiScale}%`,
  );
  root.style.setProperty(
    "--ledger-effective-font-size",
    `${effectiveFontSize}px`,
  );
  root.style.setProperty(
    "--ledger-print-font-size",
    PRINT_FONT_SIZE[printFontSize],
  );
  root.style.setProperty(
    "--ledger-density-scale",
    DENSITY_SCALE[
      appearance.density
    ],
  );
  root.style.setProperty(
    "--ledger-control-height",
    CONTROL_HEIGHT[
      appearance.density
    ],
  );
  root.style.setProperty(
    "--ledger-card-spacing",
    CARD_SPACING[
      appearance.density
    ],
  );
  root.style.setProperty(
    "--ledger-table-row-height",
    TABLE_ROW_HEIGHT[
      appearance.tableDensity
    ],
  );
  root.style.setProperty(
    "--ledger-accent",
    accent.base,
  );
  root.style.setProperty(
    "--ledger-accent-hover",
    accent.hover,
  );
  root.style.setProperty(
    "--ledger-accent-soft",
    accent.soft,
  );
  root.style.setProperty(
    "--ledger-accent-foreground",
    accent.foreground,
  );
  root.style.fontFamily =
    "var(--ledger-font-family)";
  root.style.fontSize =
    "var(--ledger-effective-font-size)";
  root.style.colorScheme =
    root.dataset.theme;

  const handleSystemThemeChange = () => {
    if (appearance.theme !== "system") {
      return;
    }

    root.dataset.theme =
      resolveTheme(
        appearance,
        darkModeQuery,
      );
    root.style.colorScheme =
      root.dataset.theme;
  };

  if (
    appearance.theme === "system" &&
    darkModeQuery
  ) {
    darkModeQuery.addEventListener(
      "change",
      handleSystemThemeChange,
    );
  }

  return () => {
    darkModeQuery?.removeEventListener(
      "change",
      handleSystemThemeChange,
    );
  };
}

export function SettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] =
    useState<ProviderState>(() => {
      const loaded = loadSettings();

      return {
        settings: loaded.settings,
        storageError: loaded.error,
        isPersisted:
          loaded.error === null,
      };
    });
  const settingsRef =
    useRef(state.settings);

  const commitSettings =
    useCallback(
      (
        nextSettings: AppSettings,
      ): SettingsSaveResult => {
        settingsRef.current =
          nextSettings;

        const saveResult =
          saveSettings(nextSettings);

        setState({
          settings: nextSettings,
          storageError:
            saveResult.error,
          isPersisted:
            saveResult.ok,
        });

        return saveResult;
      },
      [],
    );

  const updateSettings =
    useCallback(
      (patch: AppSettingsPatch) => {
        return commitSettings(
          mergeSettings(
            settingsRef.current,
            patch,
          ),
        );
      },
      [commitSettings],
    );

  const updateBusinessSettings =
    useCallback(
      (
        patch:
          Partial<BusinessSettings>,
      ) => {
        return updateSettings({
          business: patch,
        });
      },
      [updateSettings],
    );

  const updatePrintSettings =
    useCallback(
      (
        patch: Partial<PrintSettings>,
      ) => {
        return updateSettings({
          print: patch,
        });
      },
      [updateSettings],
    );

  const updateAppearanceSettings =
    useCallback(
      (
        patch:
          Partial<AppearanceSettings>,
      ) => {
        return updateSettings({
          appearance: patch,
        });
      },
      [updateSettings],
    );

  const resetBusinessSettings =
    useCallback(() => {
      return commitSettings({
        ...settingsRef.current,
        business: {
          ...DEFAULT_BUSINESS_SETTINGS,
        },
      });
    }, [commitSettings]);

  const resetPrintSettings =
    useCallback(() => {
      return commitSettings({
        ...settingsRef.current,
        print: {
          ...DEFAULT_PRINT_SETTINGS,
        },
      });
    }, [commitSettings]);

  const resetAppearanceSettings =
    useCallback(() => {
      return commitSettings({
        ...settingsRef.current,
        appearance: {
          ...DEFAULT_APPEARANCE_SETTINGS,
        },
      });
    }, [commitSettings]);

  const resetAllSettings =
    useCallback(() => {
      return commitSettings({
        business: {
          ...DEFAULT_SETTINGS.business,
        },
        print: {
          ...DEFAULT_SETTINGS.print,
        },
        appearance: {
          ...DEFAULT_SETTINGS.appearance,
        },
      });
    }, [commitSettings]);

  const resetSettings =
    resetAllSettings;

  const clearStorageError =
    useCallback(() => {
      setState((current) => ({
        ...current,
        storageError: null,
      }));
    }, []);

  useLayoutEffect(() => {
    return applySettingsToDocument(
      state.settings.appearance,
      state.settings.print.fontSize,
    );
  }, [
    state.settings.appearance,
    state.settings.print.fontSize,
  ]);

  const contextValue =
    useMemo<SettingsContextValue>(
      () => ({
        settings: state.settings,
        storageError:
          state.storageError,
        isPersisted:
          state.isPersisted,
        updateSettings,
        updateBusinessSettings,
        updatePrintSettings,
        updateAppearanceSettings,
        resetBusinessSettings,
        resetPrintSettings,
        resetAppearanceSettings,
        resetSettings,
        resetAllSettings,
        clearStorageError,
      }),
      [
        clearStorageError,
        resetAllSettings,
        resetAppearanceSettings,
        resetBusinessSettings,
        resetPrintSettings,
        resetSettings,
        state.isPersisted,
        state.settings,
        state.storageError,
        updateAppearanceSettings,
        updateBusinessSettings,
        updatePrintSettings,
        updateSettings,
      ],
    );

  return (
    <SettingsContext.Provider
      value={contextValue}
    >
      {children}
    </SettingsContext.Provider>
  );
}
