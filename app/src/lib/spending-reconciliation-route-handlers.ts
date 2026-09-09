import type { createSpendingReconciliationService } from "./spending-reconciliation";

export type SpendingReconciliationService = Pick<
  ReturnType<typeof createSpendingReconciliationService>,
  "reconcile"
>;

export function createSpendingReconciliationRouteHandlers(service: SpendingReconciliationService) {
  return {
    async reconcileSnapshot(input: unknown) {
      const result = await service.reconcile(input);
      if (result.success) return Response.json(result);

      return Response.json(result, {
        status: result.code === "VALIDATION" ? 400 : result.code === "DOMAIN" ? 409 : 500,
      });
    },
  };
}
