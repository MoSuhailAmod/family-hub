import assert from "node:assert/strict";
import test from "node:test";

import {
  composeCalendarReminderNotification,
  createHomeAssistantNotificationProvider,
  createNotificationService,
  type NotificationLogEntry,
} from "./notification-service";

const destination = {
  id: "00000000-0000-4000-8000-000000000001",
  provider: "home_assistant",
  target: "mobile_app_family_phone",
};

const notification = {
  title: "Dentist appointment in 1 hour",
  body: "15:30 • Dr Smith, Sandton",
  correlationId: "delivery-123",
  metadata: { event_id: "event-456" },
};

test("routes a provider-neutral notification through the selected provider", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const service = createNotificationService({
    home_assistant: createHomeAssistantNotificationProvider({
      url: "http://homeassistant.local:8123",
      token: "top-secret-token",
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response("[]", { status: 200 });
      },
    }),
  });

  const result = await service.send(notification, destination);

  assert.deepEqual(result, {
    success: true,
    provider: "home_assistant",
    status: 200,
  });
  assert.equal(
    requests[0].url,
    "http://homeassistant.local:8123/api/services/notify/mobile_app_family_phone",
  );
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
    title: "Dentist appointment in 1 hour",
    message: "15:30 • Dr Smith, Sandton",
    data: { correlation_id: "delivery-123", event_id: "event-456" },
  });
});

test("returns a typed unsupported-provider failure without making a request", async () => {
  const service = createNotificationService({});

  assert.deepEqual(
    await service.send(notification, {
      ...destination,
      provider: "web_push",
    }),
    {
      success: false,
      provider: "web_push",
      kind: "unsupported_provider",
      message: "No notification provider is configured for web_push",
    },
  );
});

test("returns an invalid-target failure without logging Home Assistant credentials", async () => {
  const entries: NotificationLogEntry[] = [];
  const service = createNotificationService({
    home_assistant: createHomeAssistantNotificationProvider({
      url: "http://homeassistant.local:8123",
      token: "top-secret-token",
      logger: (entry) => entries.push(entry),
    }),
  });

  const result = await service.send(notification, {
    ...destination,
    target: "",
  });

  assert.deepEqual(result, {
    success: false,
    provider: "home_assistant",
    kind: "target",
    message: "Home Assistant notification target is required",
  });
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], {
    correlationId: "delivery-123",
    kind: "target",
    provider: "home_assistant",
    result: "failure",
    target: "",
  });
  assert.doesNotMatch(JSON.stringify(entries), /top-secret-token/);
});

test("rejects an unsafe Home Assistant target before making a request", async () => {
  let called = false;
  const service = createNotificationService({
    home_assistant: createHomeAssistantNotificationProvider({
      url: "http://homeassistant.local:8123",
      token: "top-secret-token",
      fetchImpl: async () => {
        called = true;
        return new Response("[]", { status: 200 });
      },
    }),
  });

  assert.deepEqual(
    await service.send(notification, {
      ...destination,
      target: "mobile_app_phone/../../light/turn_on",
    }),
    {
      success: false,
      provider: "home_assistant",
      kind: "target",
      message:
        "Home Assistant notification target must be a mobile_app service name",
    },
  );
  assert.equal(called, false);
});

test("returns a delivery result when optional logging fails", async () => {
  const service = createNotificationService({
    home_assistant: createHomeAssistantNotificationProvider({
      url: "http://homeassistant.local:8123",
      token: "top-secret-token",
      logger: () => {
        throw new Error("logging backend unavailable");
      },
      fetchImpl: async () => new Response("[]", { status: 200 }),
    }),
  });

  assert.deepEqual(await service.send(notification, destination), {
    success: true,
    provider: "home_assistant",
    status: 200,
  });
});

test("maps Home Assistant authentication responses to a secret-safe typed failure", async () => {
  const entries: NotificationLogEntry[] = [];
  const service = createNotificationService({
    home_assistant: createHomeAssistantNotificationProvider({
      url: "http://homeassistant.local:8123",
      token: "top-secret-token",
      logger: (entry) => entries.push(entry),
      fetchImpl: async () => new Response("Unauthorized", { status: 401 }),
    }),
  });

  const result = await service.send(notification, destination);

  assert.deepEqual(result, {
    success: false,
    provider: "home_assistant",
    kind: "authentication",
    message: "Home Assistant notification request was not authorized",
    status: 401,
  });
  assert.doesNotMatch(JSON.stringify(entries), /top-secret-token/);
});

test("maps aborted Home Assistant requests to a timeout failure", async () => {
  const service = createNotificationService({
    home_assistant: createHomeAssistantNotificationProvider({
      url: "http://homeassistant.local:8123",
      token: "top-secret-token",
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
  });

  assert.deepEqual(await service.send(notification, destination), {
    success: false,
    provider: "home_assistant",
    kind: "timeout",
    message: "Home Assistant notification request timed out",
  });
});

test("maps unavailable Home Assistant transport to a network failure", async () => {
  const service = createNotificationService({
    home_assistant: createHomeAssistantNotificationProvider({
      url: "http://homeassistant.local:8123",
      token: "top-secret-token",
      fetchImpl: async () => {
        throw new TypeError("connection refused");
      },
    }),
  });

  assert.deepEqual(await service.send(notification, destination), {
    success: false,
    provider: "home_assistant",
    kind: "network",
    message: "Home Assistant notification request failed before provider acceptance",
  });
});

test("maps missing Home Assistant configuration to a secret-safe failure", async () => {
  const entries: NotificationLogEntry[] = [];
  const service = createNotificationService({
    home_assistant: createHomeAssistantNotificationProvider({
      url: "http://homeassistant.local:8123",
      token: "",
      logger: (entry) => entries.push(entry),
    }),
  });

  assert.deepEqual(await service.send(notification, destination), {
    success: false,
    provider: "home_assistant",
    kind: "configuration",
    message: "HOME_ASSISTANT_TOKEN is required",
  });
  assert.doesNotMatch(JSON.stringify(entries), /top-secret-token/);
});

test("composes concise calendar-friendly notification content", () => {
  assert.deepEqual(
    composeCalendarReminderNotification({
      title: "Dentist appointment",
      leadTimeLabel: "1 hour",
      startsAt: new Date("2026-09-10T13:30:00.000Z"),
      location: "Dr Smith, Sandton",
    }),
    {
      title: "Dentist appointment in 1 hour",
      body: "15:30 • Dr Smith, Sandton",
    },
  );
});
