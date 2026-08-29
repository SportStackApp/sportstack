export interface PersonNameParts {
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  nickname?: string | null;
}

const clean = (value?: string | null) => value?.trim() || "";

/**
 * Current ordinary display-name rule. Preferred name is deliberately stored
 * but remains unwired until the later shared-name change is approved.
 */
export function formatStandardName(person: PersonNameParts): string {
  return [clean(person.firstName), clean(person.lastName)].filter(Boolean).join(" ") || "Unnamed player";
}

/** Formats the short name displayed below a player marker on the pitch. */
export function formatPitchPlayerName(person: PersonNameParts, displayNickname: boolean): string {
  const nickname = clean(person.nickname);
  if (displayNickname && nickname) return nickname;

  const firstName = clean(person.firstName);
  const lastName = clean(person.lastName);
  if (firstName && lastName) return `${firstName.charAt(0).toUpperCase()}. ${lastName}`;
  return lastName || firstName || nickname || "Player";
}
