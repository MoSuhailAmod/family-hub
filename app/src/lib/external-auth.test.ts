import assert from "node:assert/strict";
import test from "node:test";

import { requireExternalToken } from "./external-auth";

const environment: NodeJS.ProcessEnv = {
  FAMILY_HUB_EXTERNAL_TOKEN: "expected-token",
  NODE_ENV: "test",
};

test("returns null for a valid bearer token", () => {
  const response = requireExternalToken(
    new Request("https://family-hub.test/mcp", {
      headers: { authorization: "Bearer expected-token" },
    }),
    environment,
  );

  assert.equal(response, null);
});

test("returns 401 when the authorization header is missing", async () => {
  const response = requireExternalToken(
    new Request("https://family-hub.test/mcp"),
    environment,
  );

  assert.ok(response);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
  assert.equal(response.headers.get("www-authenticate"), 'Bearer realm="family-hub"');
});

test("returns 401 for a wrong bearer token", async () => {
  const response = requireExternalToken(
    new Request("https://family-hub.test/mcp", {
      headers: { authorization: "Bearer wrong-token" },
    }),
    environment,
  );

  assert.ok(response);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
  assert.equal(response.headers.get("www-authenticate"), 'Bearer realm="family-hub"');
});

test("returns 401 when the external token is unset or blank", async (t) => {
  for (const externalToken of [undefined, "   "]) {
    await t.test(`${externalToken === undefined ? "unset" : "blank"} token`, async () => {
      const response = requireExternalToken(
        new Request("https://family-hub.test/mcp", {
          headers: { authorization: "Bearer plausible-token" },
        }),
        {
          FAMILY_HUB_EXTERNAL_TOKEN: externalToken,
          NODE_ENV: "test",
        },
      );

      assert.ok(response);
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "Unauthorized" });
      assert.equal(response.headers.get("www-authenticate"), 'Bearer realm="family-hub"');
    });
  }
});
