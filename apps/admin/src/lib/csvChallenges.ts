import Papa from "papaparse";

export type ChallengeImportRow = {
  title: string;
  description: string;
  type: "photo" | "video";
  isBonus: boolean;
  sortOrder: number;
  active: boolean;
  points: number;
};

export type CsvParseFailure = {
  ok: false;
  message: string;
  rowErrors: { row: number; message: string }[];
};

export type CsvParseSuccess = {
  ok: true;
  challenges: ChallengeImportRow[];
};

function normalizeKeys(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.trim().toLowerCase().replace(/_/g, "");
    out[key] = String(v ?? "").trim();
  }
  return out;
}

function parseBool(s: string, defaultVal: boolean): boolean {
  const x = s.trim().toLowerCase();
  if (x === "") return defaultVal;
  if (["true", "1", "yes", "y"].includes(x)) return true;
  if (["false", "0", "no", "n"].includes(x)) return false;
  throw new Error(`invalid boolean "${s}"`);
}

function parseIntSafe(s: string, defaultVal: number): number {
  const x = s.trim();
  if (x === "") return defaultVal;
  const n = Number.parseInt(x, 10);
  if (Number.isNaN(n)) throw new Error(`invalid integer "${s}"`);
  return n;
}

/** Expected columns: title (required), description, type, isBonus, sortOrder (or sort), active, points */
export function parseChallengesCsv(csvText: string): CsvParseSuccess | CsvParseFailure {
  if (csvText.charCodeAt(0) === 0xfeff) {
    csvText = csvText.slice(1);
  }
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const fatal = parsed.errors.find((e) => e.type === "Quotes" || e.type === "Delimiter");
  if (fatal) {
    return {
      ok: false,
      message: fatal.message,
      rowErrors: fatal.row != null ? [{ row: fatal.row + 1, message: fatal.message }] : [],
    };
  }

  const rowErrors: { row: number; message: string }[] = [];
  const challenges: ChallengeImportRow[] = [];

  parsed.data.forEach((raw, i) => {
    const rowNum = i + 2;
    if (!raw || typeof raw !== "object") return;
    const n = normalizeKeys(raw);
    const title = n.title ?? "";
    if (!title && Object.values(n).every((v) => v === "")) return;

    try {
      if (!title) {
        rowErrors.push({ row: rowNum, message: "Missing title" });
        return;
      }
      const typeRaw = (n.type || "photo").toLowerCase();
      if (typeRaw !== "photo" && typeRaw !== "video") {
        throw new Error(`type must be photo or video, got "${n.type || ""}"`);
      }
      challenges.push({
        title,
        description: n.description ?? "",
        type: typeRaw,
        isBonus: parseBool(n.isbonus ?? "", false),
        sortOrder: parseIntSafe(n.sortorder || n.sort || "", 0),
        active: parseBool(n.active ?? "", true),
        points: Math.max(0, parseIntSafe(n.points ?? "", 1)),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      rowErrors.push({ row: rowNum, message: msg });
    }
  });

  if (rowErrors.length > 0) {
    return {
      ok: false,
      message: "Some rows could not be parsed.",
      rowErrors,
    };
  }

  if (challenges.length === 0) {
    return {
      ok: false,
      message: "No data rows found. Add a header row (title, …) and at least one challenge.",
      rowErrors: [],
    };
  }

  if (challenges.length > 500) {
    return {
      ok: false,
      message: "Maximum 500 challenges per import.",
      rowErrors: [],
    };
  }

  return { ok: true, challenges };
}
