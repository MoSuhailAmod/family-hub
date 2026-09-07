# Issue #45: Family Hub → Home Assistant mobile-notification POC

**Status:** The reusable server-side POC client and test protocol are ready. No real Home Assistant request or phone-delivery claim has been made from this development environment.

## Approved transport contract

Home Assistant exposes a JSON REST API under `/api/` and requires `Authorization: Bearer <long-lived-access-token>` for authenticated calls.[1] Companion App mobile notification targets are Home Assistant notify services named `notify.mobile_app_<device_id>`, with a notification `message` required in the payload.[2]

The POC sends a `POST` to:

```text
{HOME_ASSISTANT_URL}/api/services/notify/{HOME_ASSISTANT_NOTIFY_SERVICE}
```

with a server-only Bearer token and this body:

```json
{
  "title": "Family Hub notification POC",
  "message": "If you can see this, Family Hub → Home Assistant → phone delivery works."
}
```

The configured `HOME_ASSISTANT_NOTIFY_SERVICE` value must omit the `notify.` prefix and begin with `mobile_app_`; for example, `mobile_app_family_phone`.[2] This restriction makes the POC deliberately target a Companion App device rather than an unrelated notify service.

## Required server-side configuration

Configure these only in the Family Hub LXC/container's deployment environment or secret store. Do not add their real values to Git, `.env.example`, client-side code, GitHub issues, PRs, or logs.

```dotenv
HOME_ASSISTANT_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=<dedicated-long-lived-access-token>
HOME_ASSISTANT_NOTIFY_SERVICE=mobile_app_<device_id>
```

The token must be a dedicated Home Assistant long-lived access token created for this server integration. The companion service name can be confirmed in Home Assistant's developer/service UI or the Companion App configuration, where mobile targets are listed with the `notify.mobile_app_` prefix.[2]

## Run from the actual Family Hub environment

From the checked-out repository's `app/` directory in the Family Hub LXC/container:

```bash
npx tsx scripts/home-assistant-notification-poc.ts
```

A successful provider acceptance returns a token-free JSON summary like:

```json
{"ok":true,"provider":"home-assistant","targetService":"mobile_app_<device_id>","accepted":true,"status":200}
```

Provider acceptance is not enough to complete the POC: confirm the notification visibly arrives on the target household phone.

## Failure contract

The POC applies a 10-second abort timeout and never emits the authorization header or token value. It reports these categories:

| Failure kind | Meaning | Required POC response |
| --- | --- | --- |
| `configuration` | missing/invalid URL, token, service, or message | correct server environment configuration; do not log the secret |
| `authentication` | Home Assistant returned 401 or 403 | rotate/check the dedicated token and verify the server URL |
| `target` | invalid service format or Home Assistant returned 404 | select an actual `notify.mobile_app_<device_id>` target |
| `timeout` | request did not finish within 10 seconds | verify LXC → Home Assistant LAN routing and Home Assistant availability |
| `network` | request failed before provider acceptance | verify DNS/IP, port, firewall, and container routing |
| `provider` | another non-success Home Assistant response | record HTTP status and safe response context before proceeding |

Home Assistant documents 200/201 as successful API responses and identifies 400, 401, 404, and 405 as common non-success statuses.[1]

## Real-environment acceptance checklist

- [ ] `HOME_ASSISTANT_URL` resolves and is reachable from the Family Hub LXC over the LAN.
- [ ] The LXC has a dedicated long-lived access token configured only server-side.
- [ ] An actual Companion App `notify.mobile_app_<device_id>` service has been identified.
- [ ] The command returns provider acceptance without exposing a token.
- [ ] The target household phone visibly receives the exact POC notification.
- [ ] An invalid/absent token or invalid target has been checked and classified safely.
- [ ] The result is recorded as **proceed with Home Assistant** or **stop/change provider** before any reminder scheduler or persistence work.

## Scope boundary

This POC is transport-only. It adds no reminder database model, calendar scheduling, retry queue, user notification preferences, UI, public endpoint, or alternative provider. A later provider adapter must preserve this server-side boundary and keep Family Hub—not Home Assistant—as the owner of reminder schedules and business rules.

## Sources

[1] https://developers.home-assistant.io/docs/api/rest
[2] https://companion.home-assistant.io/docs/notifications/notifications-basic
