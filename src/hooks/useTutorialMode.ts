import { useEffect, useState } from "react";
import { loadSettings, subscribeSettings, updateSettings } from "../lib/settings";

export function useTutorialMode() {
  const [enabled, setEnabledState] = useState(false);
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    loadSettings()
      .then((s) => {
        setEnabledState(s.tutorial.enabled);
        setCollapsedState(s.tutorial.collapsed);
      })
      .catch(() => {});
    return subscribeSettings((s) => {
      setEnabledState(s.tutorial.enabled);
      setCollapsedState(s.tutorial.collapsed);
    });
  }, []);

  const setEnabled = async (next: boolean) => {
    setEnabledState(next);
    await updateSettings({ tutorial: { enabled: next } });
  };

  const setCollapsed = async (next: boolean) => {
    setCollapsedState(next);
    await updateSettings({ tutorial: { collapsed: next } });
  };

  const toggle = async () => {
    await setEnabled(!enabled);
  };

  const toggleCollapsed = async () => {
    await setCollapsed(!collapsed);
  };

  return { enabled, collapsed, setEnabled, setCollapsed, toggle, toggleCollapsed };
}
