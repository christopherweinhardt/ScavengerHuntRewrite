import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import * as api from "@/api/admin";
import { parseChallengesCsv } from "@/lib/csvChallenges";

export function ImportChallengesCsv({
  huntId,
  onDone,
}: {
  huntId: string;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [rowErrs, setRowErrs] = useState<{ row: number; message: string }[]>([]);

  const importMut = useMutation({
    mutationFn: (rows: Parameters<typeof api.importChallenges>[1]) =>
      api.importChallenges(huntId, rows),
    onSuccess: (data) => {
      setMsg(`Imported ${data.imported} challenge(s).`);
      setRowErrs([]);
      onDone();
      if (inputRef.current) inputRef.current.value = "";
    },
    onError: (e: Error) => {
      setMsg(e.message);
      setRowErrs([]);
    },
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setMsg("");
    setRowErrs([]);
    const text = await f.text();
    const parsed = parseChallengesCsv(text);
    if (!parsed.ok) {
      setMsg(parsed.message);
      setRowErrs(parsed.rowErrors);
      return;
    }
    importMut.mutate(parsed.challenges);
  }

  function downloadExample() {
    const csv =
      "title,description,type,isBonus,sortOrder,active,points\n" +
      "Find a red door,Take a photo in front of any red door,photo,false,10,true,2\n" +
      "Bonus: mascot selfie,Optional extra credit,photo,true,20,true,5\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "challenges-example.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div
      style={{
        marginBottom: 20,
        paddingBottom: 20,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Import from CSV</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        Header row required. Columns: <code>title</code> (required), <code>description</code>,{" "}
        <code>type</code> (<code>photo</code> or <code>video</code>), <code>isBonus</code>,{" "}
        <code>sortOrder</code> (or <code>sort</code>), <code>active</code>, <code>points</code>.
        Booleans: true/false, yes/no, or 1/0. Up to 500 rows.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => void onFile(e)}
          disabled={importMut.isPending}
        />
        <button type="button" className="btn btn-secondary btn-small" onClick={downloadExample}>
          Download example CSV
        </button>
      </div>
      {importMut.isPending ? <p className="muted" style={{ marginTop: 10 }}>Importing…</p> : null}
      {msg ? (
        <p className={rowErrs.length > 0 || importMut.isError ? "error" : "muted"} style={{ marginTop: 10 }}>
          {msg}
        </p>
      ) : null}
      {rowErrs.length > 0 ? (
        <ul className="error" style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 14 }}>
          {rowErrs.map((r) => (
            <li key={`${r.row}-${r.message}`}>
              Row {r.row}: {r.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
