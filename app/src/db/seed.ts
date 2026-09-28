import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  eventCategories,
  familyMembers,
} from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

const members = [
  {
    name: "Suhail",
    color: "#3B82F6",
  },
  {
    name: "Kimberly",
    color: "#FACC15",
  },
  {
    name: "Sahar",
    color: "#EC4899",
  },
];

const categories = [
  { name: "Family", defaultReminderOffsets: [1440] },
  { name: "School", defaultReminderOffsets: [10080, 2880, 1440] },
  { name: "Work", defaultReminderOffsets: [60] },
  { name: "Medical", defaultReminderOffsets: [1440] },
  { name: "Birthday", defaultReminderOffsets: [10080, 1440] },
  { name: "Appointment", defaultReminderOffsets: [1440] },
  { name: "Holiday", defaultReminderOffsets: [10080] },
];

async function seed() {
  console.log("Seeding Family Hub database...");

  await db
    .insert(familyMembers)
    .values(members)
    .onConflictDoNothing({
      target: familyMembers.name,
    });

  await db
    .insert(eventCategories)
    .values(categories)
    .onConflictDoNothing({
      target: eventCategories.name,
    });

  console.log("Seed complete.");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
