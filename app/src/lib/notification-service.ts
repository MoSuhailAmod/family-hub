type FetchImplementation = typeof fetch;

export type NotificationDestination = {
  id: string;
  provider: string;
  target: string;
};

export type NotificationRequest = {
  title: string;
  body: string;
  correlationId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type NotificationFailureKind =
  | "authentication"
  | "configuration"
  | "network"
  | "provider"
  | "target"
  | "timeout"
  | "unsupported_provider";

export type NotificationDeliveryResult =
  | {
      success: true;
      provider: string;
      status: number;
    }
  | {
      success: false;
      provider: string;
      kind: NotificationFailureKind;
      message: string;
      status?: number;
    };

export type NotificationLogEntry = {
  correlationId?: string;
  kind?: NotificationFailureKind;
  provider: string;
  result: "success" | "failure";
  status?: number;
  target: string;
};

export type NotificationProvider = {
  send(
    notification: NotificationRequest,
    destination: NotificationDestination,
  ): Promise<NotificationDeliveryResult>;
};

export type HomeAssistantProviderConfig = {
  url: string;
  token: string;
  timeoutMs?: number;
  fetchImpl?: FetchImplementation;
  logger?: (entry: NotificationLogEntry) => void;
};

export type CalendarReminderContentInput = {
  title: string;
  leadTimeLabel: string;
  startsAt: Date;
  location?: string | null;
};

function failure(
  provider: string,
  kind: NotificationFailureKind,
  message: string,
  status?: number,
): NotificationDeliveryResult {
  return { success: false, provider, kind, message, ...(status ? { status } : {}) };
}

function classifyStatus(status: number): NotificationFailureKind {
  if (status === 401 || status === 403) return "authentication";
  if (status === 404) return "target";
  return "provider";
}

function statusMessage(kind: NotificationFailureKind): string {
  switch (kind) {
    case "authentication":
      return "Home Assistant notification request was not authorized";
    case "target":
      return "Home Assistant notification target was not found";
    default:
      return "Home Assistant notification provider returned an error";
  }
}

function log(
  logger: HomeAssistantProviderConfig["logger"],
  notification: NotificationRequest,
  destination: NotificationDestination,
  result: NotificationDeliveryResult,
) {
  if (!logger) return;

  const entry = {
    ...(notification.correlationId
      ? { correlationId: notification.correlationId }
      : {}),
    provider: destination.provider,
    result: result.success ? ("success" as const) : ("failure" as const),
    target: destination.target,
  };

  try {
    if (result.success === true) {
      logger({ ...entry, status: result.status });
      return;
    }

    logger({
      ...entry,
      kind: result.kind,
      ...(result.status === undefined ? {} : { status: result.status }),
    });
  } catch {
    // Logging is diagnostic-only and must not change the delivery result.
  }
}

function normalizedRequest(
  notification: NotificationRequest,
): NotificationRequest | NotificationDeliveryResult {
  const title = notification.title.trim();
  const body = notification.body.trim();
  if (!title || !body) {
    return failure(
      "notification_service",
      "configuration",
      "Notification title and body are required",
    );
  }
  return { ...notification, title, body };
}

export function createNotificationService(
  providers: Record<string, NotificationProvider>,
) {
  return {
    async send(
      notification: NotificationRequest,
      destination: NotificationDestination,
    ): Promise<NotificationDeliveryResult> {
      const request = normalizedRequest(notification);
      if ("success" in request) return request;

      const provider = providers[destination.provider];
      if (!provider) {
        return failure(
          destination.provider,
          "unsupported_provider",
          `No notification provider is configured for ${destination.provider}`,
        );
      }

      return provider.send(request, destination);
    },
  };
}

export function createHomeAssistantNotificationProvider(
  config: HomeAssistantProviderConfig,
): NotificationProvider {
  return {
    async send(notification, destination) {
      const provider = destination.provider;
      const url = config.url.trim();
      const token = config.token.trim();
      const target = destination.target.trim();
      const timeoutMs = config.timeoutMs ?? 10_000;

      let result: NotificationDeliveryResult;
      if (!url) {
        result = failure(provider, "configuration", "HOME_ASSISTANT_URL is required");
        log(config.logger, notification, destination, result);
        return result;
      }
      if (!token) {
        result = failure(provider, "configuration", "HOME_ASSISTANT_TOKEN is required");
        log(config.logger, notification, destination, result);
        return result;
      }
      if (!target) {
        result = failure(provider, "target", "Home Assistant notification target is required");
        log(config.logger, notification, destination, result);
        return result;
      }
      if (!/^mobile_app_[a-z0-9_]+$/i.test(target)) {
        result = failure(
          provider,
          "target",
          "Home Assistant notification target must be a mobile_app service name",
        );
        log(config.logger, notification, destination, result);
        return result;
      }
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        result = failure(provider, "configuration", "timeoutMs must be a positive number");
        log(config.logger, notification, destination, result);
        return result;
      }

      let baseUrl: URL;
      try {
        baseUrl = new URL(url);
      } catch {
        result = failure(provider, "configuration", "HOME_ASSISTANT_URL must be an absolute URL");
        log(config.logger, notification, destination, result);
        return result;
      }
      if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
        result = failure(provider, "configuration", "HOME_ASSISTANT_URL must use http or https");
        log(config.logger, notification, destination, result);
        return result;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await (config.fetchImpl ?? fetch)(
          new URL(`/api/services/notify/${target}`, baseUrl).toString(),
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: notification.title,
              message: notification.body,
              ...((notification.correlationId || notification.metadata)
                ? {
                    data: {
                      ...notification.metadata,
                      ...(notification.correlationId
                        ? { correlation_id: notification.correlationId }
                        : {}),
                    },
                  }
                : {}),
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const kind = classifyStatus(response.status);
          result = failure(provider, kind, statusMessage(kind), response.status);
        } else {
          result = { success: true, provider, status: response.status };
        }
      } catch {
        result = controller.signal.aborted
          ? failure(provider, "timeout", "Home Assistant notification request timed out")
          : failure(
              provider,
              "network",
              "Home Assistant notification request failed before provider acceptance",
            );
      } finally {
        clearTimeout(timeout);
      }

      log(config.logger, notification, destination, result);
      return result;
    },
  };
}

export function createHomeAssistantProviderFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  options: Omit<HomeAssistantProviderConfig, "url" | "token"> = {},
): NotificationProvider {
  return createHomeAssistantNotificationProvider({
    ...options,
    url: environment.HOME_ASSISTANT_URL ?? "",
    token: environment.HOME_ASSISTANT_TOKEN ?? "",
  });
}

export function composeCalendarReminderNotification(
  input: CalendarReminderContentInput,
): Pick<NotificationRequest, "title" | "body"> {
  const title = input.title.trim();
  const leadTimeLabel = input.leadTimeLabel.trim();
  const location = input.location?.trim();
  const time = new Intl.DateTimeFormat("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Johannesburg",
  }).format(input.startsAt);

  return {
    title: leadTimeLabel ? `${title} in ${leadTimeLabel}` : title,
    body: location ? `${time} • ${location}` : time,
  };
}
