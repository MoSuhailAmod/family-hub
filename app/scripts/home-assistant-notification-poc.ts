import {
  HomeAssistantNotificationError,
  sendHomeAssistantNotification,
} from "../src/lib/home-assistant-notification-poc";

const message =
  "If you can see this, Family Hub → Home Assistant → phone delivery works.";

async function main() {
  const result = await sendHomeAssistantNotification({
    url: process.env.HOME_ASSISTANT_URL ?? "",
    token: process.env.HOME_ASSISTANT_TOKEN ?? "",
    service: process.env.HOME_ASSISTANT_NOTIFY_SERVICE ?? "",
    title: "Family Hub notification POC",
    message,
  });

  console.log(
    JSON.stringify({
      ok: true,
      provider: "home-assistant",
      targetService: process.env.HOME_ASSISTANT_NOTIFY_SERVICE,
      accepted: result.accepted,
      status: result.status,
    }),
  );
}

main().catch((error: unknown) => {
  if (error instanceof HomeAssistantNotificationError) {
    console.error(
      JSON.stringify({
        ok: false,
        provider: "home-assistant",
        targetService: process.env.HOME_ASSISTANT_NOTIFY_SERVICE || undefined,
        failureKind: error.kind,
        status: error.status,
        error: error.message,
      }),
    );
  } else {
    console.error(
      JSON.stringify({
        ok: false,
        provider: "home-assistant",
        failureKind: "unexpected",
        error: "Unexpected notification POC failure",
      }),
    );
  }

  process.exitCode = 1;
});
