import assert from "node:assert/strict";
import test from "node:test";

import {
  HomeAssistantNotificationError,
  sendHomeAssistantNotification,
} from "./home-assistant-notification-poc";

test("posts a mobile-app notification to the Home Assistant notify service", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];

  const result = await sendHomeAssistantNotification({
    url: "http://homeassistant.local:8123/",
    token: "top-secret-token",
    service: "mobile_app_family_phone",
    title: "Family Hub notification POC",
    message:
      "If you can see this, Family Hub → Home Assistant → phone delivery works.",
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response("[]", { status: 200 });
    },
  });

  assert.deepEqual(result, { accepted: true, status: 200 });
  assert.equal(
    requests[0].url,
    "http://homeassistant.local:8123/api/services/notify/mobile_app_family_phone",
  );
  assert.equal(requests[0].init?.method, "POST");
  assert.equal(
    new Headers(requests[0].init?.headers).get("authorization"),
    "Bearer top-secret-token",
  );
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
    title: "Family Hub notification POC",
    message:
      "If you can see this, Family Hub → Home Assistant → phone delivery works.",
  });
});

test("classifies an unauthorized provider response without exposing the token", async () => {
  await assert.rejects(
    () =>
      sendHomeAssistantNotification({
        url: "http://homeassistant.local:8123",
        token: "top-secret-token",
        service: "mobile_app_family_phone",
        message: "POC",
        fetchImpl: async () => new Response("Unauthorized", { status: 401 }),
      }),
    (error: unknown) => {
      assert.ok(error instanceof HomeAssistantNotificationError);
      assert.equal(error.kind, "authentication");
      assert.equal(error.status, 401);
      assert.doesNotMatch(error.message, /top-secret-token/);
      return true;
    },
  );
});

test("rejects a target that is not a mobile-app notify service before sending", async () => {
  let called = false;

  await assert.rejects(
    () =>
      sendHomeAssistantNotification({
        url: "http://homeassistant.local:8123",
        token: "top-secret-token",
        service: "all_devices",
        message: "POC",
        fetchImpl: async () => {
          called = true;
          return new Response("[]", { status: 200 });
        },
      }),
    {
      name: "HomeAssistantNotificationError",
      message: "HOME_ASSISTANT_NOTIFY_SERVICE must start with mobile_app_",
    },
  );

  assert.equal(called, false);
});

test("classifies an aborted request as a timeout", async () => {
  await assert.rejects(
    () =>
      sendHomeAssistantNotification({
        url: "http://homeassistant.local:8123",
        token: "top-secret-token",
        service: "mobile_app_family_phone",
        message: "POC",
        timeoutMs: 1,
        fetchImpl: async (_url, init) => {
          await new Promise<void>((resolve) => {
            init?.signal?.addEventListener("abort", () => resolve(), {
              once: true,
            });
          });
          throw new DOMException("The operation was aborted", "AbortError");
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof HomeAssistantNotificationError);
      assert.equal(error.kind, "timeout");
      return true;
    },
  );
});
