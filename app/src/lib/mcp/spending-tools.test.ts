import assert from "node:assert/strict";
import test from "node:test";

import { createFamilyHubMcpServerWithDependencies } from "./server";

const period = {
  sourceProducer: "household-spending-generator",
  sourcePeriodKey: "2026-08",
  startDate: "2026-08-01",
  endDate: "2026-08-31",
  currency: "ZAR",
  total: "100.00",
  sourceDocumentId: "spending-2026-08",
  sourceRevision: "1",
  sourceIssuedAt: new Date("2026-09-01T07:30:00.000Z"),
  importedAt: new Date("2026-09-01T08:00:00.000Z"),
};

test("registers Spending MCP reconciliation and review tools over shared services", async () => {
  const server = createFamilyHubMcpServerWithDependencies({
    spendingService: {
      listPeriods: async () => [period],
      getPeriod: async () => period,
      listImportMetadata: async () => [{ ...period, contentSha256: "a".repeat(64) }],
    },
    spendingReconciliationService: {
      reconcile: async () => ({
        success: true as const,
        summary: {
          processed: 1,
          inserted: [period.sourcePeriodKey],
          updated: [],
          unchanged: [],
          partialRefreshed: [],
          completedFromPartial: [],
        },
      }),
    },
  });
  const tools = (server as unknown as {
    _registeredTools: Record<string, { handler: (input: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }> }>;
  })._registeredTools;

  assert.deepEqual(
    ["spending_list_periods", "spending_get_period", "spending_list_imports", "spending_reconcile_snapshot"].map(
      (name) => Boolean(tools[name]),
    ),
    [true, true, true, true],
  );

  const periods = await tools.spending_list_periods.handler({});
  const reconciled = await tools.spending_reconcile_snapshot.handler({
    snapshot: { schemaVersion: "spending-reconciliation/v1" },
  });

  assert.deepEqual(JSON.parse(periods.content[0].text), {
    success: true,
    data: [{
      ...period,
      sourceIssuedAt: period.sourceIssuedAt.toISOString(),
      importedAt: period.importedAt.toISOString(),
    }],
  });
  assert.deepEqual(JSON.parse(reconciled.content[0].text), {
    success: true,
    summary: {
      processed: 1,
      inserted: ["2026-08"],
      updated: [],
      unchanged: [],
      partialRefreshed: [],
      completedFromPartial: [],
    },
  });
});

test("marks safe Spending reconciliation failures as MCP errors", async () => {
  const server = createFamilyHubMcpServerWithDependencies({
    spendingReconciliationService: {
      reconcile: async () => ({
        success: false as const,
        code: "VALIDATION" as const,
        error: "periods.0.total: Must be a signed decimal string",
      }),
    },
  });
  const tool = (server as unknown as {
    _registeredTools: Record<string, { handler: (input: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }> }>;
  })._registeredTools.spending_reconcile_snapshot;

  const result = await tool.handler({ snapshot: {} });

  assert.equal(result.isError, true);
  assert.deepEqual(JSON.parse(result.content[0].text), {
    success: false,
    code: "VALIDATION",
    error: "periods.0.total: Must be a signed decimal string",
  });
});
