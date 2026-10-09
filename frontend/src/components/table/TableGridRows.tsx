import { MONTHS, type MonthKey } from '../../utils/months';
import { formatCurrency } from '../../utils/currency';

type Totals = { sums: number[]; totalSum: number; totalAvg: number };

// pickedMonth: the column chosen on Overview, highlighted until the user moves on.
export function TableHeaderRow({ currentMonth, pickedMonth = null }: { currentMonth: MonthKey | null; pickedMonth?: MonthKey | null }) {
  return (
    <thead>
      <tr>
        <th scope="col" className="ledger-col-name">Entry</th>
        {MONTHS.map((month) => {
          const isCurrent = month === currentMonth;
          return (
            <th
              key={month}
              scope="col"
              className={[isCurrent && 'is-current', month === pickedMonth && 'is-picked'].filter(Boolean).join(' ') || undefined}
              aria-current={isCurrent ? 'date' : undefined}
            >
              <span>{month}</span>
            </th>
          );
        })}
        <th scope="col" className="ledger-col-sum">Sum</th>
        <th scope="col" className="ledger-col-avg">Avg</th>
      </tr>
    </thead>
  );
}

export function TableTotalRow({ totals, currentMonth }: { totals: Totals; currentMonth: MonthKey | null }) {
  return (
    <tfoot>
      <tr>
        <th scope="row" className="ledger-col-name">Total</th>
        {totals.sums.map((value, idx) => (
          <td key={MONTHS[idx]} className={MONTHS[idx] === currentMonth ? 'is-current' : undefined}>
            {formatCurrency(value)}
          </td>
        ))}
        <td className="ledger-col-sum">{formatCurrency(totals.totalSum)}</td>
        <td className="ledger-col-avg">{formatCurrency(totals.totalAvg)}</td>
      </tr>
    </tfoot>
  );
}
