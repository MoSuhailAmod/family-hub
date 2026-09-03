import assert from "node:assert/strict";
import test from "node:test";

import { shoppingSuccessMessage } from "./shopping-feedback";

test("creates concise live-region messages for shopping mutations", () => {
  assert.equal(shoppingSuccessMessage("add", "Milk"), "Milk added");
  assert.equal(shoppingSuccessMessage("edit", "Milk"), "Milk updated");
  assert.equal(shoppingSuccessMessage("complete", "Milk"), "Milk completed");
  assert.equal(shoppingSuccessMessage("restore", "Milk"), "Milk restored");
  assert.equal(shoppingSuccessMessage("remove", "Milk"), "Milk removed");
});
