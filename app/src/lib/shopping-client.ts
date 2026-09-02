export type ShoppingApiRequest = {
  method: "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

export async function requestShoppingApi(
  fetcher: typeof fetch,
  id: string,
  request: ShoppingApiRequest,
) {
  const response = await fetcher(`/api/shopping-items/${id}`, {
    method: request.method,
    headers: request.body ? { "Content-Type": "application/json" } : undefined,
    body: request.body ? JSON.stringify(request.body) : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Shopping request failed");
  }

  return response.status === 204 ? null : response.json();
}
