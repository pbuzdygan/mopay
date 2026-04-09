import { MONTHS } from '../../utils/months';
import { formatCurrency } from '../../utils/currency';

type Totals = { sums: number[]; totalSum: number; totalAvg: number };

export function TableHeaderRow({ gridTemplate, tab }: { gridTemplate: string; tab: 'expenses' | 'incomes' }) {
  return (
    <div
      className={`table-header-premium ${gridTemplate} gap-1 pl-0 pr-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-textSec`}
    >
      <div className="text-left">💬</div>
      <div>{tab === 'incomes' ? 'Incomes' : 'Expenses'}</div>
      {MONTHS.map((month) => (
        <div key={month} className="text-right">
          {month}
        </div>
      ))}
      <div className="text-right">Sum</div>
      <div className="text-right">Avg</div>
    </div>
  );
}

export function TableTotalRow({ gridTemplate, totals }: { gridTemplate: string; totals: Totals }) {
  return (
    <div className={`table-total-premium ${gridTemplate} gap-1 pl-0 pr-3 py-2 font-semibold text-[0.72rem]`}>
      <div />
      <div className="font-semibold">Total</div>
      {totals.sums.map((value, idx) => (
        <div key={idx} className="text-right font-semibold">
          {formatCurrency(value)}
        </div>
      ))}
      <div className="text-right font-semibold">{formatCurrency(totals.totalSum)}</div>
      <div className="text-right font-semibold">{formatCurrency(totals.totalAvg)}</div>
    </div>
  );
}
