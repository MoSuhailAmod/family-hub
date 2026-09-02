export type ShoppingMutation =
  | "add"
  | "edit"
  | "complete"
  | "restore"
  | "remove";

const mutationVerbs: Record<ShoppingMutation, string> = {
  add: "added",
  edit: "updated",
  complete: "completed",
  restore: "restored",
  remove: "removed",
};

export function shoppingSuccessMessage(
  mutation: ShoppingMutation,
  name: string,
) {
  return `${name} ${mutationVerbs[mutation]}`;
}
