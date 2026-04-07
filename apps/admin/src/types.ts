export type HuntStatus = "scheduled" | "active" | "paused" | "finished";

export type HuntPublic = {
  id: string;
  name: string;
  slug: string;
  startsAt: string;
  durationSeconds: number;
  status: HuntStatus;
};

export type Challenge = {
  id: string;
  huntId: string;
  title: string;
  description: string;
  type: "photo" | "video";
  isBonus: boolean;
  sortOrder: number;
  active: boolean;
  points: number;
};

export type AdminTeam = {
  id: string;
  name: string;
  joinCode: string;
  baseScore: number;
  scoreAdjustment: number;
  totalScore: number;
};

/** Team submission for a challenge (admin hunt detail). */
export type AdminSubmission = {
  id: string;
  challengeId: string;
  teamId: string;
  teamName: string;
  submittedAt: string;
  mediaType: "photo" | "video";
  status: "pending" | "approved";
  /** Presigned GET URL; null if signing failed. */
  viewUrl: string | null;
};
