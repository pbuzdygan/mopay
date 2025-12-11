## v1.3.1 – Tagging implementation

- small correction to the implemented tagging feature

## v1.3 – Tagging implementation

- Added structured tags per entry/month with Tag Builder mode (color highlight + hover details).
- Introduced backend `entry_tags` table, migration, and `/api/tags` endpoints.
- Updated UI (TableView, Edit menu) plus docs (`ARCHITECTURE.md`).
- Excel export now reflects tag colors and embeds tag notes as spreadsheet comments.

## v1.2.5 – UI alignment fixes

- tightened year dropdown menu/button sizing and made tables stretch correctly across months

## v1.2.4 – Adjusting VA feature and mobile view

- removing hover tip on VA feature
- normalizing year selector style in mobile view

## v1.2.3 – Minor adjustment of VA feature

- correcting tag string building

## 1.2.2 – Corrections of Version awareness feature and year selector

- adjusting style of VA feature (Version awareness)
- adjusting handling default year selector in "missing-cache" scenario

## 1.2.1 – Version awareness feature relocation in UI

- Relocation of Version awareness feature from footer are to banner area for better visibility

## 1.2 – PWA prompt tweaks & Version awareness

- Restyled the add-to-home-screen notification to align with the core UI buttons/fonts and added a Skip action with session persistence.
- Docker build now injects the release/tag into the image, exposing `/api/meta` with backend/app version data.
- UI footer displays the running Mopay version and pings GitHub Releases to show an “Update available” badge when a newer tag exists.

## 1.1.1 – UI language adjustments

- Translated remaining Polish UI strings (PWA install banner, offline mode bullet) to English.
- Updated PWA manifest description and encryption notice text files to match the new copy.
- README screenshot captions now use English labels (Savings, Reports, Settings).

## 1.1 – Data encryption

- Added transparent encryption for all monetary data:
  - monthly values in entries (`Jan`–`Dec` for incomes/expenses),
  - savings goals target values,
  - savings items values,
  - PIN is now stored as a salted hash wrapped in encryption.
- Mopay now requires an encryption key via `APP_ENC_KEY`:
  - generate a key, for example: `openssl rand -base64 32`,
  - set it in your Docker config, e.g. `APP_ENC_KEY=base64:...` in `docker-compose.yml`.
- Existing databases:
  - on first start with a valid `APP_ENC_KEY`, Mopay encrypts all existing numeric values in-place,
  - the app shows a one-time in-app notice that your data has been encrypted.
- Missing key:
  - if `APP_ENC_KEY` is not set, the backend does not start and logs:
    `Error: APP_ENC_KEY environment variable is required for Mopay to start.`  
  - running Mopay without encryption is no longer supported.
- Changed key (mismatch with existing data):
  - Mopay detects when `APP_ENC_KEY` does not match the key used to encrypt the current database,
  - access to data is blocked and a clear message is shown:
    `Your APP_ENC_KEY has been changed! Revert to previous encryption key to keep your data.`,
  - in the UI you can either:
    - restore the previous `APP_ENC_KEY` in your Docker config to keep all data, or
    - wipe all stored data and start fresh with the current key (requires a two-step confirmation in a red “Confirm reset” dialog).
