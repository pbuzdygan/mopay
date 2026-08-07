import { MONTHS, type MonthKey } from '../../utils/months';
import { formatCurrency } from '../../utils/currency';

type Totals = { sums: number[]; totalSum: number; totalAvg: number };

export function TableHeaderRow({
  gridTemplate,
  tab,
  currentMonth,
}: {
  gridTemplate: string;
  tab: 'expenses' | 'incomes';
  currentMonth: MonthKey | null;
}) {
  return (
    <div
      className={`table-header-premium ${gridTemplate} gap-1 pl-0 pr-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-textSec`}
    >
      <div>{tab === 'incomes' ? 'Incomes' : 'Expenses'}</div>
      {MONTHS.map((month) => {
        const isCurrent = month === currentMonth;
        return (
          <div
            key={month}
            className={`table-month-header text-right ${isCurrent ? 'is-current' : ''}`}
            aria-current={isCurrent ? 'date' : undefined}
          >
            <span className="table-month-header-label">{month}</span>
          </div>
        );
      })}
      <div className="text-right">Sum</div>
      <div className="text-right">Avg</div>
    </div>
  );
}

export function TableTotalRow({ gridTemplate, totals }: { gridTemplate: string; totals: Totals }) {
  return (
    <div className={`table-total-premium ${gridTemplate} gap-1 pl-0 pr-3 py-2 font-semibold text-[0.72rem]`}>
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
