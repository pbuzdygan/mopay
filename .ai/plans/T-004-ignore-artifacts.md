# T-004: Exclude local artifacts from Git and Docker

- Owner: Codex
- Status: done
- Scope: `.gitignore`, `.dockerignore`, v1.6.2 changelog; preserve existing changes.

## Acceptance

- Ignore Node dependencies, generated builds/caches/test reports, local environment files, SQLite databases/sidecars, data volumes, logs and editor/OS temporary files.
- Preserve application sources, package lockfiles, schema, public assets and configuration examples.
- Exclude local secrets/data and test sources/artifacts from Docker context while retaining every Dockerfile COPY input.
- Verify Git patterns against positive/negative fixture paths, inspect already tracked artifacts and validate Docker context filtering when the local engine is available.
- No production configuration/data changes, commit, push or deployment.

## Decisions and verification

- User confirmed: source tests remain versioned; ignore their generated output and exclude sources from Docker builds.
- Existing `.gitignore` contains only local Codex and archive exclusions; existing `.dockerignore` fails to actively exclude `data/`, `.env`, logs and test artifacts.
- Expanded `.gitignore` and replaced commented-out/insufficient `.dockerignore` rules with active grouped exclusions. Preserved local STATE.md ignore and existing archive exclusion.
- Found global Git `*.sql` ignore; added an explicit exception for required `backend/schema.sql`.
- Updated v1.6.2 changelog.
- `python3 /tmp/mopay-T004-ignore-check.py`: passed 55 excluded and 29 retained Git paths using `git check-ignore --no-index -q`; synthetic fixtures only.
- `docker buildx build --network=none --progress=plain --output type=local,dest=/tmp/mopay-T004-context-export-full /tmp/mopay-T004-context`: passed using `FROM scratch` + `COPY . /`. Synthetic counterparts of all 118 tracked Docker COPY inputs; output inspection confirmed 75 exclusions and 111 retained paths.
- `git check-ignore -v frontend/node_modules/react/package.json frontend/dist/index.html`: passed against actual restored generated directories.
- `git diff --check`: passed. `git status --short`: no dependency/build artifacts shown.
- Already tracked artifacts: 10 icon `:Zone.Identifier` metadata files. Excluded from Docker and future Git additions; existing tracked files preserved because ignore rules do not untrack files and no destructive cleanup was requested.
- No application image build/runtime test: change is context filtering; actual filtering and required input retention verified independently. No production data, env values, networked image pull or application startup involved.
