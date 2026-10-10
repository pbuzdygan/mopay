// Shared browser-check helpers. Locators use roles, accessible names and a few
// data-testid hooks instead of layout classes, so a redesign only has to update
// this file when a control moves (for example tabs to a sidebar).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { browserSecurityHeaders } from '../../backend/browserSecurity.js';

const require = createRequire(import.meta.url);
export const { chromium } = require(process.env.MOPAY_PLAYWRIGHT_MODULE || 'playwright');
export const dist = process.env.MOPAY_UI_DIST ? resolve(process.env.MOPAY_UI_DIST) : resolve(import.meta.dirname, '../dist');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

// Serve a production build file with the backend's enforced browser headers.
export async function serveAsset(route, url) {
  const file = resolve(dist, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  assert.ok(file.startsWith(dist + sep));
  try {
    const body = await readFile(file);
    const extension = file.slice(file.lastIndexOf('.'));
    await route.fulfill({ body, headers: browserSecurityHeaders, contentType: mime[extension] || 'application/octet-stream' });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await route.fulfill({ status: 404, body: '' });
  }
}

// CSS hooks for in-page sampling (requestAnimationFrame cannot use Playwright locators).
export const hooks = {
  table: '[data-testid="entry-table"]',
  dialog: '[role="dialog"]',
  dialogBackdrop: '[data-testid="dialog-backdrop"]',
  inspector: '[data-testid="inspector"]',
  pinCard: '[data-testid="pin-card"]',
  expandedGroup: 'button[aria-label="Collapse group"]',
};

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// In-page selector for section controls: sidebar navigation on desktop, tabs on
// the narrow toolbar. Hidden variants are filtered by visibility in the page.
export const sectionControlsSelector = 'nav[aria-label="Primary"] button, [role="tab"]';

export const ui = {
  // Sidebar navigation (>=960px) or the narrow toolbar tabs; getByRole skips the hidden one.
  section: (page, name) => page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name, exact: true })
    .or(page.getByRole('tab', { name, exact: true })),
  openSection: (page, name) => ui.section(page, name).click(),
  // True below 960 px, where the mobile layout (plan Phase 8) is rendered.
  narrow: (page) => page.evaluate(() => matchMedia('(max-width: 959px)').matches),
  // Bottom tab bar item that opens the More sheet (mobile layout).
  moreButton: (page) => page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'More', exact: true }),
  more: (page) => page.getByRole('dialog', { name: 'More', exact: true }),
  async openMore(page) {
    await ui.moreButton(page).click();
    await ui.more(page).waitFor();
  },
  // Name of the current section (aria-current in the sidebar or tab bar).
  currentSection: (page) => page.locator('nav[aria-label="Primary"] [aria-current="page"], [role="tab"][aria-selected="true"]')
    .filter({ visible: true }).evaluate(node => (node.getAttribute('aria-label') ?? node.textContent).trim()),
  search: (page) => page.getByRole('searchbox'),
  // Below 960 px search sits behind an icon in the top bar (plan D13).
  async openSearch(page) {
    if (!await ui.search(page).isVisible()) await page.getByRole('button', { name: 'Search', exact: true }).click();
    return ui.search(page);
  },
  yearSwitch: (page) => page.getByRole('button', { name: /^(Working year|Select working year)/ }),
  // The year selector is in the sidebar, or in the More sheet below 960 px.
  async openYearSwitch(page) {
    if (await ui.narrow(page) && !await ui.more(page).isVisible()) await ui.openMore(page);
    await ui.yearSwitch(page).click();
  },
  async selectYear(page, year) {
    await ui.openYearSwitch(page);
    await page.getByRole('option', { name: String(year), exact: true }).click();
    await ui.more(page).waitFor({ state: 'detached' });
  },
  // Working year as shown by the year selector ("Working year 2026").
  async workingYear(page) {
    if (!await ui.narrow(page)) return ui.yearSwitch(page).getAttribute('aria-label');
    await ui.openMore(page);
    const label = await ui.yearSwitch(page).getAttribute('aria-label');
    await page.keyboard.press('Escape');
    await ui.more(page).waitFor({ state: 'detached' });
    return label;
  },
  // Settings page (plan Phase 7): sidebar item on desktop, More → Settings below 960 px.
  settingsButton: (page) => page.getByRole('button', { name: 'Settings', exact: true }),
  async openSettings(page) {
    if (await ui.narrow(page)) await ui.openMore(page);
    await ui.settingsButton(page).click();
    // The page title is only in the desktop header; the first section shows on every layout.
    await ui.settingsSection(page, 'Display').waitFor();
  },
  // Settings sections are regions named by their headings. Only the section chosen
  // in the section menu is shown (Display when Settings opens).
  settingsSection: (page, name) => page.getByRole('region', { name, exact: true }),
  settingsMenu: (page) => page.getByRole('navigation', { name: 'Settings sections' }),
  async showSettingsSection(page, name) {
    await ui.settingsMenu(page).getByRole('button', { name, exact: true }).click();
    const section = ui.settingsSection(page, name);
    await section.waitFor();
    return section;
  },
  lock: (page) => page.getByRole('button', { name: 'Lock session', exact: true }),
  async lockSession(page) {
    if (await ui.narrow(page)) await ui.openMore(page);
    await ui.lock(page).click();
  },
  newButton: (page) => page.getByRole('button', { name: /^New( entry)?$/ }),
  // kind: 'Entry' or 'Group'. Desktop: "New entry" split button; mobile: top bar Actions menu.
  async openNew(page, kind) {
    const newEntry = page.getByRole('button', { name: 'New entry', exact: true });
    if (await newEntry.count()) {
      if (kind === 'Entry') return newEntry.click();
      await page.getByRole('button', { name: 'More create options', exact: true }).click();
      return page.getByRole('menuitem', { name: 'New group', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    await page.getByRole('menuitem', { name: `New ${kind.toLowerCase()}`, exact: true }).click();
  },
  editMenu: (page) => page.getByRole('button', { name: /^(Actions|Edit)( · .+)?$/ }),
  async enterEditMode(page, mode) {
    await ui.editMenu(page).click();
    await page.getByRole('menuitem', { name: mode, exact: true }).or(page.getByRole('button', { name: mode, exact: true })).click();
  },
  exitEditMode: (page) => page.getByRole('button', { name: /^(Close|Done)$/ }).click(),
  // Bulk bar below the grid: "Remove selected" while nothing is selected, then a
  // specific label such as "Remove 1 group and 1 entry".
  removeSelected: (page) => page.getByRole('button', { name: /^Remove (selected|\d+ (group|entr).*)$/ }),
  dialog: (page, name) => page.getByRole('dialog', name ? { name, exact: true } : undefined),
  closeDialog: (page) => page.getByRole('dialog').getByRole('button', { name: 'Close dialog', exact: true }),
  // Non-modal inspector drawer (plan Phase 4) for a selected cell, entry or group.
  details: (page) => page.getByTestId('inspector'),
  closeDetails: (page) => ui.details(page).getByRole('button', { name: 'Close details', exact: true }),
  // Entry or group name button in the grid (the inspector repeats the name as its title).
  // In the month list a group keeps its name button and an entry is its row (named
  // "entry, month: value"), so the same helper opens details on both layouts.
  rowName: (page, name) => page.getByTestId('entry-table').getByRole('button', { name, exact: true })
    .or(page.getByTestId('entry-table').getByRole('listitem').filter({ has: page.getByText(name, { exact: true }) })
      .getByRole('button', { name: new RegExp(`^${escapeRegExp(name)}, [A-Z][a-z]{2}: `) })),
  // Clicking an entry or group name opens its details in the inspector.
  // On the month list an entry row opens the month's sheet, which links to the
  // entry details (the cell variant no longer repeats them).
  async openDetails(page, name) {
    await ui.rowName(page, name).click();
    if (!await ui.narrow(page)) return;
    const link = ui.details(page).getByRole('button', { name: 'Entry details', exact: true });
    await ui.details(page).waitFor();
    if (await link.count()) await link.click();
  },
  cell: (page, entry, month) => page.getByRole('button', { name: new RegExp(`^${escapeRegExp(entry)}, ${month}: `) }),
  // Month list (mobile): steps to the month with the stepper; no-op on the grid.
  async showMonth(page, month) {
    if (!await ui.narrow(page)) return;
    const heading = page.getByRole('heading', { level: 2, name: new RegExp(`^(${MONTH_NAMES.join('|')}) (Expenses|Incomes) · `) });
    const target = MONTHS.indexOf(month);
    for (let step = 0; step < 12; step++) {
      const text = await heading.textContent();
      const current = MONTH_NAMES.findIndex(name => text.startsWith(name));
      if (current === target) return;
      await page.getByRole('button', { name: current < target ? 'Next month' : 'Previous month', exact: true }).click();
      await page.getByRole('heading', { level: 2, name: new RegExp(`^${MONTH_NAMES[current + (current < target ? 1 : -1)]} `) }).waitFor();
    }
    assert.fail(`Month ${month} not reached`);
  },
  // Opens the inspector on a month: a double-click in the grid (a single click
  // only selects the cell, plan D4 as revised after Phase 9); on the month list a
  // tap on the row opens the bottom sheet (an open sheet is closed first because
  // it covers the rows).
  async selectCell(page, entry, month) {
    // Close first: changing the month also closes the sheet, with an exit animation.
    if (await ui.narrow(page) && await ui.details(page).count()) {
      await ui.closeDetails(page).click();
      await ui.details(page).waitFor({ state: 'detached' });
    }
    await ui.showMonth(page, month);
    if (await ui.narrow(page)) await ui.cell(page, entry, month).click();
    else await ui.cell(page, entry, month).dblclick();
  },
  // Value shown for an entry and month (from the cell or row name, both layouts).
  async cellValue(page, entry, month) {
    await ui.showMonth(page, month);
    return (await ui.cell(page, entry, month).getAttribute('aria-label')).split(': ').pop();
  },
  // Value editor: in place in the grid (Enter), the inspector Value field in the month list.
  async editValue(page, entry, month) {
    if (await ui.narrow(page)) {
      await ui.selectCell(page, entry, month);
      return ui.inspectorValue(page);
    }
    await ui.editCell(page, entry, month);
    return ui.cellInput(page, entry, month);
  },
  // Enter on a focused cell edits in place without the inspector (plan D4).
  async editCell(page, entry, month) {
    await ui.cell(page, entry, month).focus();
    await page.keyboard.press('Enter');
  },
  inspectorValue: (page) => ui.details(page).getByRole('textbox', { name: / value$/ }),
  // Tag note announced with the month cell (aria-describedby); null without a note.
  cellNote: (page, entry, month) => ui.cell(page, entry, month)
    .evaluate(node => document.getElementById(node.getAttribute('aria-describedby') ?? '')?.textContent ?? null),
  // Value of a term in the summary strip above the grid (<dl>).
  summaryValue: (page, term) => page.getByRole('term').filter({ hasText: new RegExp(`^${escapeRegExp(term)}$`) })
    .locator('xpath=following-sibling::dd[1]'),
  cellInput: (page, entry, month) => page.getByRole('textbox', { name: `${entry}, ${month}`, exact: true }),
  collapseGroup: (page) => page.getByRole('button', { name: 'Collapse group', exact: true }),
  expandGroup: (page) => page.getByRole('button', { name: 'Expand group', exact: true }),
  annualTotals: (page) => page.getByRole('group', { name: 'Annual totals', exact: true }),
  // Overview KPI: term, value and comparison note as one text (e.g. "Income5 000,00↑ +8,7% vs 2025").
  overviewKpi: (page, term) => ui.annualTotals(page).locator('div')
    .filter({ has: page.getByRole('term').filter({ hasText: new RegExp(`^${escapeRegExp(term)}$`) }) }),
  // Overview cards are regions named by their heading.
  overviewCard: (page, name) => page.getByRole('region', { name, exact: true }),
  // Month card button; its name starts with the short month ("Jan: net …", "Oct: no activity").
  overviewMonth: (page, month) => ui.overviewCard(page, 'Month by month').getByRole('button', { name: new RegExp(`^${month}: `) }),
  demoBanner: (page) => page.getByRole('status').filter({ hasText: 'Demo mode' }),
  pinDialog: (page) => page.getByRole('dialog', { name: 'Enter PIN', exact: true }),
  pinInput: (page) => page.getByLabel('PIN', { exact: true }),
  async unlock(page, pin) {
    await ui.pinInput(page).fill(pin);
    await page.getByRole('button', { name: 'Enter', exact: true }).click();
  },
  // Goal in the Savings goal list; its name continues with progress and balance.
  goal: (page, name) => page.getByRole('navigation', { name: 'Goals', exact: true })
    .getByRole('button', { name: new RegExp(`^${escapeRegExp(name)} `) }),
  openGoal: (page, name) => ui.goal(page, name).click(),
  // Detail of the selected goal, a region named by the goal.
  goalDetail: (page, name) => page.getByRole('region', { name, exact: true }),
  async openGoalRemoval(page) {
    await page.getByRole('button', { name: 'Goal actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Remove goal', exact: true }).click();
  },
  addItemForm: (page) => page.getByRole('form', { name: 'Add item', exact: true }),
  itemEditor: (page) => page.getByRole('group', { name: 'Edit item', exact: true }),
  // Item row by its note (the cell may also hold the withdrawal badge).
  itemRow: (page, name) => page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) }),
  goalBalance: (page) => page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Current balance', exact: true }) }),
  // A visible item of a view: entry names in the grid, goals in the Savings list.
  viewItem: (page, section, name) => section === 'Savings' ? ui.goal(page, name) : page.getByText(name, { exact: true }),
};
