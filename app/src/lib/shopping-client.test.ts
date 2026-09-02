import assert from "node:assert/strict";
import test from "node:test";

import { requestShoppingApi } from "./shopping-client";

test("uses stable item ids for shopping mutations", async () => {
  const requests: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetcher: typeof fetch = async (url, init) => {
    const parsedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({
      url: String(url),
      method: init?.method ?? "GET",
      ...(parsedBody === undefined ? {} : { body: parsedBody }),
    });
    return Response.json({ item: { id: "item-id" } });
  };

  await requestShoppingApi(fetcher, "item-id", {
    method: "PATCH",
    body: { completed: true },
  });
  await requestShoppingApi(fetcher, "item-id", { method: "DELETE" });

  assert.deepEqual(requests, [
    {
      url: "/api/shopping-items/item-id",
      method: "PATCH",
      body: { completed: true },
    },
    { url: "/api/shopping-items/item-id", method: "DELETE" },
  ]);
});
