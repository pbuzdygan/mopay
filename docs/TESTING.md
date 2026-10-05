# Testing

[Back to README](../README.md) · [Security checks](SECURITY.md#automated-security-checks)

## Backend regression tests

With Node.js 24 and backend dependencies installed, run from the repository root:

```sh
node --test backend/tests/*.test.mjs
```

Tests cover authenticated XLSX downloads, bounded import parsing and failure paths, atomic entry patches, and finite savings amounts. API tests create a temporary source copy and SQLite database, generate disposable credentials, bind only to `127.0.0.1`, and do not inherit local secrets or webhook settings. Faults are injected only in the temporary copy or test workers; the test server is stopped and fixture files are removed after the run. Test sources are versioned and excluded from Docker build contexts.

Export requests accept 1–100 numeric four-digit integer years (`1000`–`9999`); duplicate years produce one sheet. Invalid requests return `400`, and unexpected download failures before streaming return a generic `500`. A download failure after streaming starts closes the connection; retry the download. Entry patches validate all supplied fields before writing and roll back grouping, ordering, and field changes together on database failure. Savings item creation and updates reject non-finite amounts; existing stored values are not rewritten by this release.


## Frontend and container checks

See [frontend test instructions](../frontend/tests/README.md) for UI, search, CSP and PWA fixtures, and [container verification](CONTAINER_SECURITY.md#verification-and-reproduction) for the image scan and entrypoint checks.
