import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "@/api/admin";
import { ImportChallengesCsv } from "@/components/ImportChallengesCsv";
import { isoToLocalInput, localInputToIso } from "@/lib/datetime";
import type { AdminSubmission, Challenge, HuntPublic } from "@/types";

export function HuntDetailPage() {
  const { huntId } = useParams<{ huntId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const id = huntId ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "hunt", id],
    queryFn: () => api.getHuntDetail(id),
    enabled: Boolean(id),
  });

  const [huntErr, setHuntErr] = useState("");
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [teamErr, setTeamErr] = useState("");

  const [chTitle, setChTitle] = useState("");
  const [chDesc, setChDesc] = useState("");
  const [chType, setChType] = useState<"photo" | "video">("photo");
  const [chBonus, setChBonus] = useState(false);
  const [chSort, setChSort] = useState(0);
  const [chActive, setChActive] = useState(true);
  const [chPoints, setChPoints] = useState(1);
  const [chErr, setChErr] = useState("");

  const [editHuntName, setEditHuntName] = useState("");
  const [editStarts, setEditStarts] = useState("");
  const [editDur, setEditDur] = useState(10800);
  const [editStatus, setEditStatus] = useState<HuntPublic["status"]>("scheduled");

  const patchHunt = useMutation({
    mutationFn: (body: Parameters<typeof api.patchHunt>[1]) => api.patchHunt(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "hunt", id] });
      void qc.invalidateQueries({ queryKey: ["admin", "hunts"] });
      setHuntErr("");
    },
    onError: (e: Error) => setHuntErr(e.message),
  });

  const deleteHuntMut = useMutation({
    mutationFn: () => api.deleteHunt(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "hunts"] });
      void qc.removeQueries({ queryKey: ["admin", "hunt", id] });
      navigate("/", { replace: true });
    },
  });

  const addTeam = useMutation({
    mutationFn: () =>
      api.createTeam(id, {
        name: teamName.trim(),
        joinCode: joinCode.trim().toUpperCase(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "hunt", id] });
      setTeamName("");
      setJoinCode("");
      setTeamErr("");
    },
    onError: (e: Error) => setTeamErr(e.message),
  });

  const addChallenge = useMutation({
    mutationFn: () =>
      api.createChallenge(id, {
        title: chTitle.trim(),
        description: chDesc,
        type: chType,
        isBonus: chBonus,
        sortOrder: chSort,
        active: chActive,
        points: chPoints,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "hunt", id] });
      setChTitle("");
      setChDesc("");
      setChType("photo");
      setChBonus(false);
      setChSort(0);
      setChActive(true);
      setChPoints(1);
      setChErr("");
    },
    onError: (e: Error) => setChErr(e.message),
  });

  useEffect(() => {
    const h = data?.hunt;
    if (!h) return;
    setEditHuntName(h.name);
    setEditStarts(isoToLocalInput(h.startsAt));
    setEditDur(h.durationSeconds);
    setEditStatus(h.status);
  }, [
    data?.hunt?.id,
    data?.hunt?.name,
    data?.hunt?.startsAt,
    data?.hunt?.durationSeconds,
    data?.hunt?.status,
  ]);

  if (!id) {
    return <p className="error">Missing hunt id.</p>;
  }
  if (isLoading) {
    return <p className="muted">Loading…</p>;
  }
  if (error || !data) {
    return (
      <div>
        <p className="error">
          {error instanceof Error ? error.message : "Failed to load hunt"}
        </p>
        <Link to="/">Back to hunts</Link>
      </div>
    );
  }

  const { hunt, teams, challenges, submissions = [] } = data;

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        <Link to="/">← Hunts</Link>
      </p>
      <h1 style={{ marginBottom: 8 }}>{hunt.name}</h1>
      <p className="muted">
        Slug: <code>{hunt.slug}</code> · id: <code>{hunt.id}</code>
      </p>

      <div className="card">
        <h2>Hunt settings</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setHuntErr("");
            patchHunt.mutate({
              name: editHuntName.trim(),
              startsAt: localInputToIso(editStarts),
              durationSeconds: editDur,
              status: editStatus,
            });
          }}
        >
          <div className="field">
            <label htmlFor="hn">Name</label>
            <input id="hn" value={editHuntName} onChange={(e) => setEditHuntName(e.target.value)} />
          </div>
          <div className="row" style={{ marginBottom: 14 }}>
            <div className="field">
              <label htmlFor="hs">Starts at (local)</label>
              <input
                id="hs"
                type="datetime-local"
                value={editStarts}
                onChange={(e) => setEditStarts(e.target.value)}
              />
            </div>
            <div className="field" style={{ maxWidth: 160 }}>
              <label htmlFor="hd">Duration (sec)</label>
              <input
                id="hd"
                type="number"
                min={60}
                step={60}
                value={editDur}
                onChange={(e) => setEditDur(Number(e.target.value) || 10800)}
              />
            </div>
            <div className="field" style={{ maxWidth: 180 }}>
              <label htmlFor="hst">Status</label>
              <select
                id="hst"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as HuntPublic["status"])}
              >
                <option value="scheduled">scheduled</option>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="finished">finished</option>
              </select>
            </div>
          </div>
          {huntErr ? <p className="error">{huntErr}</p> : null}
          <button type="submit" className="btn" disabled={patchHunt.isPending}>
            {patchHunt.isPending ? "Saving…" : "Save hunt"}
          </button>
        </form>
        <div
          style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: "1px solid var(--border)",
          }}
        >
          <h3 style={{ margin: "0 0 8px", fontSize: "1rem", color: "#fca5a5" }}>
            Danger zone
          </h3>
          <p className="muted" style={{ marginBottom: 12, fontSize: 14 }}>
            Permanently delete this hunt and all teams, challenges, and completion records.
          </p>
          <button
            type="button"
            className="btn btn-danger"
            disabled={deleteHuntMut.isPending}
            onClick={() => {
              if (
                confirm(
                  `Delete “${hunt.name}” forever? This cannot be undone.`
                )
              ) {
                deleteHuntMut.mutate();
              }
            }}
          >
            {deleteHuntMut.isPending ? "Deleting…" : "Delete hunt"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Teams</h2>
        <p className="muted" style={{ marginTop: -8 }}>
          Players join the mobile app with hunt slug <code>{hunt.slug}</code> and one of these codes.
        </p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Join code</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>
                  <code>{t.joinCode}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          style={{ marginTop: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            setTeamErr("");
            if (!teamName.trim() || joinCode.trim().length < 4) {
              setTeamErr("Name and join code (min 4 chars) required.");
              return;
            }
            addTeam.mutate();
          }}
        >
          <div className="row">
            <div className="field">
              <label htmlFor="tn">Team name</label>
              <input id="tn" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="jc">Join code</label>
              <input
                id="jc"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
            </div>
            <button type="submit" className="btn" disabled={addTeam.isPending} style={{ height: 42 }}>
              {addTeam.isPending ? "…" : "Add team"}
            </button>
          </div>
          {teamErr ? <p className="error">{teamErr}</p> : null}
        </form>
      </div>

      <div className="card">
        <h2>Challenges</h2>
        <ImportChallengesCsv
          huntId={id}
          onDone={() => void qc.invalidateQueries({ queryKey: ["admin", "hunt", id] })}
        />
        <ChallengeRows
          challenges={challenges}
          submissions={submissions}
          onInvalidate={() => void qc.invalidateQueries({ queryKey: ["admin", "hunt", id] })}
        />
        <form
          style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}
          onSubmit={(e) => {
            e.preventDefault();
            setChErr("");
            if (!chTitle.trim()) {
              setChErr("Title is required.");
              return;
            }
            addChallenge.mutate();
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: "1rem" }}>New challenge</h3>
          <div className="field">
            <label htmlFor="ct">Title</label>
            <input id="ct" value={chTitle} onChange={(e) => setChTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cd">Description</label>
            <textarea id="cd" rows={2} value={chDesc} onChange={(e) => setChDesc(e.target.value)} />
          </div>
          <div className="row" style={{ marginBottom: 14 }}>
            <div className="field" style={{ maxWidth: 140 }}>
              <label htmlFor="ctype">Type</label>
              <select
                id="ctype"
                value={chType}
                onChange={(e) => setChType(e.target.value as "photo" | "video")}
              >
                <option value="photo">photo</option>
                <option value="video">video</option>
              </select>
            </div>
            <div className="field" style={{ maxWidth: 120 }}>
              <label htmlFor="cso">Sort</label>
              <input
                id="cso"
                type="number"
                value={chSort}
                onChange={(e) => setChSort(Number(e.target.value) || 0)}
              />
            </div>
            <div className="field" style={{ maxWidth: 120 }}>
              <label htmlFor="cpt">Points</label>
              <input
                id="cpt"
                type="number"
                min={0}
                value={chPoints}
                onChange={(e) => setChPoints(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={chBonus}
              onChange={(e) => setChBonus(e.target.checked)}
            />
            Bonus
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={chActive}
              onChange={(e) => setChActive(e.target.checked)}
            />
            Active
          </label>
          {chErr ? <p className="error">{chErr}</p> : null}
          <button type="submit" className="btn" disabled={addChallenge.isPending}>
            {addChallenge.isPending ? "Adding…" : "Add challenge"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ChallengeRows({
  challenges,
  submissions,
  onInvalidate,
}: {
  challenges: Challenge[];
  submissions: AdminSubmission[];
  onInvalidate: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (challenges.length === 0) {
    return <p className="muted">No challenges yet.</p>;
  }

  return (
    <div className="stack">
      {challenges.map((c) => {
        const forChallenge = submissions
          .filter((s) => s.challengeId === c.id)
          .sort((a, b) => {
            if (a.status !== b.status) {
              return a.status === "pending" ? -1 : 1;
            }
            return (
              new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
            );
          });
        return (
          <div
            key={c.id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 12,
              background: "#12182a",
            }}
          >
            {editingId === c.id ? (
              <ChallengeEditor
                challenge={c}
                onDone={() => {
                  setEditingId(null);
                  onInvalidate();
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong>{c.title}</strong>
                    <span className="muted" style={{ marginLeft: 8 }}>
                      {c.type} · sort {c.sortOrder} · {c.points} pts
                      {c.isBonus ? " · bonus" : ""}
                      {!c.active ? " · inactive" : ""}
                    </span>
                    {c.description ? (
                      <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
                        {c.description}
                      </p>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => setEditingId(c.id)}>
                      Edit
                    </button>
                    <ChallengeDeleteButton challengeId={c.id} onDone={onInvalidate} />
                  </div>
                </div>
                <ChallengeSubmissions
                  mediaKind={c.type}
                  submissions={forChallenge}
                  onInvalidate={onInvalidate}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChallengeSubmissions({
  mediaKind,
  submissions,
  onInvalidate,
}: {
  mediaKind: "photo" | "video";
  submissions: AdminSubmission[];
  onInvalidate: () => void;
}) {
  const approveMut = useMutation({
    mutationFn: (id: string) => api.approveCompletion(id),
    onSuccess: () => onInvalidate(),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => api.rejectCompletion(id),
    onSuccess: () => onInvalidate(),
  });
  const busy = approveMut.isPending || rejectMut.isPending;

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 12,
        borderTop: "1px solid var(--border)",
      }}
    >
      <div className="muted" style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        Submissions ({submissions.length})
      </div>
      {submissions.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          No submissions yet.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {submissions.map((s) => (
            <div
              key={s.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: 8,
                background: "#0f1422",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.teamName}</div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: s.status === "pending" ? "#422006" : "#14532d",
                    color: s.status === "pending" ? "#fcd34d" : "#86efac",
                  }}
                >
                  {s.status}
                </span>
              </div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                {new Date(s.submittedAt).toLocaleString()}
              </div>
              {s.viewUrl ? (
                mediaKind === "video" ? (
                  <video
                    src={s.viewUrl}
                    controls
                    style={{ width: "100%", maxHeight: 200, borderRadius: 4 }}
                  />
                ) : (
                  <a href={s.viewUrl} target="_blank" rel="noreferrer">
                    <img
                      src={s.viewUrl}
                      alt=""
                      style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 4 }}
                    />
                  </a>
                )
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  Preview unavailable (check S3 credentials).
                </p>
              )}
              {s.status === "pending" ? (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={busy}
                    onClick={() => approveMut.mutate(s.id)}
                  >
                    {approveMut.isPending ? "…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          `Reject submission from “${s.teamName}”? They can upload again.`
                        )
                      ) {
                        rejectMut.mutate(s.id);
                      }
                    }}
                  >
                    {rejectMut.isPending ? "…" : "Reject"}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChallengeEditor({
  challenge: c,
  onDone,
  onCancel,
}: {
  challenge: Challenge;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(c.title);
  const [description, setDescription] = useState(c.description);
  const [type, setType] = useState<"photo" | "video">(c.type);
  const [isBonus, setIsBonus] = useState(c.isBonus);
  const [sortOrder, setSortOrder] = useState(c.sortOrder);
  const [active, setActive] = useState(c.active);
  const [points, setPoints] = useState(c.points);
  const [err, setErr] = useState("");

  const patch = useMutation({
    mutationFn: () =>
      api.patchChallenge(c.id, {
        title: title.trim(),
        description,
        type,
        isBonus,
        sortOrder,
        active,
        points,
      }),
    onSuccess: () => {
      onDone();
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr("");
        if (!title.trim()) {
          setErr("Title required.");
          return;
        }
        patch.mutate();
      }}
    >
      <div className="field">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label>Description</label>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="field" style={{ maxWidth: 140 }}>
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as "photo" | "video")}>
            <option value="photo">photo</option>
            <option value="video">video</option>
          </select>
        </div>
        <div className="field" style={{ maxWidth: 120 }}>
          <label>Sort</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
          />
        </div>
        <div className="field" style={{ maxWidth: 120 }}>
          <label>Points</label>
          <input
            type="number"
            min={0}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <input type="checkbox" checked={isBonus} onChange={(e) => setIsBonus(e.target.checked)} />
        Bonus
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>
      {err ? <p className="error">{err}</p> : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn-small" disabled={patch.isPending}>
          Save
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ChallengeDeleteButton({
  challengeId,
  onDone,
}: {
  challengeId: string;
  onDone: () => void;
}) {
  const del = useMutation({
    mutationFn: () => api.deleteChallenge(challengeId),
    onSuccess: () => onDone(),
  });

  return (
    <button
      type="button"
      className="btn btn-danger btn-small"
      disabled={del.isPending}
      onClick={() => {
        if (confirm("Delete this challenge? This cannot be undone.")) {
          del.mutate();
        }
      }}
    >
      Delete
    </button>
  );
}
