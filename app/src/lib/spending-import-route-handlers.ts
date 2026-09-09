export type SpendingImportService = {
  import: (input: unknown) => Promise<
    | { success: true; status: "imported" | "duplicate" | "replaced" }
    | { success: false; code: "VALIDATION" | "PERSISTENCE"; error: string }
  >;
};

export function createSpendingImportRouteHandlers(service: SpendingImportService) {
  return {
    async importSnapshot(input: unknown) {
      const result = await service.import(input);
      if (!result.success) {
        return Response.json({ error: result.error }, {
          status: result.code === "VALIDATION" ? 400 : 500,
        });
      }
      return Response.json(result, { status: result.status === "imported" ? 201 : 200 });
    },
  };
}
