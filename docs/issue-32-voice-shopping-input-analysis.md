# Voice-driven shopping input: analysis

**Issue:** [#32](https://github.com/MoSuhailAmod/family-hub/issues/32) — add shopping items via ChatGPT and Google Nest
**Date:** 2026-09-18
**Status:** Analysis complete. ChatGPT and Google Nest tracks deferred; a phone-native voice path is recommended and not yet implemented.

## Goal

Add items to the Family Hub shopping list by speaking rather than typing, because items are usually remembered away from a keyboard. Issue #32 names two target surfaces: ChatGPT and a Google Nest speaker.

This document records what was investigated, what each option actually delivers, and why the recommendation differs from the approach originally proposed in the issue.

## Summary of conclusions

1. **The Todoist bridge proposed in issue #32 is not recommended.** The constraint that motivated it no longer applies, and Family Hub can now serve the same purpose directly.
2. **ChatGPT cannot deliver hands-free voice at all**, regardless of which backend it talks to. This is a limitation of the ChatGPT surface, not of any bridge, so no choice of transport resolves it.
3. **Google Nest has no supported free-text capture route** for third-party lists.
4. **The only option that delivers genuine hands-free voice** is a phone-native voice shortcut posting directly to Family Hub — an approach issue #32 does not consider.

The architectural rules in issue #32 are sound and are preserved throughout: Family Hub is the source of truth, external systems are adapters only, and all writes go through the shared shopping service.

## Current implementation

Verified against the codebase on 2026-09-18.

| Component | State |
| --- | --- |
| `app/src/lib/shopping.ts` | Exports the shared `shoppingService` singleton. Its docstring already reserves it for "future HTTP and MCP adapters". |
| `app/src/lib/shopping-service.ts` | `list`, `getById`, `create`, `update`, `setCompleted`, `delete`. Accepts `unknown` and validates internally, so non-HTTP callers get identical rules. |
| `app/src/lib/shopping-validation.ts` | Zod validation. `name` trimmed and required; `quantity`/`notes` optional. Throws `ShoppingValidationError`. |
| `app/src/app/api/shopping-items/` | `GET`/`POST` collection, `GET`/`PATCH`/`DELETE` by id. **Unauthenticated** — LAN-trust model. |
| `app/src/lib/mcp/server.ts` | MCP server with **13 registered tools** (calendar, spending, family members, categories). **No shopping tools.** |
| `app/src/app/mcp/route.ts` | Serves `/mcp`. **No authentication, no CORS.** |
| `app/src/app/shopping/page.tsx` | Fetches on mount and after local mutations. **No polling** — externally added items appear on manual refresh. |

The relevant gap is narrow: the shared service exists and is adapter-ready, but no shopping tools are exposed over MCP, and there is no authenticated path for a non-browser caller.

## Constraints discovered

### ChatGPT custom MCP connectors are available on Plus and Pro

[`issue-33-chatgpt-google-shopping-poc.md`](issue-33-chatgpt-google-shopping-poc.md) recorded that "OpenAI limits full MCP write support to eligible managed workspace plans," and that conclusion is why issue #32 pivoted to Todoist as a bridge.

That is no longer accurate. ChatGPT Developer Mode supports connecting custom remote MCP servers with both read and write tools on personal Plus and Pro accounts.[1][2] Plan eligibility is not a blocker.

This materially changes the design, because Family Hub already runs an MCP server. A correction to the issue-33 document is in PR [#128](https://github.com/MoSuhailAmod/family-hub/pull/128); until that merges, the version on `main` still states the superseded claim.

### ChatGPT voice mode cannot invoke tools

ChatGPT voice mode cannot invoke MCP tools or connected apps.[2][3] A spoken "add bread to my shopping list" therefore fails whether the backend is Todoist, Family Hub's MCP server, or anything else.

Only dictation — speech transcribed into the composer and sent as text — reaches tools. Dictation is a typing convenience, not hands-free capture.

**This is the single most important finding**, because voice is the actual requirement. Issue #32's Priority 1 target experience is not achievable through ChatGPT as written, and the Todoist design inherits the limitation without acknowledging it.

### ChatGPT connectors cannot use API keys

Custom connectors support **OAuth 2.1 or no authentication only**. They cannot present a static bearer token or API key, and do not support machine-to-machine grants such as client credentials, service accounts, or JWT bearer assertions.[1]

Connecting Family Hub's `/mcp` endpoint therefore requires either a full OAuth 2.1 authorization server with discovery metadata, or a publicly exposed unauthenticated endpoint. Both additionally require public HTTPS ingress, which the deployment does not have — see [Deployment](deployment.md) and [Security](security.md).

### Google Nest has no supported third-party list route

Google ended third-party notes and lists integration in June 2023 and keeps Assistant lists in its own store.[4] Reports of partial restoration relate to a partner programme, not an open API, and could not be corroborated.

Consequently Nest cannot be pointed at a Todoist list either, which removes the "both surfaces converge on one transport" argument that was Todoist's main architectural appeal. The two tracks were always going to need separate adapters.

## Options evaluated

| Option | Delivers voice | Cost | Verdict |
| --- | --- | --- | --- |
| **Phone voice shortcut → Family Hub** | **Yes, hands-free** | One auth boundary, one route, one Shortcut | **Recommended** |
| ChatGPT → custom MCP connector → Family Hub | No — typed/dictated only | Public HTTPS ingress + OAuth 2.1 authorization server | Deferred |
| ChatGPT → Todoist → webhook → Family Hub | No — typed/dictated only | Second account, OAuth, webhook ingestion, external-ID mapping, polling fallback, dedupe, outage recovery, eventual bidirectional sync | Not recommended |
| Google Nest → any third-party list | No supported route | n/a | Blocked |
| Google Keep bridge | No | n/a | Retired by issue #32 |

The Todoist option is rejected specifically because it adds an entire subsystem to reach a capability the application nearly has natively, while delivering no voice capability the direct connector would not also deliver.

## Recommended approach

A phone-native voice shortcut posting directly to Family Hub over a private network path.

```text
iOS Shortcut ("Hey Siri, add to shopping list")
     ↓ dictated text, split into items
     ↓ authenticated POST over Tailscale
Family Hub external write route
     ↓
shoppingService.create(...)
     ↓
PostgreSQL → Shopping UI
```

Properties that make this the right choice:

- **It is genuinely hands-free**, which no ChatGPT-based option is.
- **No third-party account or second backend** — nothing to keep in sync, no idempotency mapping, no outage story.
- **No public exposure** — a private mesh reaches the LXC without opening the application to the internet, preserving the trust model in [Security](security.md).
- **It honours the issue's architecture** — the write goes through `shoppingService` like every other caller.

The trade-off to accept: this is a phone-based capture path, not a kitchen speaker. Nest remains unsolved, and no supported route to solve it currently exists.

## Implementation outline

Not yet implemented. Four pieces, in order:

1. **Shopping tools on the existing MCP server** (`app/src/lib/mcp/server.ts`) — `shopping_list_items`, `shopping_create_item`, `shopping_complete_item`, following the existing `calendar_*` registration pattern and wired to the `shoppingService` singleton. A delete tool is deliberately omitted: irreversible, ambiguous to match by name, and already covered by the UI.

   Note that `shoppingService` throws `ShoppingValidationError` rather than returning a `{success}` shape as the calendar services do, so these tools need an explicit error mapping: validation errors surface their own message; anything else is logged server-side and returns a generic failure.

2. **A bearer-token boundary** — a small helper, not middleware, so the browser-facing `/api/*` routes are untouched. Fails closed when unconfigured, compares digests with a constant-time comparison, and returns one non-disclosing `401` for every failure mode. Note that the MCP SDK's `authInfo` is strict pass-through and never derived from headers, so verification must happen in the route.

3. **An authenticated external write route** — delegating to the existing shopping create handler so there is a single data path and identical validation semantics.

4. **The iOS Shortcut** — dictate, split on `, ` and ` and ` so one utterance can add several items, then POST each. Splitting stays client-side so the server does no natural-language guessing.

Items 1–3 are also the prerequisite for the ChatGPT track if it is ever picked up, so none of this work is wasted by deferring it.

## Security considerations

- The shopping API and `/mcp` are currently unauthenticated under the LAN-trust model. Any non-browser caller requires the boundary described above before it is reachable from anywhere else.
- [Security](security.md) requires a machine identity distinct from `family_members`, least-privilege tool authorization, transport protection, secret rotation and non-disclosing errors before exposure beyond the trusted LAN. A private mesh satisfies transport protection without TLS termination or open ports.
- Secrets stay outside Git, consistent with existing practice.
- Exposing `/mcp` publicly without authentication would expose all 13 existing tools, including destructive spending and calendar operations — not only shopping. Any future unauthenticated option must therefore serve a separately scoped endpoint.

## Decisions

| Decision | Rationale |
| --- | --- |
| Todoist bridge not pursued | Superseded by direct MCP support; large subsystem for no additional capability |
| ChatGPT track deferred | Costs public ingress plus OAuth 2.1, and returns typed control only, never voice |
| Google Nest parked | No supported free-text route exists |
| Phone shortcut recommended | The only option delivering hands-free voice |
| Google Keep not revisited | Retired by issue #32; #34–#38 and #41 closed `not planned` |

## Follow-up tasks

1. Add shopping tools to the MCP server.
2. Add the bearer-token helper and protect `/mcp`.
3. Add the authenticated external write route.
4. Build and document the iOS Shortcut; verify end to end over the private network path.
5. Update [APIs and services](api-and-services.md), [Security](security.md) and [Integrations](integrations.md) once the above lands.
6. Merge PR #128 so the superseded claim in the issue-33 document stops misleading future work.

Revisit the ChatGPT track only if text-driven control becomes desirable enough to justify public ingress and an OAuth 2.1 implementation. Revisit Nest only on credible evidence of a supported route.

## Sources

[1] https://developers.openai.com/api/docs/guides/developer-mode
[2] https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
[3] https://help.openai.com/en/articles/20001274-chatgpt-voice
[4] https://support.google.com/assistant/answer/14171370

See also [issue-33 POC findings](issue-33-chatgpt-google-shopping-poc.md), [Shopping v1 data model](shopping-v1-data-model.md), and [APIs and services](api-and-services.md).
