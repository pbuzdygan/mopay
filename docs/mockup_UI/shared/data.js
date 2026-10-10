/*
 * Synthetic demo data shared by all MOPAY UI concept mockups.
 * Values mirror the README screenshots so concepts can be compared with the
 * current UI. No real financial data. Not used by the application.
 */
window.MOPAY_DEMO = (function () {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const CURRENT_MONTH = 9; // October (0-based), mockup "today" is 2026-10-09

  const expenses = [
    {
      id: 'g1', name: 'Home & utilities', entries: [
        { id: 1, name: 'Rent', v: [2400, 2400, 2400, 2400, 2400, 2400, 2400, 2400, 2400, 2400, 2400, null], tags: { 2: { color: 'green', text: 'Paid early' } } },
        { id: 2, name: 'Electricity & heating', v: [280, 260, 240, 190, 160, 140, 140, 145, 165, 210, 245, null], tags: { 9: { color: 'orange', text: 'Higher than usual – check meter reading' } }, comment: 'Tariff G11, settlement every 2 months' },
        { id: 3, name: 'Internet & phone', v: [120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, null] },
      ],
    },
    {
      id: 'g2', name: 'Everyday essentials', entries: [
        { id: 4, name: 'Groceries', v: [980, 920, 1050, 970, 1100, 990, 1080, 1020, 960, 1040, 1080, null] },
        { id: 5, name: 'Public transport', v: [160, 160, 160, 160, 160, 160, 160, 160, 160, 160, 160, null] },
        { id: 6, name: 'Health & fitness', v: [220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, null] },
      ],
    },
    {
      id: 'g3', name: 'Lifestyle', entries: [
        { id: 7, name: 'Dining out', v: [180, 220, 190, 240, 210, 280, 310, 260, 200, 230, 190, null] },
        { id: 8, name: 'Subscriptions', v: [85, 85, 85, 85, 85, 85, 85, 85, 85, 85, 85, null] },
        { id: 9, name: 'Weekend trips', v: [0, 0, 350, 0, 400, 0, 650, 450, 0, 300, 0, null], tags: { 6: { color: 'red', text: 'Over budget' } } },
      ],
    },
  ];

  const incomes = [
    {
      id: 'g4', name: 'Work', entries: [
        { id: 11, name: 'Salary', v: [7600, 7600, 7600, 7600, 7600, 7600, 7600, 7600, 7600, 7600, 7600, null] },
        { id: 12, name: 'Annual bonus', v: [null, null, null, null, null, null, null, null, null, null, null, 4200] },
      ],
    },
    {
      id: 'g5', name: 'Other', entries: [
        { id: 13, name: 'Freelance', v: [180, 540, 0, 720, 640, 1820, 0, 300, 1210, 1020, 0, null], tags: { 5: { color: 'green', text: 'Website project' } } },
        { id: 14, name: 'Interest', v: [45, 42, 44, 41, 43, 45, 47, 44, 46, 48, null, null] },
      ],
    },
  ];

  const goals = [
    {
      id: 1, name: 'Emergency fund', target: 20000, items: [
        { name: 'Opening balance', value: 6500 },
        { name: 'Monthly contributions', value: 4800 },
        { name: 'Bonus contribution', value: 2000 },
      ],
    },
    {
      id: 2, name: 'Summer holiday', target: 8000, items: [
        { name: 'Monthly contributions', value: 6400 },
        { name: 'Car repair', value: -600, withdrawal: true },
      ],
    },
    {
      id: 3, name: 'Home improvements', target: 12000, items: [
        { name: 'Opening balance', value: 3900 },
      ],
    },
    {
      id: 4, name: 'Gift jar', target: null, items: [
        { name: 'Birthday cash', value: 350 },
      ],
    },
  ];

  const years = [2024, 2025, 2026];

  function rowSum(v) { return v.reduce((a, x) => a + (x ?? 0), 0); }
  function rowAvg(v) {
    const filled = v.filter((x) => x !== null && x !== undefined);
    return filled.length ? rowSum(v) / filled.length : 0;
  }
  function monthTotals(groups) {
    const t = Array(12).fill(0);
    const has = Array(12).fill(false);
    groups.forEach((g) => g.entries.forEach((e) => e.v.forEach((x, i) => {
      if (x !== null && x !== undefined) { t[i] += x; has[i] = true; }
    })));
    return t.map((x, i) => (has[i] ? x : null));
  }
  function groupTotals(g) {
    const t = Array(12).fill(null);
    g.entries.forEach((e) => e.v.forEach((x, i) => {
      if (x !== null && x !== undefined) t[i] = (t[i] ?? 0) + x;
    }));
    return t;
  }
  function goalBalance(goal) { return goal.items.reduce((a, i) => a + i.value, 0); }

  // Matches the app style "2 400,00": thin spaces as thousand separators, comma decimals.
  function fmt(n, opts = {}) {
    if (n === null || n === undefined) return '–';
    const sign = n < 0 ? '−' : (opts.signed && n > 0 ? '+' : '');
    const abs = Math.abs(n);
    const fixed = abs.toFixed(opts.decimals ?? 2);
    const [int, dec] = fixed.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return sign + grouped + (dec ? ',' + dec : '');
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return {
    MONTHS, MONTHS_LONG, CURRENT_MONTH, expenses, incomes, goals, years,
    rowSum, rowAvg, monthTotals, groupTotals, goalBalance, fmt, esc,
  };
})();

/* Theme + screen switching used by every concept page (mockup chrome only). */
window.MockupChrome = {
  init() {
    const root = document.documentElement;
    let saved = null;
    try { saved = localStorage.getItem('mopay-mockup-theme'); } catch (e) { /* storage may be blocked */ }
    if (saved) root.dataset.theme = saved;
    document.querySelectorAll('[data-theme-set]').forEach((btn) => {
      btn.addEventListener('click', () => {
        root.dataset.theme = btn.dataset.themeSet;
        try { localStorage.setItem('mopay-mockup-theme', btn.dataset.themeSet); } catch (e) { /* ignore */ }
        MockupChrome.syncThemeButtons();
      });
    });
    MockupChrome.syncThemeButtons();
    document.querySelectorAll('[data-screen-link]').forEach((btn) => {
      btn.addEventListener('click', () => MockupChrome.show(btn.dataset.screenLink));
    });
    window.addEventListener('hashchange', () => {
      const h = location.hash.replace('#', '');
      if (document.getElementById('screen-' + h)) MockupChrome.show(h);
    });
    const first = document.querySelector('[data-screen-link]');
    const hash = location.hash.replace('#', '');
    MockupChrome.show(hash && document.getElementById('screen-' + hash) ? hash : first && first.dataset.screenLink);
  },
  syncThemeButtons() {
    const current = document.documentElement.dataset.theme || 'light';
    document.querySelectorAll('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === current)));
  },
  show(id) {
    if (!id) return;
    document.querySelectorAll('.mock-screen').forEach((s) => { s.hidden = s.id !== 'screen-' + id; });
    document.querySelectorAll('[data-screen-link]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.screenLink === id)));
    document.querySelectorAll('[data-notes]').forEach((n) => { n.hidden = n.dataset.notes !== id; });
    history.replaceState(null, '', '#' + id);
  },
};
