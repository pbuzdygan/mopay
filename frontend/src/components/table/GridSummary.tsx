import { MONTHS, MONTH_NAMES, type MonthKey } from '../../utils/months';
import { formatCurrencyWhole } from '../../utils/currency';

type Totals = { sums: number[]; totalSum: number; totalAvg: number };

/**
 * Year summary above the grid, computed from the same totals as the Total row
 * (the visible, possibly filtered entries). Whole units like the sidebar: the
 * grid below keeps the exact values.
 */
export function GridSummary({ totals, currentMonth, type }: {
  totals: Totals;
  currentMonth: MonthKey | null;
  type: 'income' | 'expense';
}) {
  const { sums, totalSum, totalAvg } = totals;
  let highest = -1;
  sums.forEach((value, index) => {
    if (value > 0 && (highest < 0 || value > sums[highest])) highest = index;
  });
  const currentIndex = currentMonth ? MONTHS.indexOf(currentMonth) : -1;
  const current = currentIndex >= 0 ? sums[currentIndex] : null;
  const diff = current !== null && totalAvg > 0 ? ((current - totalAvg) / totalAvg) * 100 : null;
  // Above average is unfavourable for expenses and favourable for incomes.
  const tone = diff === null || Math.abs(diff) < 0.05 ? '' : (diff > 0) === (type === 'expense') ? 'is-bad' : 'is-good';

  return (
    <dl className="ledger-summary">
      <div>
        <dt>Year total</dt>
        <dd>{formatCurrencyWhole(totalSum)}</dd>
      </div>
      <div>
        <dt>Monthly average</dt>
        <dd>{formatCurrencyWhole(totalAvg)}</dd>
      </div>
      {current !== null && (
        <div>
          <dt>{MONTH_NAMES[currentIndex]}</dt>
          <dd>
            {formatCurrencyWhole(current)}
            {diff !== null && (
              <small className={tone}>
                {Math.abs(diff) < 0.05
                  ? 'equal to average'
                  : `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1).replace('.', ',')}% ${diff > 0 ? 'above' : 'below'} average`}
              </small>
            )}
          </dd>
        </div>
      )}
      <div>
        <dt>Highest month</dt>
        <dd>{highest >= 0 ? `${MONTH_NAMES[highest]} · ${formatCurrencyWhole(sums[highest])}` : '—'}</dd>
      </div>
    </dl>
  );
}
