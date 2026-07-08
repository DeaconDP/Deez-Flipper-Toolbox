import { useEffect, useState } from "react";
import { loadSettings, subscribeSettings, updateSettings } from "../lib/settings";

export function useFeatureHints() {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    loadSettings()
      .then((s) => setEnabledState(s.hints.enabled))
      .catch(() => {});
    return subscribeSettings((s) => setEnabledState(s.hints.enabled));
  }, []);

  const setEnabled = async (next: boolean) => {
    setEnabledState(next);
    await updateSettings({ hints: { enabled: next } });
  };

  const toggle = async () => {
    await setEnabled(!enabled);
  };

  return { enabled, setEnabled, toggle };
}
