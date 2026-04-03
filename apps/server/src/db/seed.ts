import { eq } from "drizzle-orm";
import "dotenv/config";
import { db } from "./index.js";
import { challenges, hunts, teams } from "./schema.js";

async function main() {
  const existing = await db.query.hunts.findFirst({
    where: eq(hunts.slug, "demo"),
  });
  if (existing) {
    console.log("Seed skipped: hunt slug=demo already exists");
    return;
  }

  const start = new Date();
  start.setMinutes(start.getMinutes() + 5);

  const [hunt] = await db
    .insert(hunts)
    .values({
      name: "Demo scavenger hunt",
      slug: "demo",
      startsAt: start,
      durationSeconds: 10800,
      status: "active",
    })
    .returning();

  await db.insert(teams).values({
    huntId: hunt.id,
    name: "Team Alpha",
    joinCode: "DEMO1",
  });

  await db.insert(challenges).values([
    {
      huntId: hunt.id,
      title: "Stand next to a cow",
      description: "Photo proof beside any cow (statue counts).",
      type: "photo",
      isBonus: false,
      sortOrder: 10,
      active: true,
      points: 2,
    },
    {
      huntId: hunt.id,
      title: "Pose like a mannequin",
      description: "Short video frozen in a store like a display.",
      type: "video",
      isBonus: false,
      sortOrder: 20,
      active: true,
      points: 3,
    },
    {
      huntId: hunt.id,
      title: "Bonus: local landmark",
      description: "Extra credit — selfie with any historic plaque.",
      type: "photo",
      isBonus: true,
      sortOrder: 30,
      active: true,
      points: 5,
    },
  ]);

  console.log("Seeded hunt", hunt.slug, "team join code: DEMO1");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
