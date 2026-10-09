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

// In-page selector for section controls: sidebar navigation on desktop, tabs on
// the narrow toolbar. Hidden variants are filtered by visibility in the page.
export const sectionControlsSelector = 'nav[aria-label="Primary"] button, [role="tab"]';

export const ui = {
  // Sidebar navigation (>=960px) or the narrow toolbar tabs; getByRole skips the hidden one.
  section: (page, name) => page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name, exact: true })
    .or(page.getByRole('tab', { name, exact: true })),
  openSection: (page, name) => ui.section(page, name).click(),
  // Name of the current section (aria-current in the sidebar, aria-selected tab otherwise).
  currentSection: (page) => page.locator('nav[aria-label="Primary"] [aria-current="page"], [role="tab"][aria-selected="true"]')
    .filter({ visible: true }).evaluate(node => (node.getAttribute('aria-label') ?? node.textContent).trim()),
  search: (page) => page.getByRole('searchbox'),
  yearSwitch: (page) => page.getByRole('button', { name: /^(Working year|Select working year)/ }),
  async selectYear(page, year) {
    await ui.yearSwitch(page).click();
    await page.getByRole('option', { name: String(year), exact: true }).click();
  },
  appMenu: (page) => page.getByRole('button', { name: 'Menu', exact: true }),
  // Year operations, Import, Export and Settings: sidebar items on desktop, Menu on the narrow toolbar.
  async openAppMenuItem(page, item) {
    if (await ui.appMenu(page).count()) await ui.appMenu(page).click();
    await page.getByRole('button', { name: item, exact: true }).click();
  },
  lock: (page) => page.getByRole('button', { name: 'Lock session', exact: true }),
  themeToggle: (page) => page.getByRole('button', { name: 'Toggle theme', exact: true }),
  newButton: (page) => page.getByRole('button', { name: /^New( entry)?$/ }),
  // kind: 'Entry' or 'Group'. Desktop: "New entry" split button; narrow toolbar: New menu.
  async openNew(page, kind) {
    const newEntry = page.getByRole('button', { name: 'New entry', exact: true });
    if (await newEntry.count()) {
      if (kind === 'Entry') return newEntry.click();
      await page.getByRole('button', { name: 'More create options', exact: true }).click();
      return page.getByRole('menuitem', { name: 'New group', exact: true }).click();
    }
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByRole('button', { name: kind, exact: true }).click();
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
  rowName: (page, name) => page.getByTestId('entry-table').getByRole('button', { name, exact: true }),
  // Clicking an entry or group name opens its details in the inspector.
  openDetails: (page, name) => ui.rowName(page, name).click(),
  cell: (page, entry, month) => page.getByRole('button', { name: new RegExp(`^${escapeRegExp(entry)}, ${month}: `) }),
  // A single click selects the cell and opens the inspector (plan D4).
  selectCell: (page, entry, month) => ui.cell(page, entry, month).click(),
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
