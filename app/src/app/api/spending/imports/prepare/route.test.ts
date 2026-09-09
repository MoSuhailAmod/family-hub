import assert from "node:assert/strict";
import test from "node:test";

import { MAX_SPENDING_UPLOAD_BYTES } from "@/lib/spending-upload";

import { POST } from "./route";

test("rejects an oversized streamed Markdown request before reading another chunk", async () => {
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      if (pulls === 1) {
        controller.enqueue(new Uint8Array(MAX_SPENDING_UPLOAD_BYTES + 1));
        return;
      }
      throw new Error("The oversized request body was read beyond its limit.");
    },
  });
  const request = new Request("http://localhost/api/spending/imports/prepare", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit & { duplex: string });

  const response = await POST(request);

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "The uploaded file must be 5 MB or smaller." });
  assert.equal(pulls, 1);
});
