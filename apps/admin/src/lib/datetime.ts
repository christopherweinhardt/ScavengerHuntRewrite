const LOCAL_INPUT_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

/** Convert `<input type="datetime-local">` value to ISO string for the API. */
export function localInputToIso(value: string): string {
  const m = LOCAL_INPUT_RE.exec(value.trim());
  if (!m) throw new Error("Invalid datetime-local value");
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] ? Number(m[6]) : 0;
  const local = new Date(y, month - 1, day, hour, minute, second, 0);
  if (Number.isNaN(local.getTime())) throw new Error("Invalid datetime-local value");
  return local.toISOString();
}

/** Show hunt `startsAt` ISO in datetime-local input (local timezone). */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
