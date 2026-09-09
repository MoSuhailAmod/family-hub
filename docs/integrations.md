# Integration architecture

Family Hub core owns household data and business validation. Integrations are adapters at the edge; they must not turn third-party services into the mandatory system of record or bypass core/service logic.

## Current implementation

- **MCP:** `/mcp` hosts a Family Hub MCP server with calendar and narrow Spending reconciliation/review tools. The tools call the shared service layers. Its transport/authentication posture must be treated according to [Security](security.md); adapter existence is not proof of safe public exposure.
- **Google Calendar:** `GET /api/events` can read optional configured Google Calendar ICS events and append them to the requested calendar range. It is an optional read-side integration, not a required intermediary or the canonical record for Family Hub events.
- **Home Assistant:** the notification worker has a Home Assistant transport configuration and is an edge delivery concern. It should use least-privilege credentials and must not move calendar business rules into Home Assistant.

## Target direction and open work

A direct ChatGPT-compatible client → authenticated MCP/tools → shared Family Hub services path is the desired architectural direction. The external authentication, authorization, network exposure, versioned contracts, and operational controls needed for that boundary are not documented as complete here.

Future shopping, gallery, voice/Google Nest research, and other modules should expose narrowly scoped tool adapters over their own shared services when they exist. Google Calendar, Home Assistant, and future voice platforms remain optional integrations rather than the core Family Hub backend.

When a new integration is implemented, document: the owning service functions, data authority, identity/secret handling, failure/retry behaviour, network boundary, and user-visible consistency rules. Avoid speculative implementation claims; link to the issue/design record until committed code exists.