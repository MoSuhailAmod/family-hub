# Backups and recovery

## What to protect

At minimum, protect PostgreSQL data in the `postgres_data` Compose volume. Also protect the deployed application revision and required private configuration/secrets using a secure mechanism outside Git. A database backup contains household data and must receive the same access controls as the production database.

Take and verify a fresh backup before every migration or destructive data operation. Generated migrations are code and should be reviewed before apply; a backup is not a reason to skip that review.

## Backup procedure

The exact destination is intentionally deployment-specific and must not be committed with private paths or credentials. From the deployment LXC, use a PostgreSQL logical dump to protected storage, for example:

```bash
# The container receives these values from Compose; the host shell does not need them.
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > family-hub-$(date +%F-%H%M%S).dump
docker compose exec -T postgres sh -c 'pg_restore --list' < family-hub-YYYY-MM-DD-HHMMSS.dump > /dev/null
```

Record the timestamp, repository revision, migration state, and a safe storage reference in the normal operations record. For stronger verification, restore to an isolated temporary PostgreSQL instance and inspect expected tables/data; a non-empty dump file alone is not sufficient proof of recoverability.

## Restore at a high level

1. Stop app and worker writes (`docker compose stop app notification-worker`) and preserve the failed state/logs if investigating an incident.
2. Confirm the backup identity and the target database. Do not restore over a working database without an additional current backup.
3. Restore into a clean/recreated target database using `pg_restore` (or the chosen documented backup mechanism).
4. Start PostgreSQL and run the app migration workflow only after checking whether the restored schema already matches the intended application revision. Do not blindly apply new migrations to an unknown restore.
5. Start the Compose services and verify `GET /api/health/db`, a calendar range, expected members/categories, and any affected module data.

## Migration recovery

If a migration fails, keep services stopped as needed to avoid mixed application/schema states. Inspect the migration history and database state, restore the pre-migration backup when required, correct the migration in source control, and redeploy through the normal Compose migration service. Do not patch production schema manually as a routine recovery technique; create a tracked corrective migration.

## Recovery checklist

- [ ] Backup can be listed/restored in an isolated environment.
- [ ] Intended database and application revision are identified.
- [ ] Compose migration completed successfully.
- [ ] `curl --fail http://localhost:3000/api/health/db` succeeds.
- [ ] Calendar reads and changed business flows work.
- [ ] Worker starts and has no unexpected persistence errors.
- [ ] Backup artifacts remain protected and retention is handled by the deployment operation.

See [Deployment](deployment.md) and [Database](database.md).