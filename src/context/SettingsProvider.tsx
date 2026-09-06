import {
  useCallback,
  useLayoutEffect,
  useMemo,
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
  TableDensity,
  UiDensity,
} from "../types/settings";

import {
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_BUSINESS_SETTINGS,
  DEFAULT_PRINT_SETTINGS,
} from "../utils/settingsStorage";

import type {
  BusinessCurrency,
} from "../types/settings";

import {
  useLedger,
} from "../hooks/useLedger";

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
  const {
    activeCompany,
    appearance,
    applySettingsPatch,
    storageError,
    isPersisted,
    clearStorageError,
  } = useLedger();

  const settings = useMemo<AppSettings>(
    () => ({
      business: {
        companyName: activeCompany.name,
        address: activeCompany.address,
        phone: activeCompany.phone,
        gstin: activeCompany.gstin,
        email: activeCompany.email,
        statementHeader:
          activeCompany.settings.statementHeader,
        statementFooter:
          activeCompany.settings.statementFooter,
        currency: "INR" as BusinessCurrency,
      },
      print: {
        ...activeCompany.settings.print,
      },
      appearance: {
        ...appearance,
      },
    }),
    [activeCompany, appearance],
  );

  const updateSettings =
    useCallback(
      (patch: AppSettingsPatch) => {
        return applySettingsPatch(patch);
      },
      [applySettingsPatch],
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
      return applySettingsPatch({
        business: {
          ...DEFAULT_BUSINESS_SETTINGS,
          companyName: activeCompany.name,
        },
      });
    }, [activeCompany.name, applySettingsPatch]);

  const resetPrintSettings =
    useCallback(() => {
      return applySettingsPatch({
        print: {
          ...DEFAULT_PRINT_SETTINGS,
        },
      });
    }, [applySettingsPatch]);

  const resetAppearanceSettings =
    useCallback(() => {
      return applySettingsPatch({
        appearance: {
          ...DEFAULT_APPEARANCE_SETTINGS,
        },
      });
    }, [applySettingsPatch]);

  const resetAllSettings =
    useCallback(() => {
      return applySettingsPatch({
        business: {
          ...DEFAULT_BUSINESS_SETTINGS,
          companyName: activeCompany.name,
        },
        print: {
          ...DEFAULT_PRINT_SETTINGS,
        },
        appearance: {
          ...DEFAULT_APPEARANCE_SETTINGS,
        },
      });
    }, [activeCompany.name, applySettingsPatch]);

  const resetSettings =
    resetAllSettings;

  useLayoutEffect(() => {
    return applySettingsToDocument(
      settings.appearance,
      settings.print.fontSize,
    );
  }, [
    settings.appearance,
    settings.print.fontSize,
  ]);

  const contextValue =
    useMemo<SettingsContextValue>(
      () => ({
        settings,
        storageError,
        isPersisted,
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
        isPersisted,
        settings,
        storageError,
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
