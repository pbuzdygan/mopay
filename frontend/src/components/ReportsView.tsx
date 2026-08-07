import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Api } from '../api';
import { useAppStore } from '../store';
import {
  buildAnnualComparison,
  buildFinancialStory,
  type FinancialStory,
  type MetricComparison,
  type ReportEntry,
} from '../reports/analytics';
import { formatCurrency } from '../utils/currency';
import { Surface } from './Surface';

function useYearEntries() {
  const year = useAppStore((state) => state.year);
  const enabled = !!year;
  const years = useQuery({
    queryKey: ['years'],
    queryFn: Api.years.list,
  });
  const previousYear = year ? year - 1 : null;
  const availableYears = (years.data?.years ?? []) as number[];
  const hasPreviousYear = previousYear !== null && availableYears.includes(previousYear);
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
  const previousIncomes = useQuery({
    queryKey: ['entries', 'income', previousYear],
    queryFn: () => Api.entries.list('income', previousYear!),
    enabled: hasPreviousYear,
  });
  const previousExpenses = useQuery({
    queryKey: ['entries', 'expense', previousYear],
    queryFn: () => Api.entries.list('expense', previousYear!),
    enabled: hasPreviousYear,
  });
  return {
    year,
    incomes,
    expenses,
    previousYear,
    hasPreviousYear,
    previousIncomes,
    previousExpenses,
  };
}

const formatSignedCurrency = (value: number) =>
  `${value > 0 ? '+' : ''}${formatCurrency(value)}`;

const describeYear = (story: FinancialStory) => {
  const result = story.net > 0
    ? `You finished the year ${formatCurrency(story.net)} ahead.`
    : story.net < 0
    ? `You finished the year ${formatCurrency(Math.abs(story.net))} behind.`
    : 'Income and expenses balanced this year.';

  const incomeDescription = story.incomeStability === null
    ? null
    : story.incomeStability >= 80
    ? 'Income stayed steady'
    : story.incomeStability >= 55
    ? 'Income was moderately predictable'
    : 'Income varied noticeably';
  const expenseDescription = story.mostVariableExpense
    ? `${story.mostVariableExpense.name} varied most month to month`
    : null;

  if (incomeDescription && expenseDescription) {
    return `${result} ${incomeDescription}, while ${expenseDescription}.`;
  }
  if (incomeDescription) return `${result} ${incomeDescription}.`;
  if (expenseDescription) return `${result} ${expenseDescription}.`;
  return result;
};

export function ReportsView() {
  const {
    year,
    incomes,
    expenses,
    previousYear,
    hasPreviousYear,
    previousIncomes,
    previousExpenses,
  } = useYearEntries();
  const isLoading = incomes.isLoading || expenses.isLoading;
  const isError = incomes.isError || expenses.isError;

  const story = useMemo(() => {
    const incomeEntries = (incomes.data?.entries ?? []) as ReportEntry[];
    const expenseEntries = (expenses.data?.entries ?? []) as ReportEntry[];
    return buildFinancialStory(incomeEntries, expenseEntries);
  }, [incomes.data, expenses.data]);

  const previousStory = useMemo(() => {
    if (!hasPreviousYear || !previousIncomes.isSuccess || !previousExpenses.isSuccess) {
      return null;
    }
    const incomeEntries = (previousIncomes.data?.entries ?? []) as ReportEntry[];
    const expenseEntries = (previousExpenses.data?.entries ?? []) as ReportEntry[];
    return buildFinancialStory(incomeEntries, expenseEntries);
  }, [
    hasPreviousYear,
    previousIncomes.isSuccess,
    previousIncomes.data,
    previousExpenses.isSuccess,
    previousExpenses.data,
  ]);

  const comparison = useMemo(
    () => previousStory ? buildAnnualComparison(story, previousStory) : null,
    [story, previousStory]
  );

  if (!year) {
    return <ReportsState message="Select a year to unlock yearly analytics." />;
  }

  if (isLoading) {
    return <ReportsState message="Preparing your financial story…" />;
  }

  if (isError) {
    return <ReportsState message="The financial story could not be prepared. Try again in a moment." />;
  }

  if (!story.hasActivity) {
    return <ReportsState message="Add income or expense values to build your financial story." />;
  }

  return (
    <div className="reports-story mode-enter">
      <Surface variant="layer" className="reports-story-hero">
        <p className="reports-story-summary">{describeYear(story)}</p>

        <div className="reports-story-metrics" aria-label="Annual totals">
          <StoryMetric
            comparison={comparison?.income}
            comparisonYear={comparison ? previousYear : null}
            icon="income"
            label="Income"
            value={story.totalIncome}
          />
          <StoryMetric
            comparison={comparison?.expense}
            comparisonYear={comparison ? previousYear : null}
            icon="expenses"
            label="Expenses"
            value={story.totalExpense}
          />
          <StoryMetric
            comparison={comparison?.net}
            comparisonYear={comparison ? previousYear : null}
            icon="net"
            label="Net result"
            value={story.net}
            signed
            tone={story.net >= 0 ? 'positive' : 'negative'}
          />
        </div>

        <MonthHealthStrip story={story} />
      </Surface>

      <div className="reports-story-details">
        <Surface variant="layer" className="reports-story-panel">
          <SectionHeading
            title="Where money went"
            caption="Top expense lines and their share of annual expenses"
          />
          <SpendingPanel story={story} />
        </Surface>

        <Surface variant="layer" className="reports-story-panel">
          <SectionHeading
            title="Predictability"
            caption="How consistent income and expenses were across active months"
          />
          <PredictabilityPanel story={story} />
        </Surface>
      </div>
    </div>
  );
}

function ReportsState({ message }: { message: string }) {
  return (
    <Surface variant="layer" className="reports-story-state">
      <p>{message}</p>
    </Surface>
  );
}

function StoryMetric({
  comparison,
  comparisonYear,
  icon,
  label,
  value,
  signed = false,
  tone = 'neutral',
}: {
  comparison?: MetricComparison;
  comparisonYear: number | null;
  icon: 'income' | 'expenses' | 'net';
  label: string;
  value: number;
  signed?: boolean;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const iconPath = icon === 'income'
    ? '/icons/ui/wallet.svg'
    : icon === 'expenses'
    ? '/icons/ui/credit-card-pay.svg'
    : '/icons/ui/pig-money.svg';

  return (
    <div className={`reports-story-metric is-${tone}`}>
      <span className="reports-story-metric-icon" aria-hidden="true">
        <span
          className="reports-story-metric-glyph"
          style={{
            WebkitMaskImage: `url("${iconPath}")`,
            maskImage: `url("${iconPath}")`,
          }}
        />
      </span>
      <div className="reports-story-metric-copy">
        <span>{label}</span>
        <strong className="reports-story-metric-value">
          {signed ? formatSignedCurrency(value) : formatCurrency(value)}
        </strong>
        {comparison && comparisonYear && (
          <MetricComparisonRow comparison={comparison} year={comparisonYear} />
        )}
      </div>
    </div>
  );
}

function MetricComparisonRow({
  comparison,
  year,
}: {
  comparison: MetricComparison;
  year: number;
}) {
  const arrow = comparison.direction === 'up'
    ? '↑'
    : comparison.direction === 'down'
    ? '↓'
    : '→';
  const detail = comparison.kind === 'turned-positive'
    ? 'Turned positive'
    : comparison.kind === 'turned-negative'
    ? 'Turned negative'
    : comparison.kind === 'no-baseline'
    ? 'No baseline'
    : `${arrow} ${(comparison.percent ?? 0) > 0 ? '+' : ''}${(comparison.percent ?? 0).toFixed(1)}%`;

  return (
    <span
      className={`reports-metric-comparison is-${comparison.tone}`}
      aria-label={`Compared with ${year}: ${detail}`}
    >
      <span>vs {year}</span>
      <strong>{detail}</strong>
    </span>
  );
}

function MonthHealthStrip({ story }: { story: FinancialStory }) {
  return (
    <section className="reports-month-section" aria-labelledby="reports-month-heading">
      <div className="reports-month-heading-row">
        <div>
          <h3 id="reports-month-heading">The year month by month</h3>
          <p>Monthly net result with income and expense proportions</p>
        </div>
        <div className="reports-month-legend" aria-hidden="true">
          <span className="is-income">Income</span>
          <span className="is-expense">Expenses</span>
        </div>
      </div>

      <div className="reports-month-grid">
        {story.months.map((month) => {
          const isBest = story.bestMonth?.month === month.month;
          const isWorst = story.worstMonth?.month === month.month;
          const incomeHeight = Math.abs(month.income) / story.maxMonthlyFlow * 100;
          const expenseHeight = Math.abs(month.expense) / story.maxMonthlyFlow * 100;
          const status = isBest ? 'Best' : isWorst ? 'Weakest' : null;
          const label = month.hasActivity
            ? `${month.month}: net ${formatSignedCurrency(month.balance)}, income ${formatCurrency(month.income)}, expenses ${formatCurrency(month.expense)}${status ? `, ${status.toLowerCase()} month` : ''}`
            : `${month.month}: no activity`;

          return (
            <div
              key={month.month}
              className={`reports-month ${month.hasActivity ? '' : 'is-empty'} ${isBest ? 'is-best' : ''} ${isWorst ? 'is-worst' : ''}`}
              aria-label={label}
            >
              <div className="reports-month-topline">
                <span>{month.month}</span>
                {status && <small>{status}</small>}
              </div>
              <strong className={month.balance < 0 ? 'is-negative' : 'is-positive'}>
                {month.hasActivity ? formatSignedCurrency(month.balance) : '—'}
              </strong>
              <div className="reports-month-bars" aria-hidden="true">
                <span
                  className="is-income"
                  style={{ height: month.income === 0 ? 0 : `${Math.max(8, incomeHeight)}%` }}
                />
                <span
                  className="is-expense"
                  style={{ height: month.expense === 0 ? 0 : `${Math.max(8, expenseHeight)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeading({ title, caption }: { title: string; caption: string }) {
  return (
    <header className="reports-panel-heading">
      <h3>{title}</h3>
      <p>{caption}</p>
    </header>
  );
}

function SpendingPanel({ story }: { story: FinancialStory }) {
  if (!story.topExpenses.length) {
    return <p className="reports-panel-empty">Add expense values to see where money went.</p>;
  }

  const largestExpense = story.topExpenses[0]?.total || 1;
  return (
    <div className="reports-spending-list">
      {story.topExpenses.map((expense, index) => (
        <div className="reports-spending-row" key={`${expense.name}-${index}`}>
          <span className="reports-spending-rank">{index + 1}</span>
          <div className="reports-spending-main">
            <div className="reports-spending-label">
              <strong>{expense.name}</strong>
              <span>{expense.share.toFixed(1)}%</span>
            </div>
            <div className="reports-spending-track" aria-hidden="true">
              <span style={{ width: `${expense.total / largestExpense * 100}%` }} />
            </div>
          </div>
          <strong className="reports-spending-amount">{formatCurrency(expense.total)}</strong>
        </div>
      ))}
    </div>
  );
}

function PredictabilityPanel({ story }: { story: FinancialStory }) {
  return (
    <div className="reports-predictability">
      <StabilityGauge
        icon="/icons/ui/wallet.svg"
        label="Income"
        score={story.incomeStability}
      />
      <StabilityGauge
        icon="/icons/ui/credit-card-pay.svg"
        label="Expenses"
        score={story.expenseStability}
      />

      <div className="reports-insights">
        {story.steadiestIncome && (
          <div className="reports-insight is-positive">
            <InsightIcon tone="positive" />
            <div>
              <strong>{story.steadiestIncome.name} was your steadiest income source</strong>
              <p>{story.steadiestIncome.score}% stability across the active part of the year.</p>
            </div>
          </div>
        )}
        {story.mostVariableExpense && (
          <div className="reports-insight is-warning">
            <InsightIcon tone="warning" />
            <div>
              <strong>{story.mostVariableExpense.name} varied most month to month</strong>
              <p>{story.mostVariableExpense.score}% stability across the active part of the year.</p>
            </div>
          </div>
        )}
        {!story.steadiestIncome && !story.mostVariableExpense && (
          <p className="reports-panel-empty">Add values in at least two active months to assess predictability.</p>
        )}
      </div>
    </div>
  );
}

function InsightIcon({ tone }: { tone: 'positive' | 'warning' }) {
  return (
    <span className="reports-insight-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8.5" />
        {tone === 'positive'
          ? <path d="m8.5 12 2.2 2.2 4.8-4.8" />
          : <path d="M12 8v5M12 16.5v.01" />}
      </svg>
    </span>
  );
}

function StabilityGauge({
  icon,
  label,
  score,
}: {
  icon: string;
  label: string;
  score: number | null;
}) {
  return (
    <div className="reports-stability-row">
      <div className="reports-stability-label">
        <strong className="reports-stability-name">
          <span
            className="reports-stability-icon"
            aria-hidden="true"
            style={{
              WebkitMaskImage: `url("${icon}")`,
              maskImage: `url("${icon}")`,
            }}
          />
          <span>{label}</span>
        </strong>
        <span>{score === null ? 'Not enough data' : `${score}% stable`}</span>
      </div>
      <div
        className={`reports-stability-track ${score === null ? 'is-empty' : ''}`}
        role={score === null ? undefined : 'progressbar'}
        aria-label={score === null ? undefined : `${label} stability`}
        aria-valuemin={score === null ? undefined : 0}
        aria-valuemax={score === null ? undefined : 100}
        aria-valuenow={score ?? undefined}
      >
        <span style={{ width: `${score ?? 0}%` }} />
      </div>
    </div>
  );
}
