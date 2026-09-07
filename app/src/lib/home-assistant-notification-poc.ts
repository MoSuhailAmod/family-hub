export type HomeAssistantNotificationFailureKind =
  | "authentication"
  | "configuration"
  | "network"
  | "provider"
  | "target"
  | "timeout";

export class HomeAssistantNotificationError extends Error {
  constructor(
    message: string,
    public readonly kind: HomeAssistantNotificationFailureKind,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "HomeAssistantNotificationError";
  }
}

type FetchImplementation = typeof fetch;

export type SendHomeAssistantNotificationInput = {
  url: string;
  token: string;
  service: string;
  message: string;
  title?: string;
  timeoutMs?: number;
  fetchImpl?: FetchImplementation;
};

export type HomeAssistantNotificationResult = {
  accepted: true;
  status: number;
};

function configError(message: string): HomeAssistantNotificationError {
  return new HomeAssistantNotificationError(message, "configuration");
}

function servicePath(service: string): string {
  if (!service.startsWith("mobile_app_")) {
    throw new HomeAssistantNotificationError(
      "HOME_ASSISTANT_NOTIFY_SERVICE must start with mobile_app_",
      "target",
    );
  }

  return `notify/${service}`;
}

function classifyStatus(status: number): HomeAssistantNotificationFailureKind {
  if (status === 401 || status === 403) return "authentication";
  if (status === 404) return "target";
  return "provider";
}

export async function sendHomeAssistantNotification(
  input: SendHomeAssistantNotificationInput,
): Promise<HomeAssistantNotificationResult> {
  const url = input.url.trim();
  const token = input.token.trim();
  const service = input.service.trim();
  const message = input.message.trim();
  const timeoutMs = input.timeoutMs ?? 10_000;

  if (!url) throw configError("HOME_ASSISTANT_URL is required");
  if (!token) throw configError("HOME_ASSISTANT_TOKEN is required");
  if (!service) throw configError("HOME_ASSISTANT_NOTIFY_SERVICE is required");
  if (!message) throw configError("Notification message is required");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw configError("timeoutMs must be a positive number");
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(url);
  } catch {
    throw configError("HOME_ASSISTANT_URL must be an absolute URL");
  }

  if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
    throw configError("HOME_ASSISTANT_URL must use http or https");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await (input.fetchImpl ?? fetch)(
      new URL(`/api/services/${servicePath(service)}`, baseUrl).toString(),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: input.title, message }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new HomeAssistantNotificationError(
        `Home Assistant notification request returned HTTP ${response.status}`,
        classifyStatus(response.status),
        response.status,
      );
    }

    return { accepted: true, status: response.status };
  } catch (error) {
    if (error instanceof HomeAssistantNotificationError) throw error;

    if (controller.signal.aborted) {
      throw new HomeAssistantNotificationError(
        "Home Assistant notification request timed out",
        "timeout",
      );
    }

    throw new HomeAssistantNotificationError(
      "Home Assistant notification request failed before provider acceptance",
      "network",
    );
  } finally {
    clearTimeout(timeout);
  }
}
