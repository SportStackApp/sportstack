declare const __APP_VERSION__: string;

export const APP_VERSION = __APP_VERSION__;

export type AppEnvironment = "DEV" | "MAIN" | "PROD" | "LOCAL";

export const getAppEnvironment = (): AppEnvironment => {
  if (typeof window === "undefined") return "LOCAL";
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === "dev.sportstackapp.com.au" || hostname.startsWith("dev.")) return "DEV";
  if (hostname === "main.sportstackapp.com.au" || hostname.startsWith("main.")) return "MAIN";
  if (hostname === "sportstack.grampianshockey.com.au") return "PROD";
  return "LOCAL";
};

export const APP_ENVIRONMENT = getAppEnvironment();

export const APP_ENVIRONMENT_CLASS: Record<AppEnvironment, string> = {
  DEV: "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200",
  MAIN: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  PROD: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  LOCAL: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
};
