import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTeamDisplayName(team: { division?: string | null; gender?: string | null; name: string }) {
  return team.name;
}
