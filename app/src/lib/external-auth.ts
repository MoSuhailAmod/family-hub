export function requireExternalToken(
  request: Request,
  environment: NodeJS.ProcessEnv = process.env,
): Response | null {
  const expected = environment.FAMILY_HUB_EXTERNAL_TOKEN?.trim();
  const presented = /^Bearer\s+(.+)$/i.exec(
    request.headers.get("authorization") ?? "",
  )?.[1]?.trim();

  if (!expected) {
    console.error("FAMILY_HUB_EXTERNAL_TOKEN is not configured; rejecting request");
  }

  if (expected && presented && presented === expected) {
    return null;
  }

  return Response.json(
    { error: "Unauthorized" },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="family-hub"' } },
  );
}
