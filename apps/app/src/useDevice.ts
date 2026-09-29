import { useEffect, useState } from "react";
import { DeviceApps, System, isAndroid, type InstalledApp } from "./native";
export function useDevice() {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [isHome, setIsHome] = useState(false);
  const [launcher, setLauncher] = useState(false);
  const [notice, setNotice] = useState("");
  const refresh = async () => {
    if (!isAndroid) return;
    try {
      const [list, status, build] = await Promise.all([
        DeviceApps.list(),
        System.getStatus(),
        DeviceApps.buildInfo(),
      ]);
      setApps(list.apps);
      setIsHome(status.roles.some((r) => r.role === "home" && r.held));
      setLauncher(build.launcher);
    } catch {
      setNotice(
        "Device information is unavailable. Try opening Android settings.",
      );
    }
  };
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  const launch = async (app: InstalledApp) => {
    try {
      await DeviceApps.launch({ packageName: app.packageName });
    } catch {
      setNotice("This app could not be opened. It may have been removed.");
    }
  };
  const settings = async () => {
    if (!isAndroid) {
      setNotice("Android settings are available on the device.");
      return;
    }
    try {
      await System.openSettings();
    } catch {
      setNotice("Android settings could not be opened.");
    }
  };
  const makeHome = async () => {
    try {
      await System.requestRole({ role: "home" });
      await refresh();
    } catch {
      setNotice(
        "Home selection was not completed. You can choose a home app in Android settings.",
      );
    }
  };
  return {
    apps,
    isHome,
    launcher,
    notice,
    setNotice,
    launch,
    settings,
    makeHome,
  };
}
