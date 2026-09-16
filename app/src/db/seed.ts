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
  { name: "Family" },
  { name: "School" },
  { name: "Work" },
  { name: "Medical" },
  { name: "Birthday" },
  { name: "Appointment" },
  { name: "Holiday" },
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
