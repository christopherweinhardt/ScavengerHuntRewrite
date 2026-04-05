import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/api/admin";
import { localInputToIso } from "@/lib/datetime";
import type { HuntPublic } from "@/types";

export function HuntsListPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "hunts"],
    queryFn: () => api.listHunts(),
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(10800);
  const [status, setStatus] = useState<HuntPublic["status"]>("scheduled");
  const [formErr, setFormErr] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.createHunt({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        startsAt: localInputToIso(startsAt),
        durationSeconds,
        status,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "hunts"] });
      setName("");
      setSlug("");
      setStartsAt("");
      setFormErr("");
    },
    onError: (e: Error) => setFormErr(e.message),
  });

  const removeHunt = useMutation({
    mutationFn: (hid: string) => api.deleteHunt(hid),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "hunts"] }),
  });

  if (isLoading) {
    return <p className="muted">Loading hunts…</p>;
  }
  if (error) {
    return (
      <p className="error">
        {error instanceof Error ? error.message : "Failed to load hunts"}
      </p>
    );
  }

  const hunts = data?.hunts ?? [];

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Hunts</h1>
      <p className="muted">Select a hunt to manage teams and challenges.</p>

      <div className="card">
        <h2>Create hunt</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormErr("");
            if (!name.trim() || !slug.trim() || !startsAt) {
              setFormErr("Name, slug, and start time are required.");
              return;
            }
            create.mutate();
          }}
        >
          <div className="row" style={{ marginBottom: 14 }}>
            <div className="field">
              <label htmlFor="h-name">Name</label>
              <input
                id="h-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Spring picnic hunt"
              />
            </div>
            <div className="field">
              <label htmlFor="h-slug">Slug</label>
              <input
                id="h-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="spring-2026"
              />
            </div>
          </div>
          <div className="row" style={{ marginBottom: 14 }}>
            <div className="field">
              <label htmlFor="h-start">Starts at (local)</label>
              <input
                id="h-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="field" style={{ maxWidth: 160 }}>
              <label htmlFor="h-dur">Duration (sec)</label>
              <input
                id="h-dur"
                type="number"
                min={60}
                step={60}
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value) || 10800)}
              />
            </div>
            <div className="field" style={{ maxWidth: 180 }}>
              <label htmlFor="h-status">Status</label>
              <select
                id="h-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as HuntPublic["status"])}
              >
                <option value="scheduled">scheduled</option>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="finished">finished</option>
              </select>
            </div>
          </div>
          {formErr ? <p className="error">{formErr}</p> : null}
          <button type="submit" className="btn" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create hunt"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>All hunts</h2>
        {hunts.length === 0 ? (
          <p className="muted">No hunts yet. Create one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {hunts.map((h) => (
                <tr key={h.id}>
                  <td>{h.name}</td>
                  <td>
                    <code>{h.slug}</code>
                  </td>
                  <td>{h.status}</td>
                  <td>
                    <Link to={`/hunts/${h.id}`}>Manage</Link>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-small"
                      disabled={removeHunt.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            `Delete hunt “${h.name}”? All teams, challenges, and completions for this hunt will be removed. This cannot be undone.`
                          )
                        ) {
                          removeHunt.mutate(h.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
