export const DEFAULT_ASSOCIATION_TIMEZONE = "Australia/Melbourne";

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const getDateTimeParts = (value: Date, timeZone: string): DateTimeParts => {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);

  const partValue = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: partValue("year"),
    month: partValue("month"),
    day: partValue("day"),
    hour: partValue("hour"),
    minute: partValue("minute"),
    second: partValue("second"),
  };
};

const getTimeZoneOffset = (value: Date, timeZone: string) => {
  const parts = getDateTimeParts(value, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const valueWithoutMilliseconds = Math.trunc(value.getTime() / 1000) * 1000;
  return representedAsUtc - valueWithoutMilliseconds;
};

export const splitZonedDateTime = (
  value: string | null,
  timeZone = DEFAULT_ASSOCIATION_TIMEZONE,
) => {
  if (!value) return { fixture_date: "", game_time: "" };
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return { fixture_date: "", game_time: "" };

  const parts = getDateTimeParts(instant, timeZone);
  return {
    fixture_date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
    game_time: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
  };
};

export const combineZonedDateTime = (
  date: string,
  time: string,
  timeZone = DEFAULT_ASSOCIATION_TIMEZONE,
) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = (time || "00:00").split(":").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  // Calculate the offset twice so dates close to a daylight-saving boundary
  // use the offset that applies to the resulting instant.
  let instant = new Date(wallClockAsUtc);
  instant = new Date(wallClockAsUtc - getTimeZoneOffset(instant, timeZone));
  instant = new Date(wallClockAsUtc - getTimeZoneOffset(instant, timeZone));
  return instant.toISOString();
};
