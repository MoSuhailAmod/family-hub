# Issue #33: ChatGPT → Google-side shopping write POC

**Status:** Partially superseded — see [Correction (2026-09-17)](#correction-2026-09-17). The Google Keep conclusions and the voice-input boundary still stand. The claim that no ChatGPT write mechanism exists on a personal Plus plan is **no longer accurate**, though a different constraint now gates the same path.

## Correction (2026-09-17)

This document is a point-in-time investigation record. Three of its conclusions have changed and are corrected here rather than rewritten in place, so the original reasoning stays auditable.

**1. Custom MCP write connectors are available on Plus and Pro.** The original "Explicitly rejected options" entry stated that OpenAI limits full MCP write support to eligible managed workspace plans. That is superseded: ChatGPT Developer Mode supports connecting custom remote MCP servers with both read and write tools on personal Plus and Pro accounts.[5][11] Plan eligibility is no longer the blocker.

**2. The real blocker is authentication, not plan tier.** ChatGPT custom connectors support **OAuth 2.1 or no authentication only**. They cannot present a static bearer token or API key, and do not support machine-to-machine grants such as client credentials, service accounts, or JWT bearer assertions.[11] Connecting Family Hub's existing `/mcp` server therefore requires either a full OAuth 2.1 authorization server plus discovery metadata, or exposing an endpoint publicly with no authentication at all. Both also require public HTTPS ingress, which the deployment does not have today — see `docs/deployment.md` and `docs/security.md`.

**3. The voice boundary below is unchanged and is now the decisive constraint.** ChatGPT voice mode cannot invoke MCP tools or connectors.[9] This applies to *any* backend, so it is not solved by changing the bridge. Even a fully implemented connector yields typed or dictated control only, never hands-free capture.

**Consequence:** the ChatGPT track is deferred by decision, not blocked by capability. It is now a cost/benefit judgement — public ingress plus OAuth 2.1, in exchange for text-only control — rather than an unavailable feature. See issue #32 for the current direction.

**Also note:** the Google Keep bridge architecture this document was written to evaluate has since been retired wholesale by issue #32, not merely gated. The Keep sync work referenced below (#34–#38, #41) is closed `not planned`. Treat the Keep sections here as historical rationale for *why* that architecture was abandoned.

## Decision

**Do not build a Google Keep adapter, a Google Tasks relay, or any production sync infrastructure for this path.** This PR records a verified product and API limitation; it does not satisfy the issue's real-account acceptance test and must not close that issue.

Google documents the Keep API as an enterprise-administrator API.[1] Its published `notes` resource has only `create`, `delete`, `get`, and `list` methods, so it has no documented update/patch operation for appending an item to one existing canonical shopping list note.[3] Although the API can create a new list note, creating a different note per request does not meet the canonical-list requirement.[2]

OpenAI now documents that personal ChatGPT accounts—including Plus—cannot create or publish new GPTs.[8]

ChatGPT app availability also varies by plan, region, workspace, role, model, and interface.[4]

A Custom GPT Action is therefore unavailable as a new integration route for the household's current plan, regardless of the Action OAuth model described elsewhere in OpenAI's documentation.[6][8]

## Voice and dictation boundary

The desired feature is a ChatGPT-originated shopping write that accepts voice input. That is not currently available through Custom GPT Actions: OpenAI documents that custom actions are unavailable in Voice conversations with GPTs.[9]

**ChatGPT Voice/Live is rejected for this POC.** Live does not support connected apps or plugins, and custom actions are not available in Voice conversations with GPTs.[9]

**Dictation is not equivalent to Voice/Live.** OpenAI describes Dictation as recording a single prompt, allowing the user to review/edit its transcription, then sending it as text.[9] Dictation could make ordinary text entry easier, but it does not provide a supported Plus-plan mechanism to create a new Custom GPT Action or execute this integration automatically.[8][9]

## Why Google Tasks is not an approved fallback

Google Tasks technically exposes `tasks.insert` to create a task in a specified list using the Google Tasks OAuth scope.[7] It is **not** selected as the canonical bridge.

Google's Assistant documentation says its shopping lists and Assistant notes/lists are saved in Google Keep, and Assistant can create, update, and delete those Keep lists after the user grants Keep access.[10] A ChatGPT → Google Tasks bridge would therefore create a second canonical list and would not prove that Google Nest/Assistant and ChatGPT write to the same household shopping list.[10]

Do not alter the downstream Keep sync work to use Tasks unless a separate design decision proves that Nest can target the selected Tasks list and that the household accepts the split-list trade-off.[10] That proof is not available here.

## Explicitly rejected options

- **Google Keep API:** cannot support the required documented mutation of an existing canonical list note.[1][3]
- **Keep scraping or private endpoints:** rejected by the issue stop conditions.
- **Custom GPT Action on the current personal Plus plan:** unavailable because new personal GPT creation/publishing is unavailable.[8]
- **ChatGPT Voice/Live plus Custom GPT Actions:** unsupported because custom actions are unavailable in Voice conversations with GPTs.[9]
- **Custom MCP write connector:** ~~not a Plus-plan alternative; OpenAI limits full MCP write support to eligible managed workspace plans.[5]~~ **Superseded 2026-09-17** — available on Plus and Pro via Developer Mode. Now gated by the OAuth-only authentication requirement and the lack of public HTTPS ingress, not by plan tier. See [Correction](#correction-2026-09-17).
- **Google Tasks as a silent substitute:** rejected because Google Assistant shopping lists are stored in Keep, not Tasks.[10]
- **Public/unauthenticated webhooks or direct PostgreSQL writes:** rejected by the issue's security and architecture constraints.

## What would reopen the investigation

Superseded by the [Correction](#correction-2026-09-17). Reopening is now a deliberate decision to accept cost, not a wait for a capability. Picking the ChatGPT track back up requires accepting **all** of:

1. **Public HTTPS ingress** to Family Hub, replacing the current LAN-only posture, with the hardening `docs/security.md` mandates before any exposure beyond the trusted LAN.
2. **An authentication choice**, both of which have real costs:
   - OAuth 2.1 — Family Hub as resource server plus an authorization server issuing tokens and publishing discovery metadata. Correct and reusable, but the largest single workstream in this area.
   - A narrowly scoped unauthenticated endpoint exposing shopping tools only — far cheaper, but a public write surface, and the calendar and spending tools must be provably unreachable from it.
3. **Accepting text-only control.** Voice remains unavailable for custom tools, so this buys conversational typing and dictation, not hands-free capture.

The Google Keep track is not reopenable on these terms — it was retired by issue #32 independently of ChatGPT, and #34–#38 and #41 are closed `not planned`.

## Evidence not claimed

No Google credentials were requested, stored, or tested during this work. No ChatGPT-originated item was created. No Google Nest behavior was tested. The required proof from the user's actual ChatGPT plan and a test item in the canonical list remains incomplete.

## Sources

[1] https://developers.google.com/workspace/keep/api/guides
[2] https://developers.google.com/workspace/keep/api/guides/create-notes
[3] https://developers.google.com/workspace/keep/api/reference/rest/v1/notes
[4] https://help.openai.com/en/articles/11487775-connectors-in-chatgpt
[5] https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
[6] https://help.openai.com/en/articles/9442513-configuring-actions-in-gpts
[7] https://developers.google.com/workspace/tasks/reference/rest/v1/tasks/insert
[8] https://help.openai.com/en/articles/8554397
[9] https://help.openai.com/en/articles/20001274-chatgpt-voice
[10] https://support.google.com/assistant/answer/14171370
[11] https://developers.openai.com/api/docs/guides/developer-mode
