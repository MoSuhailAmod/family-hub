# Issue #42: ChatGPT → Todoist shopping-write POC

**Status:** Research and test protocol ready. Real-account verification is pending; this document does not claim that ChatGPT or Todoist has been connected.

## Purpose and decision gate

This task tests whether the household's personal ChatGPT Plus account can use the Todoist integration to create tasks in one dedicated Todoist project. No Family Hub adapter, webhook receiver, database migration, or production sync code is part of this task.

**Proceed** only if every required real-account test below passes. **Stop** if ChatGPT cannot use the integration from the household's actual Plus account, cannot consistently target one project, or requires an unsuitable plan or unsupported/private interface.

## Canonical Todoist target

Create one Todoist project named **Family Shopping**. Record its returned Todoist project ID after creation; future work must use that stable ID rather than resolving the project by name on every sync.[1]

Todoist documents a REST API and a `/sync` API, and its API reference includes supported project and task create/read/update/delete/complete operations.[1] The API documentation also shows tasks associated with a `project_id`, so a later adapter can scope all reads and writes to this single project.[1]

## Real-account POC protocol

Complete these steps in the user's normal ChatGPT Plus account and record the result beneath each step:

| Test | Required result | Actual result |
| --- | --- | --- |
| Connect Todoist | Todoist is connected through the normal ChatGPT plugin/integration flow. | Pending |
| Target project | `Family Shopping` exists; record its Todoist project ID. | Pending |
| Basic write | Ask: `Add POC bread to my shopping list`; exactly one task with that exact content appears in `Family Shopping`. | Pending |
| Text fidelity | Ask: `Add 2L milk to my shopping list`; the task content is exactly `2L milk`. | Pending |
| Fresh conversation | Start a new ChatGPT conversation and add one harmless third test task without a full Todoist re-authentication. | Pending |
| Multiple items | Ask for two distinct harmless items in one prompt; record whether two tasks are created and whether targeting is consistent. | Pending |
| Duplicate prompt | Repeat one prompt once; record whether Todoist creates a second task. Duplicate tasks are expected to remain distinct unless the ChatGPT integration documents different behavior. | Pending |
| iOS text/dictation | Test the primary iOS ChatGPT text path and optional Dictation; record friction and confirmation behavior. | Pending |
| Voice/Live | Test only if the Todoist integration is available in that surface; otherwise record the limitation precisely. | Pending |

For every successful write, retain non-secret evidence in the issue or PR: the exact prompt, timestamp, target project name, and task text. Do not include Todoist tokens, authorization URLs containing secrets, or screenshots with credentials.

## UX observations to capture

- Whether Todoist must be explicitly selected or is invoked automatically.
- Whether ChatGPT shows a confirmation before the write.
- Whether the integration remembers the selected project in a fresh conversation.
- Whether iOS text and Dictation are practical for normal household use.
- Whether Voice/Live can invoke the integration; a limitation is a valid result and does not invalidate a passing text POC.

## Downstream technical viability

Todoist documents OAuth 2.0 for external applications, including registered redirect URLs.[2] Newly created Todoist OAuth applications can issue refresh tokens, and refresh tokens rotate after a successful refresh; a future server-side adapter must retain the newest token only in its deployment secret store.[2]

Todoist's reference exposes project and task lifecycle endpoints and documents webhooks, so the provider has supported surfaces to evaluate for a later inbound sync.[1][2] A later task must verify the exact subscribed events, signature-validation process, externally reachable HTTPS endpoint requirements, and replay/idempotency handling before enabling a webhook in production.

For later Family Hub work:

1. Store the selected Todoist project ID as configuration or securely provisioned integration state; do not use its display name as transport identity.
2. Treat Todoist task IDs as opaque provider identifiers and retain them in a separate external-mapping model, not in the core shopping item table.
3. Route every imported task through the existing Family Hub `shoppingService`; never write provider data directly to PostgreSQL.
4. Keep OAuth access and refresh tokens outside Git and browser/client source.

## Recommendation checkpoint

- **Pending:** Real-account ChatGPT Plus test has not yet been performed.
- **If the POC passes:** open a new implementation task for a narrow Todoist → Family Hub inbound adapter with persistent identity mapping, idempotent imports, and outage isolation.
- **If it fails:** comment the exact failure on Issue #42 and stop; do not substitute another provider without a new product decision.

## Sources

[1] https://developer.todoist.com/api/v1
[2] https://developer.todoist.com/guides
