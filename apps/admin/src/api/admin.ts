import { adminFetch } from "@/api/client";
import type { AdminSubmission, AdminTeam, Challenge, HuntPublic } from "@/types";

export function listHunts() {
  return adminFetch<{ hunts: HuntPublic[] }>("/admin/hunts");
}

export function getHuntDetail(huntId: string) {
  return adminFetch<{
    hunt: HuntPublic;
    teams: AdminTeam[];
    challenges: Challenge[];
    submissions: AdminSubmission[];
  }>(`/admin/hunts/${huntId}`);
}

export function createHunt(body: {
  name: string;
  slug: string;
  startsAt: string;
  durationSeconds: number;
  status?: HuntPublic["status"];
}) {
  return adminFetch<{ hunt: HuntPublic }>("/admin/hunts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchHunt(
  huntId: string,
  body: Partial<{
    status: HuntPublic["status"];
    startsAt: string;
    durationSeconds: number;
    name: string;
  }>
) {
  return adminFetch<{ hunt: HuntPublic }>(`/admin/hunts/${huntId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteHunt(huntId: string) {
  return adminFetch<{ ok: boolean }>(`/admin/hunts/${huntId}`, {
    method: "DELETE",
  });
}

export function createTeam(
  huntId: string,
  body: { name: string; joinCode: string }
) {
  return adminFetch<{ team: AdminTeam }>(
    `/admin/hunts/${huntId}/teams`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export function deleteTeam(huntId: string, teamId: string) {
  return adminFetch<{ ok: boolean }>(`/admin/hunts/${huntId}/teams/${teamId}`, {
    method: "DELETE",
  });
}

export function patchTeamScore(
  teamId: string,
  body: Partial<{
    scoreAdjustment: number;
    totalScore: number;
  }>
) {
  return adminFetch<{ team: AdminTeam }>(`/admin/teams/${teamId}/score`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function createChallenge(
  huntId: string,
  body: {
    title: string;
    description?: string;
    type?: "photo" | "video";
    isBonus?: boolean;
    sortOrder?: number;
    active?: boolean;
    points?: number;
  }
) {
  return adminFetch<{ challenge: Challenge }>(
    `/admin/hunts/${huntId}/challenges`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export function importChallenges(
  huntId: string,
  challenges: Array<{
    title: string;
    description: string;
    type: "photo" | "video";
    isBonus: boolean;
    sortOrder: number;
    active: boolean;
    points: number;
  }>
) {
  return adminFetch<{ imported: number; challenges: Challenge[] }>(
    `/admin/hunts/${huntId}/challenges/import`,
    {
      method: "POST",
      body: JSON.stringify({ challenges }),
    }
  );
}

export function patchChallenge(
  id: string,
  body: Partial<{
    title: string;
    description: string;
    type: "photo" | "video";
    isBonus: boolean;
    sortOrder: number;
    active: boolean;
    points: number;
  }>
) {
  return adminFetch<{ challenge: Challenge }>(`/admin/challenges/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteChallenge(id: string) {
  return adminFetch<{ ok: boolean }>(`/admin/challenges/${id}`, {
    method: "DELETE",
  });
}

export function approveCompletion(completionId: string) {
  return adminFetch<{ ok: boolean }>(
    `/admin/completions/${completionId}/approve`,
    { method: "POST" }
  );
}

/** Reject: removes the submission so the team can upload again. */
export function rejectCompletion(completionId: string) {
  return adminFetch<{ ok: boolean }>(`/admin/completions/${completionId}`, {
    method: "DELETE",
  });
}
