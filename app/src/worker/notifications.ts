import { createNotificationDestinationService } from "@/lib/notification-destinations";
import { notificationDestinationRepository } from "@/lib/notification-destination-data";
import { createHomeAssistantProviderFromEnvironment, createNotificationService } from "@/lib/notification-service";
import { createNotificationWorker } from "@/lib/notification-worker";
import { createPostgresNotificationWorkerDependencies } from "@/lib/notification-worker-data";

const cadenceMs = 60_000;
const destinations = createNotificationDestinationService(notificationDestinationRepository);
const service = createNotificationService({ home_assistant: createHomeAssistantProviderFromEnvironment() });
const worker = createNotificationWorker(createPostgresNotificationWorkerDependencies({
  resolveRecipients: (participantIds) => destinations.resolveRecipients(participantIds),
  send: (notification, destination) => service.send(notification, destination),
}));

async function cycle() {
  const startedAt = new Date();
  try { console.info("notification worker cycle started", { startedAt: startedAt.toISOString() }); console.info("notification worker cycle complete", await worker.run(startedAt)); }
  catch (error) { console.error("notification worker cycle failed", error instanceof Error ? error.message : "unknown failure"); }
}

void cycle();
setInterval(cycle, cadenceMs);
