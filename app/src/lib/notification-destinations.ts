export type NotificationDestination = { id: string; familyMemberId: string; familyMemberName: string; provider: string; target: string; label: string | null; enabled: boolean };
type NewDestination = Omit<NotificationDestination, "id" | "familyMemberName">;
type DestinationRepository = { memberExists(id: string): Promise<boolean>; list(memberIds?: string[]): Promise<NotificationDestination[]>; create(input: NewDestination): Promise<NotificationDestination>; update(id: string, patch: Partial<Pick<NotificationDestination, "target" | "label" | "enabled">>): Promise<NotificationDestination | null>; delete(id: string): Promise<boolean> };
type Result<T> = { success: true; data: T } | { success: false; code: "VALIDATION" | "NOT_FOUND" | "DUPLICATE"; error: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const homeAssistantTarget = /^mobile_app_[a-z0-9_]+$/i;
function failure(code: "VALIDATION" | "NOT_FOUND" | "DUPLICATE", error: string): Result<never> { return { success: false, code, error }; }
function normalizeTarget(provider: string, target: string): string | Result<never> { const normalized = target.trim(); if (provider !== "home_assistant") return failure("VALIDATION", "Unsupported notification provider"); if (!homeAssistantTarget.test(normalized)) return failure("VALIDATION", "Home Assistant target must be a mobile_app service name"); return normalized; }
export function createNotificationDestinationService(repository: DestinationRepository) {
  return {
    list: (familyMemberId?: string) => repository.list(familyMemberId ? [familyMemberId] : undefined),
    async create(input: { familyMemberId: string; provider: string; target: string; label?: string | null }): Promise<Result<NotificationDestination>> {
      if (!uuid.test(input.familyMemberId)) return failure("VALIDATION", "Invalid family member id");
      if (!(await repository.memberExists(input.familyMemberId))) return failure("NOT_FOUND", "Family member not found");
      const target = normalizeTarget(input.provider, input.target); if (typeof target !== "string") return target;
      const duplicate = (await repository.list()).some((item) => item.provider === input.provider && item.target === target); if (duplicate) return failure("DUPLICATE", "Notification destination already exists");
      return { success: true, data: await repository.create({ familyMemberId: input.familyMemberId, provider: input.provider, target, label: input.label?.trim() || null, enabled: true }) };
    },
    async update(id: string, patch: { target?: string; label?: string | null; enabled?: boolean }): Promise<Result<NotificationDestination>> {
      if (!id) return failure("VALIDATION", "Destination id is required");
      if (patch.target !== undefined && !homeAssistantTarget.test(patch.target.trim())) return failure("VALIDATION", "Home Assistant target must be a mobile_app service name");
      if (patch.enabled !== undefined && typeof patch.enabled !== "boolean") return failure("VALIDATION", "enabled must be boolean");
      const updated = await repository.update(id, { ...patch, ...(patch.target === undefined ? {} : { target: patch.target.trim() }), ...(patch.label === undefined ? {} : { label: patch.label?.trim() || null }) });
      return updated ? { success: true, data: updated } : failure("NOT_FOUND", "Notification destination not found");
    },
    async delete(id: string): Promise<Result<{ id: string }>> { return (await repository.delete(id)) ? { success: true, data: { id } } : failure("NOT_FOUND", "Notification destination not found"); },
    async resolveRecipients(participantIds: string[]) { const uniqueMembers = [...new Set(participantIds)]; if (!uniqueMembers.length) return []; const seen = new Set<string>(); return (await repository.list(uniqueMembers)).filter((item) => item.enabled && !seen.has(item.id) && !!seen.add(item.id)).map(({ enabled: _enabled, ...item }) => item); },
  };
}
