export interface ChronologicalMessage {
  id: string;
  created_at: string;
}

const chronological = <T extends ChronologicalMessage>(left: T, right: T) =>
  left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id);

export const mergeLatestMessages = <T extends ChronologicalMessage>(
  current: T[],
  latest: T[],
  sameChannel: boolean,
) => {
  if (!sameChannel) return [...latest].sort(chronological);

  const merged = new Map(current.map((message) => [message.id, message]));
  latest.forEach((message) => merged.set(message.id, message));
  return [...merged.values()].sort(chronological);
};

export const prependOlderMessages = <T extends ChronologicalMessage>(current: T[], older: T[]) => {
  const merged = new Map([...older, ...current].map((message) => [message.id, message]));
  return [...merged.values()].sort(chronological);
};

export const hasOlderMessagePage = (loadedCount: number, pageSize: number) =>
  pageSize > 0 && loadedCount === pageSize;
