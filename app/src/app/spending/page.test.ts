import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("does not expose a file upload control on the Spending page", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /type="file"/);
});
