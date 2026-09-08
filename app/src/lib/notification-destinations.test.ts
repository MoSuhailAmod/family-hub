import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationDestinationService } from "./notification-destinations";

const memberA = "00000000-0000-4000-8000-000000000001";
const memberB = "00000000-0000-4000-8000-000000000002";

type Destination = { id: string; familyMemberId: string; familyMemberName: string; provider: string; target: string; label: string | null; enabled: boolean };
function repository(items: Destination[] = []) {
  let values = [...items]; let next = 1;
  return {
    memberExists: async (id: string) => [memberA, memberB].includes(id),
    list: async (memberIds?: string[]) => values.filter((item) => !memberIds || memberIds.includes(item.familyMemberId)),
    create: async (input: Omit<Destination, "id" | "familyMemberName">) => { const item: Destination = { ...input, id: `destination-${next++}`, familyMemberName: input.familyMemberId === memberA ? "A" : "B" }; values.push(item); return item; },
    update: async (id: string, patch: Partial<Pick<Destination, "target" | "label" | "enabled">>) => { const item = values.find((value) => value.id === id); if (!item) return null; Object.assign(item, patch); return item; },
    delete: async (id: string) => { const count = values.length; values = values.filter((item) => item.id !== id); return values.length !== count; },
  };
}

test("creates normalized Home Assistant destinations and rejects duplicate targets", async () => {
  const service = createNotificationDestinationService(repository());
  const created = await service.create({ familyMemberId: memberA, provider: "home_assistant", target: " mobile_app_suhail_phone ", label: " Phone " });
  assert.equal(created.success, true);
  if (!created.success) return;
  assert.deepEqual(created.data, { id: "destination-1", familyMemberId: memberA, familyMemberName: "A", provider: "home_assistant", target: "mobile_app_suhail_phone", label: "Phone", enabled: true });
  const duplicate = await service.create({ familyMemberId: memberB, provider: "home_assistant", target: "mobile_app_suhail_phone" });
  assert.equal(duplicate.success, false);
  if (!duplicate.success) assert.equal(duplicate.code, "DUPLICATE");
});

test("validates family members, providers, and mobile notification targets", async () => {
  const service = createNotificationDestinationService(repository());
  for (const input of [
    { familyMemberId: "00000000-0000-4000-8000-000000000099", provider: "home_assistant", target: "mobile_app_phone" },
    { familyMemberId: memberA, provider: "web_push", target: "mobile_app_phone" },
    { familyMemberId: memberA, provider: "home_assistant", target: "mobile_app_phone/../../light" },
  ]) assert.equal((await service.create(input)).success, false);
});

test("routes mapped participants and surfaces unmapped participants without blocking delivery", async () => {
  const diagnostics: string[][] = [];
  const service = createNotificationDestinationService(repository([
    { id: "a1", familyMemberId: memberA, familyMemberName: "A", provider: "home_assistant", target: "mobile_app_a_phone", label: null, enabled: true },
    { id: "a2", familyMemberId: memberA, familyMemberName: "A", provider: "home_assistant", target: "mobile_app_a_tablet", label: null, enabled: true },
    { id: "b1", familyMemberId: memberB, familyMemberName: "B", provider: "home_assistant", target: "mobile_app_b_phone", label: null, enabled: false },
  ]), { onUnmappedParticipants: (ids) => diagnostics.push(ids) });
  const routing = await service.resolveRecipientRouting([memberA, memberB]);
  assert.deepEqual(routing.destinations, [
    { id: "a1", familyMemberId: memberA, familyMemberName: "A", provider: "home_assistant", target: "mobile_app_a_phone", label: null },
    { id: "a2", familyMemberId: memberA, familyMemberName: "A", provider: "home_assistant", target: "mobile_app_a_tablet", label: null },
  ]);
  assert.deepEqual(routing.unmappedParticipantIds, [memberB]);
  assert.deepEqual(diagnostics, [[memberB]]);
  assert.deepEqual(await service.resolveRecipients([]), []);
});

test("updates enabled state and deletes destinations", async () => {
  const service = createNotificationDestinationService(repository([{ id: "a1", familyMemberId: memberA, familyMemberName: "A", provider: "home_assistant", target: "mobile_app_a_phone", label: null, enabled: true }]));
  assert.equal((await service.update("a1", { enabled: false })).success, true);
  assert.deepEqual(await service.resolveRecipients([memberA]), []);
  assert.equal((await service.delete("a1")).success, true);
});
