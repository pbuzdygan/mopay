# T-008: Stable CI runner OS

- Status: done
- Owner: Codex
- Handoff: ready
- Evidence: included in commit 52ad702 with T-009.

Pinned security-checks and docker-publish jobs to ubuntu-24.04 to avoid the announced ubuntu-latest migration. README/changelog updated; retained advisory warning until Tailwind migration resolved the underlying findings. Workflow configuration reviewed locally; external GitHub execution remains the user release checkpoint. No outstanding implementation steps.
