export const UMPIRE_PORTAL_HOSTNAME = "hb.sportstackapp.com.au";

export const isUmpirePortalHostname = (hostname: string) =>
  hostname.trim().toLowerCase() === UMPIRE_PORTAL_HOSTNAME;
