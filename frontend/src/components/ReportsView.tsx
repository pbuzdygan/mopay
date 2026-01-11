import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Api } from '../api';
import { useAppStore } from '../store';
import { Surface } from './Surface';
import { REPORT_DEFINITIONS, type ReportId } from '../reports/config';
import { MONTHS } from '../utils/months';
import { formatCurrency } from '../utils/currency';

type EntryRow = {
  id: number;
  name: string;
  comment?: string | null;
  [key: string]: number | string | null | undefined;
};

type MonthStat = {
  month: string;
  income: number;
  expense: number;
  balance: number;
};

const monthValue = (entry: EntryRow, month: string) => {
  const raw = month === 'Dec' ? (entry.Decm ?? entry.Dec) : entry[month];
  if (raw === null || raw === undefined) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
};

const entryTotal = (entry: EntryRow) =>
  MONTHS.reduce((acc, month) => {
    const value = monthValue(entry, month);
    return acc + (value === null ? 0 : value);
  }, 0);

function useYearEntries() {
  const year = useAppStore((s) => s.year);
  const enabled = !!year;
  const incomes = useQuery({
    queryKey: ['entries', 'income', year],
    queryFn: () => Api.entries.list('income', year!),
    enabled,
  });
  const expenses = useQuery({
    queryKey: ['entries', 'expense', year],
    queryFn: () => Api.entries.list('expense', year!),
    enabled,
  });
  return { year, incomes, expenses };
}

function buildMonthStats(incomes: EntryRow[], expenses: EntryRow[]): MonthStat[] {
  return MONTHS.map((month) => {
    const income = incomes.reduce((sum, entry) => {
      const value = monthValue(entry, month);
      return sum + (value === null ? 0 : value);
    }, 0);
    const expense = expenses.reduce((sum, entry) => {
      const value = monthValue(entry, month);
      return sum + (value === null ? 0 : value);
    }, 0);
    return { month, income, expense, balance: income - expense };
  });
}

function getReportContent(reportId: ReportId, data: { incomes: EntryRow[]; expenses: EntryRow[]; monthStats: MonthStat[] }) {
  switch (reportId) {
    case 'monthly-balance':
      return <MonthlyBalanceCard stats={data.monthStats} />;
    case 'spending-leaders':
      return <SpendingLeadersCard expenses={data.expenses} />;
    case 'income-stability':
      return <IncomeStabilityCard incomes={data.incomes} />;
    case 'expense-stability':
      return <ExpenseStabilityCard expenses={data.expenses} />;
    default:
      return null;
  }
}

export function ReportsView() {
  const { year, incomes, expenses } = useYearEntries();
  const selectedReports = useAppStore((s) => s.selectedReports);

  const isLoading = incomes.isLoading || expenses.isLoading;
  const hasYear = !!year;

  const reportData = useMemo(() => {
    const inc = (incomes.data?.entries ?? []) as EntryRow[];
    const exp = (expenses.data?.entries ?? []) as EntryRow[];
    return {
      incomes: inc,
      expenses: exp,
      monthStats: buildMonthStats(inc, exp),
    };
  }, [incomes.data, expenses.data]);

  if (!hasYear) {
    return (
      <Surface variant="layer" className="report-card">
        <div className="reports-empty">
          <p>Select a year to unlock yearly analytics.</p>
        </div>
      </Surface>
    );
  }

  if (isLoading) {
    return (
      <Surface variant="layer" className="report-card">
        <div className="reports-empty">
          <p>Preparing your reports…</p>
        </div>
      </Surface>
    );
  }

  if (!selectedReports.length) {
    return (
      <Surface variant="layer" className="report-card">
        <div className="reports-empty">
          <p>Use the report toggles to display the analyses you need.</p>
        </div>
      </Surface>
    );
  }

  return (
    <div className="report-grid">
      {REPORT_DEFINITIONS.filter((r) => selectedReports.includes(r.id)).map((report) => (
        <Surface key={report.id} variant="layer" className="report-card">
          <div className="report-card-header">
            <div className="report-card-icon">{report.icon}</div>
            <div>
              <h3 className="report-card-title">{report.label}</h3>
              <p className="report-card-caption">{report.tooltip}</p>
            </div>
          </div>
          <div className="report-card-body">
            {getReportContent(report.id, reportData)}
          </div>
        </Surface>
      ))}
    </div>
  );
}

function MonthlyBalanceCard({ stats }: { stats: MonthStat[] }) {
  const totalIncome = stats.reduce((sum, m) => sum + m.income, 0);
  const totalExpense = stats.reduce((sum, m) => sum + m.expense, 0);
  const net = totalIncome - totalExpense;
  const best = [...stats].sort((a, b) => b.balance - a.balance)[0];
  const worst = [...stats].sort((a, b) => a.balance - b.balance)[0];

  const maxAbs = Math.max(...stats.map((m) => Math.abs(m.balance))) || 1;

  return (
    <div className="stack">
      <div className="stat-line">
        <div className="stat-chip">
          <span>Total income</span>
          <strong>{formatCurrency(totalIncome)}</strong>
        </div>
        <div className="stat-chip">
          <span>Total expense</span>
          <strong>{formatCurrency(totalExpense)}</strong>
        </div>
        <div className={`stat-chip ${net >= 0 ? 'positive' : 'negative'}`}>
          <span>Net result</span>
          <strong>{formatCurrency(net)}</strong>
        </div>
        <div className="stat-chip soft">
          <span>Best month</span>
          <strong>{best?.month ?? '-'}: {formatCurrency(best?.balance ?? 0)}</strong>
        </div>
        <div className="stat-chip soft">
          <span>Challenging month</span>
          <strong>{worst?.month ?? '-'}: {formatCurrency(worst?.balance ?? 0)}</strong>
        </div>
      </div>
      <div className="balance-bars">
        {stats.map((stat) => {
          const width = Math.abs(stat.balance) / maxAbs * 100;
          return (
            <div key={stat.month} className="balance-bar">
              <span className="month-label">{stat.month}</span>
              <div className="bar-track">
                <div
                  className={`bar-fill ${stat.balance >= 0 ? 'positive' : 'negative'}`}
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className={`value ${stat.balance >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(stat.balance)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpendingLeadersCard({ expenses }: { expenses: EntryRow[] }) {
  const items = expenses
    .map((entry) => ({ name: entry.name, total: entryTotal(entry) }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const sum = items.reduce((acc, item) => acc + item.total, 0);

  if (!items.length) {
    return <p className="reports-empty">Add expense data to see leaders.</p>;
  }

  return (
    <div className="stack">
      {items.map((item) => {
        const share = sum ? (item.total / sum) * 100 : 0;
        return (
          <div key={item.name} className="leader-row">
            <div>
              <p className="leader-name">{item.name}</p>
              <span className="leader-share">{share.toFixed(1)}% of tracked expenses</span>
            </div>
            <strong className="leader-amount">{formatCurrency(item.total)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function IncomeStabilityCard({ incomes }: { incomes: EntryRow[] }) {
  const items = incomes
    .map((entry) => {
      const values = MONTHS.map((m) => monthValue(entry, m)).filter((v) => v !== null) as number[];
      const avg = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
      const variance = values.length ? values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length : 0;
      const deviation = Math.sqrt(variance);
      const ratio = avg > 0 ? deviation / avg : 0;
      return { name: entry.name, deviation, avg, ratio };
    })
    .filter((row) => row.avg > 0)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 4);

  if (!items.length) {
    return <p className="reports-empty">Track at least one income stream to measure stability.</p>;
  }

  return (
    <div className="stack">
      {items.map((item) => (
        <div key={item.name} className="stability-row">
          <div>
            <p className="leader-name">{item.name}</p>
            <span className="leader-share">Avg {formatCurrency(item.avg)}</span>
          </div>
          <div className="stability-tag">
            {(item.ratio * 100).toFixed(1)}% variance
          </div>
        </div>
      ))}
    </div>
  );
}

function ExpenseStabilityCard({ expenses }: { expenses: EntryRow[] }) {
  const items = expenses
    .map((entry) => {
      const values = MONTHS.map((m) => monthValue(entry, m)).filter((v) => v !== null) as number[];
      const avg = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
      const variance = values.length ? values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length : 0;
      const deviation = Math.sqrt(variance);
      const ratio = avg > 0 ? deviation / avg : 0;
      return { name: entry.name, deviation, avg, ratio };
    })
    .filter((row) => row.avg > 0)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 4);

  if (!items.length) {
    return <p className="reports-empty">Add expense data to assess stability.</p>;
  }

  return (
    <div className="stack">
      {items.map((item) => (
        <div key={item.name} className="stability-row">
          <div>
            <p className="leader-name">{item.name}</p>
            <span className="leader-share">Avg {formatCurrency(item.avg)}</span>
          </div>
          <div className="stability-tag warning">
            {(item.ratio * 100).toFixed(1)}% variance
          </div>
        </div>
      ))}
    </div>
  );
}
