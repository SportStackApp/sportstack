export const getSafeAppPath = (value: string | null | undefined, fallback: string) => {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  return value;
};

export const buildLoginPath = (returnTo: string) =>
  `/login?returnTo=${encodeURIComponent(getSafeAppPath(returnTo, "/dashboard"))}`;
