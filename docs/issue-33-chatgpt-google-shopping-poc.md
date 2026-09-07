# Issue #33: ChatGPT → Google-side shopping write POC

**Status:** Stop condition confirmed — no supported ChatGPT write path is available on the household's current personal ChatGPT Plus plan.[8]

## Decision

**Do not build a Google Keep adapter, a Google Tasks relay, or any production sync infrastructure for this path.** This PR records a verified product and API limitation; it does not satisfy Issue #33's real-account acceptance test and must not close that issue.[1][3][8]

Google documents the Keep API as an enterprise-administrator API.[1] Its published `notes` resource has only `create`, `delete`, `get`, and `list` methods, so it has no documented update/patch operation for appending an item to one existing canonical shopping list note.[3] Although the API can create a new list note, creating a different note per request does not meet the canonical-list requirement.[2]

OpenAI now documents that personal ChatGPT accounts—including Plus—cannot create or publish new GPTs.[8] ChatGPT app availability also varies by plan, region, workspace, role, model, and interface.[4] A Custom GPT Action is therefore unavailable as a new integration route for the household's current plan, regardless of the Action OAuth model described elsewhere in OpenAI's documentation.[6][8]

## Voice and dictation boundary

The desired feature is a ChatGPT-originated shopping write that accepts voice input. That is not currently available through Custom GPT Actions: OpenAI documents that custom actions are unavailable in Voice conversations with GPTs.[9]

**ChatGPT Voice/Live is rejected for this POC.** Live does not support connected apps or plugins, and custom actions are not available in Voice conversations with GPTs.[9]

**Dictation is not equivalent to Voice/Live.** OpenAI describes Dictation as recording a single prompt, allowing the user to review/edit its transcription, then sending it as text.[9] Dictation could make ordinary text entry easier, but it does not provide a supported Plus-plan mechanism to create a new Custom GPT Action or execute this integration automatically.[8][9]

## Why Google Tasks is not an approved fallback

Google Tasks technically exposes `tasks.insert` to create a task in a specified list using the Google Tasks OAuth scope.[7] It is **not** selected as the canonical bridge.

Google's Assistant documentation says its shopping lists and Assistant notes/lists are saved in Google Keep, and Assistant can create, update, and delete those Keep lists after the user grants Keep access.[10] A ChatGPT → Google Tasks bridge would therefore create a second canonical list and would not prove that Google Nest/Assistant and ChatGPT write to the same household shopping list.[10]

Do not alter downstream issues #34–#38 from Keep to Tasks unless a separate design decision proves that Nest can target the selected Tasks list and that the household accepts the split-list trade-off.[10] That proof is not available here.

## Explicitly rejected options

- **Google Keep API:** cannot support the required documented mutation of an existing canonical list note.[1][3]
- **Keep scraping or private endpoints:** rejected by the issue stop conditions.
- **Custom GPT Action on the current personal Plus plan:** unavailable because new personal GPT creation/publishing is unavailable.[8]
- **ChatGPT Voice/Live plus Custom GPT Actions:** unsupported because custom actions are unavailable in Voice conversations with GPTs.[9]
- **Custom MCP write connector:** not a Plus-plan alternative; OpenAI limits full MCP write support to eligible managed workspace plans.[5]
- **Google Tasks as a silent substitute:** rejected because Google Assistant shopping lists are stored in Keep, not Tasks.[10]
- **Public/unauthenticated webhooks or direct PostgreSQL writes:** rejected by the issue's security and architecture constraints.

## What would reopen the investigation

Only one of the following evidence-backed changes justifies reopening Issue #33:

1. The household moves to an eligible managed ChatGPT workspace and can create a Custom GPT Action; a **text-only** real-account proof is then required. Voice support still needs independent validation because it remains unavailable for Custom GPT Actions.[8][9]
2. A supported, Plus-compatible existing ChatGPT plugin/app is identified that can write a single canonical Google Keep shopping list; it must be tested from the household account with a real test item.
3. Google publishes a supported Keep API mutation that can append/update an existing list item and a supported ChatGPT surface can invoke the authenticated adapter on the household's plan.

Until then, preserve Google Keep as the Google Nest/Assistant shopping-list store and treat ChatGPT shopping write integration as blocked. Issue #34 and the later Keep sync tasks remain gated behind an accepted supported architecture and a real-account proof.

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
