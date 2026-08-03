const collator = new Intl.Collator("en-AU", { numeric: true, sensitivity: "base" });

const formatOrder = (name: string) => {
  const division = name.match(/\bdivision\s+(\d+)/i);
  const junior = name.match(/\b(?:under|u)\s*(\d+)/i);
  const stream = /\bopen\b/i.test(name) ? 0 : /\bwomen\b/i.test(name) ? 1 : 2;

  if (division) return [0, Number(division[1]), stream] as const;
  if (junior) return [1, -Number(junior[1]), stream] as const;
  return [2, 0, stream] as const;
};

/**
 * Orders competition divisions consistently: senior divisions first, Open
 * before Women at the same level, then junior age groups from oldest down.
 */
export const compareCompetitionNames = (left: string, right: string) => {
  const leftOrder = formatOrder(left);
  const rightOrder = formatOrder(right);

  for (let index = 0; index < leftOrder.length; index += 1) {
    const difference = leftOrder[index] - rightOrder[index];
    if (difference !== 0) return difference;
  }
  return collator.compare(left, right);
};

export const compareNames = (left: string, right: string) => collator.compare(left, right);
