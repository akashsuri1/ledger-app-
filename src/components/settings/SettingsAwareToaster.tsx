import {
  Toaster,
} from "sonner";

import {
  useSettings,
} from "../../hooks/useSettings";

export default function SettingsAwareToaster() {
  const { settings } =
    useSettings();

  return (
    <Toaster
      position="top-right"
      theme={
        settings.appearance.theme
      }
      richColors
      closeButton
    />
  );
}
