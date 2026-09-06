# Issue #33: ChatGPT → Google-side shopping write POC

**Status:** Decision complete — do not build a Google Keep sync adapter.

## Decision

**Stop the Google Keep route. Change the target Google-side canonical list to Google Tasks only if a user-run ChatGPT proof succeeds.** No production adapter, webhook, or credential handling is introduced by this issue.[1][3]

The official Keep API is presented as an enterprise-administrator API, and its published `notes` resource has only `create`, `delete`, `get`, and `list` methods—there is no documented update/patch method for adding one item to an existing canonical list note.[1][3] The API can create a new list note, but that does not meet the requirement to append to one selected shopping list.[2]

Google Tasks is the supported fallback candidate. Its public `tasks.insert` endpoint creates one task in a specified task list and requires the `https://www.googleapis.com/auth/tasks` OAuth scope.[7]

## Chosen POC architecture

```text
ChatGPT custom GPT (text)
        │ action with OAuth
        ▼
Narrow Family Hub Google Tasks relay
        │ server-side refresh token only
        ▼
Google Tasks: selected canonical shopping list
        │
        └── returns provider task ID and normalized title
```

The relay exposes exactly one write operation:

```text
add_shopping_item(name: string) -> { externalId: string, name: string }
```

It must reject blank input, target one configured task-list ID, call Google Tasks `tasks.insert`, and return the provider-created ID.[7] It must not expose generic Google API access, arbitrary list IDs, provider credentials, or a public unauthenticated write endpoint.

A Custom GPT action is the appropriate ChatGPT-side mechanism to evaluate: OpenAI documents actions as OpenAPI-described external APIs with OAuth support.[6] ChatGPT app availability varies by plan, region, interface, and app configuration, and Voice mode currently does not support apps.[4] Therefore the required first proof is **text in the user's actual ChatGPT surface**, not a local HTTP-only test.[4]

## Authentication and secret model

1. Create a Google OAuth client for the relay and request only the Google Tasks scope required by `tasks.insert`.[7]
2. The household account owner completes OAuth once in the relay's server-side authorization flow, consistent with the OAuth requirement for the Google Tasks write scope.[7]
3. Store the refresh token in the deployment secret store/host configuration, never in Git, client JavaScript, or the ChatGPT Action schema.
4. Configure the Custom GPT action to authenticate to the relay using OAuth; OpenAI documents OAuth as an Action authentication option.[6]
5. Restrict the relay to the configured canonical task-list ID and the single add operation required by `tasks.insert`.[7]

For ChatGPT custom apps with MCP write actions, OpenAI's current full-MCP support is limited to Business and Enterprise/Edu plans; Pro supports custom apps with read/fetch permissions only.[5] This is why this POC uses a Custom GPT **Action**, not a custom MCP write connector.

## Required user-run acceptance test

The following must be completed before any implementation work for Issue #34 begins:

1. Confirm the user's ChatGPT plan supports creating and using a Custom GPT with Actions.[6]
2. Configure the action against a deployed authenticated relay using its OpenAPI schema and OAuth callback, both documented Action configuration concepts.[6]
3. In a normal ChatGPT **text** conversation with that GPT, ask: `Add POC bread to my shopping list`.
4. Confirm the relay log records one authenticated request and one successful Google Tasks `tasks.insert` response.[7]
5. Confirm exactly one task named `POC bread` appears in the configured canonical Google Tasks list.[7]
6. Repeat with `2L milk`; confirm the text is preserved as `2L milk`.
7. Start a fresh ChatGPT conversation and repeat once to prove the connection does not require authentication for every request.
8. Remove both POC tasks after evidence is captured.

A successful local relay test alone is insufficient; the request must originate from the user's real ChatGPT account and interface. A voice proof is explicitly deferred because ChatGPT Voice mode does not support apps.[4]

## Explicit rejections

- **Google Keep API:** rejected for this feature because its documented interface cannot mutate an existing canonical list note.[1][3]
- **Keep scraping/private endpoints:** rejected by the issue stop conditions.
- **Unauthenticated/public webhook:** rejected; it would permit arbitrary shopping-list writes.
- **Custom MCP write connector:** rejected for this household POC unless the user has an eligible Business or Enterprise/Edu workspace.[5]
- **Direct PostgreSQL writes:** rejected; any later inbound sync must use the Family Hub shopping service as required by Issue #34.

## Outcome and next gate

**Recommendation: change approach, pending the user-run Custom GPT Action + Google Tasks acceptance test.** If the user cannot create/use Actions in their current ChatGPT plan or surface, stop this path and record the plan limitation; do not implement a developer-only workaround.[4][6] If the test passes, revise child issues #34–#37 from Google Keep to Google Tasks before implementing sync, identity mapping, or bidirectional behavior.

No Google credentials were requested, stored, or tested during this repository work. No claim is made that a ChatGPT-originated item has been created: that verification requires the user's authenticated ChatGPT and Google environments.

## Sources

[1] https://developers.google.com/workspace/keep/api/guides
[2] https://developers.google.com/workspace/keep/api/guides/create-notes
[3] https://developers.google.com/workspace/keep/api/reference/rest/v1/notes
[4] https://help.openai.com/en/articles/11487775-connectors-in-chatgpt
[5] https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
[6] https://help.openai.com/en/articles/9442513-configuring-actions-in-gpts
[7] https://developers.google.com/workspace/tasks/reference/rest/v1/tasks/insert
