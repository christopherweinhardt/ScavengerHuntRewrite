import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const huntStatusEnum = pgEnum("hunt_status", [
  "scheduled",
  "active",
  "paused",
  "finished",
]);

export const challengeTypeEnum = pgEnum("challenge_type", ["photo", "video"]);

export const completionStatusEnum = pgEnum("completion_status", [
  "pending",
  "approved",
]);

export const pushPlatformEnum = pgEnum("push_platform", ["ios", "android"]);

export const hunts = pgTable("hunts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  durationSeconds: integer("duration_seconds").notNull().default(10800),
  status: huntStatusEnum("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    huntId: uuid("hunt_id")
      .notNull()
      .references(() => hunts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Random join secret; unique per hunt (stored plain for O(1) lookup). */
    joinCode: text("join_code").notNull(),
    /** Manual score delta applied on top of approved challenge points. */
    scoreAdjustment: integer("score_adjustment").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    huntJoinUnique: uniqueIndex("teams_hunt_join_code").on(t.huntId, t.joinCode),
  })
);

export const challenges = pgTable("challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  huntId: uuid("hunt_id")
    .notNull()
    .references(() => hunts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  type: challengeTypeEnum("type").notNull().default("photo"),
  isBonus: boolean("is_bonus").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  points: integer("points").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const completions = pgTable(
  "completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    s3Key: text("s3_key").notNull(),
    status: completionStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    teamChallengeUnique: uniqueIndex("completions_team_challenge").on(
      t.teamId,
      t.challengeId
    ),
  })
);

export const pushTokens = pgTable("push_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  expoPushToken: text("expo_push_token").notNull().unique(),
  platform: pushPlatformEnum("platform").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const huntsRelations = relations(hunts, ({ many }) => ({
  teams: many(teams),
  challenges: many(challenges),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  hunt: one(hunts, { fields: [teams.huntId], references: [hunts.id] }),
  completions: many(completions),
  pushTokens: many(pushTokens),
}));

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  team: one(teams, { fields: [pushTokens.teamId], references: [teams.id] }),
}));

export const challengesRelations = relations(challenges, ({ one, many }) => ({
  hunt: one(hunts, { fields: [challenges.huntId], references: [hunts.id] }),
  completions: many(completions),
}));

export const completionsRelations = relations(completions, ({ one }) => ({
  team: one(teams, { fields: [completions.teamId], references: [teams.id] }),
  challenge: one(challenges, {
    fields: [completions.challengeId],
    references: [challenges.id],
  }),
}));
