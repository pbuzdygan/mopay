# T-015: Configurable container storage identity

- Status: done
- Owner: Codex
- Created: 2026-10-05

## Outcome and acceptance

PUID/PGID configure numeric runtime and data ownership; omitted/empty values default independently to 1000. Root IDs and malformed/out-of-range values fail before ownership changes. Existing /data files transition to the selected owner; app runs non-root as PID1 and handles SIGTERM. DB permissions are checked as the final user. Document deployment and rollback without changing production data.

## Scope and constraints

Entrypoint, Docker tests, Compose examples, README/configuration guide, changelog and project notes. No dependencies/schema/API changes. Ownership repair is limited to /data, not application source or arbitrary DB directories. Custom DB paths outside /data require existing writable storage. Export the Docker DB default so the checked path matches the backend's actual path. Test only disposable tmpfs, network none, read-only image; never run deployment Compose.

## Steps

- [x] Implement validated PUID/PGID and privilege-drop permission checks.
- [x] Verify default/custom identities, data transition, invalid/denied cases and signals in actual image.
- [x] Document configuration, manual permissions, rollback and close shared state.

## Security and rollback

Numeric IDs 1..2147483647 only, no inherited supplementary groups after root drop. Secrets/auth/API/rendering/outbound requests not changed. Permission changes affect mounted /data; stop the service and back up data before changing identity. Roll back by restoring PUID/PGID=1000 and owner/permissions, keeping encryption key and database unchanged. Production/rootless/NFS deployment remains user verification.

## Verification

- `docker build -t mopay-local-security:t015 .`: passed (frontend build included; existing >500kB chunk warning only).
- `MOPAY_TEST_IMAGE=mopay-local-security:t015 node --test docker/tests/entrypoint.test.mjs`: 17/17 passed. Default/independent/empty/custom UID/GID, real SQLite/WAL ownership, /app ownership unchanged, explicit non-root user, malformed/root IDs (20 denial fixtures), mismatched identity, default→custom→default data preservation, file/directory/ownership/drop-privilege failures, nested data path, PID1/SIGTERM.
- `docker run --rm --network none --read-only --security-opt no-new-privileges:true --tmpfs /data:rw,nosuid,nodev,size=16m,mode=0700 --tmpfs /tmp:rw,nosuid,nodev,size=16m,mode=1777 -e PUID=2000 -e PGID=3000 --mount type=bind,src=/tmp/mopay-t015-image-smoke.mjs,dst=/verify.mjs,readonly mopay-local-security:t015 node /verify.mjs`: passed. Actual default DB path, native SQLite, server health, PIN auth, auth denial, bounded XLSX worker/import and browser headers; synthetic credentials only.
- `sh -n docker/entrypoint.sh`, `node --check docker/tests/entrypoint.test.mjs`, `git diff --check`: passed.
- `docker compose -f docker-compose.yml config --quiet --no-interpolate` and equivalent for `local-build-docker-compose.yml`: passed; static validation only, examples never started.
- `python3 /tmp/mopay-t015-check-docs.py`: 101 relative links/fragments and Markdown fences passed.

Security evidence: storage boundary limited to /data, final access check runs non-root; IDs bounded and validated before permission mutations; no supplementary group inheritance after root drop; default and custom denied paths verified. No dependency/schema/auth/secret changes. Production mounts, NFS/rootless UID mapping remain unverified. No production deployment, commit or push performed. Rollback described in Configuration.
