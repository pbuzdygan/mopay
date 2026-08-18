import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Api } from '../api';
import { useAppStore } from '../store';
import {
  buildAnnualComparison,
  buildFinancialStory,
  buildSavingsStory,
  type FinancialStory,
  type MetricComparison,
  type ReportEntry,
  type ReportEntryGroup,
  type SavingsReportGoal,
  type SavingsStory,
} from '../reports/analytics';
import { formatCurrency } from '../utils/currency';
import { Surface } from './Surface';

function useReportData() {
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
  const expenseGroups = useQuery({
    queryKey: ['entry-groups', 'expense', year],
    queryFn: () => Api.entryGroups.list('expense', year!),
    enabled,
  });
  const savings = useQuery({
    queryKey: ['savings', year],
    queryFn: () => Api.savings.list(year!),
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
    expenseGroups,
    savings,
    previousYear,
    hasPreviousYear,
    previousIncomes,
    previousExpenses,
  };
}

const formatSignedCurrency = (value: number) =>
  `${value > 0 ? '+' : ''}${formatCurrency(value)}`;

export function ReportsView() {
  const {
    year,
    incomes,
    expenses,
    expenseGroups,
    savings,
    previousYear,
    hasPreviousYear,
    previousIncomes,
    previousExpenses,
  } = useReportData();
  const isLoading = incomes.isLoading || expenses.isLoading || expenseGroups.isLoading || savings.isLoading;
  const isError = incomes.isError || expenses.isError || expenseGroups.isError;

  const story = useMemo(() => {
    const incomeEntries = (incomes.data?.entries ?? []) as ReportEntry[];
    const expenseEntries = (expenses.data?.entries ?? []) as ReportEntry[];
    const groups = (expenseGroups.data?.groups ?? []) as ReportEntryGroup[];
    return buildFinancialStory(incomeEntries, expenseEntries, groups);
  }, [incomes.data, expenses.data, expenseGroups.data]);

  const savingsStory = useMemo(() => {
    const goals = (savings.data?.goals ?? []) as SavingsReportGoal[];
    return buildSavingsStory(goals);
  }, [savings.data]);

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

  if (!story.hasActivity && savings.isError && !savings.data) {
    return <ReportsState message="The financial and savings reports could not be prepared. Try again in a moment." />;
  }

  if (!story.hasActivity && !savingsStory.hasGoals) {
    return <ReportsState message="Add income or expense values, or create a Savings goal, to build your financial story." />;
  }

  return (
    <div className="reports-story mode-enter">
      <Surface variant="layer" className="reports-story-hero">
        <div className="reports-story-overview">
          <div className="reports-financial-overview">
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
          </div>

          <SavingsReportPanel story={savingsStory} error={savings.isError && !savings.data} />
        </div>
      </Surface>

      <div className="reports-story-details">
        <Surface variant="layer" className="reports-story-panel reports-spending-panel">
          <SectionHeading
            title="Where money went"
            caption="Expense groups, annual shares and top entries"
          />
          <SpendingPanel story={story} />
        </Surface>

        <Surface variant="layer" className="reports-story-panel reports-predictability-panel">
          <SectionHeading
            title="Predictability"
            caption="Stability and year-over-year change across active months"
          />
          <PredictabilityPanel
            story={story}
            previousStory={previousStory}
            previousYear={previousStory ? previousYear : null}
          />
        </Surface>
      </div>
    </div>
  );
}

function SavingsReportPanel({
  story,
  error,
}: {
  story: SavingsStory;
  error: boolean;
}) {
  const roundedProgress = story.targetProgress === null
    ? null
    : Math.round(story.targetProgress);
  const coveredTargetTotal = story.targetProgress === null
    ? 0
    : story.targetTotal * story.targetProgress / 100;

  return (
    <section className="reports-savings-panel" aria-labelledby="reports-savings-heading">
      <header className="reports-savings-heading">
        <span className="reports-savings-icon" aria-hidden="true" />
        <div>
          <h3 id="reports-savings-heading">Savings overview</h3>
          <p>Current balances and target coverage</p>
        </div>
      </header>

      {error ? (
        <p className="reports-savings-empty" role="status">
          Savings data could not be loaded.
        </p>
      ) : !story.hasGoals ? (
        <p className="reports-savings-empty">
          Add a Savings goal to include its balance and progress in this report.
        </p>
      ) : (
        <>
          <div className="reports-savings-total">
            <span>Total saved</span>
            <strong className={story.totalSaved < 0 ? 'is-negative' : ''}>
              {formatCurrency(story.totalSaved)}
            </strong>
          </div>

          {roundedProgress === null ? (
            <p className="reports-savings-target-empty">
              Add target values to measure overall progress.
            </p>
          ) : (
            <div className="reports-savings-progress">
              <div className="reports-savings-progress-label">
                <span>Target progress</span>
                <strong>{roundedProgress}%</strong>
              </div>
              <div
                className="reports-savings-progress-track"
                role="progressbar"
                aria-label="Overall savings target progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={roundedProgress}
              >
                <span style={{ width: `${roundedProgress}%` }} />
              </div>
              <small>
                {formatCurrency(coveredTargetTotal)} of {formatCurrency(story.targetTotal)} covered
              </small>
            </div>
          )}

          <div className="reports-savings-facts">
            <div>
              <strong>{story.targetGoalCount > 0 ? formatCurrency(story.remainingToTargets) : '—'}</strong>
              <span>remaining</span>
            </div>
            <div>
              <strong>{story.targetGoalCount > 0 ? `${story.reachedGoals} of ${story.targetGoalCount}` : '—'}</strong>
              <span>goals reached</span>
            </div>
            <div>
              <strong>{formatCurrency(story.withoutTargetBalance)}</strong>
              <span>without target</span>
            </div>
          </div>
        </>
      )}
    </section>
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
    : '/icons/ui/report-money.svg';

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
              title={label}
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
  const groupedTotal = story.expenseGroups.reduce((sum, group) => sum + group.total, 0);
  const groupsWithColors = story.expenseGroups.map((group, index) => ({
    ...group,
    color: SPENDING_GROUP_COLORS[index % SPENDING_GROUP_COLORS.length],
  }));
  let segmentStart = 0;
  const donutSegments = groupsWithColors.map((group) => {
    const start = segmentStart;
    segmentStart += group.share;
    return `${group.color} ${start}% ${segmentStart}%`;
  });
  const donutLabel = groupsWithColors
    .map((group) => `${group.name}: ${formatCurrency(group.total)}, ${group.share.toFixed(1)}%`)
    .join('; ');

  return (
    <div className="reports-spending-content">
      <div className="reports-spending-groups">
        <div
          className="reports-spending-donut"
          role="img"
          aria-label={`Expense distribution by group. ${donutLabel}`}
          style={{ background: `conic-gradient(${donutSegments.join(', ')})` }}
        >
          <span className="reports-spending-donut-center" aria-hidden="true">
            <small>Total</small>
            <strong>{formatCurrency(groupedTotal)}</strong>
          </span>
        </div>

        <div className="reports-spending-legend" aria-label="Expense group legend">
          {groupsWithColors.map((group) => (
            <div className="reports-spending-legend-row" key={group.groupId ?? 'ungrouped'}>
              <span
                className="reports-spending-legend-swatch"
                style={{ backgroundColor: group.color }}
                aria-hidden="true"
              />
              <strong>{group.name}</strong>
              <span className="reports-spending-legend-value">
                {formatCurrency(group.total)}
                <small>{group.share.toFixed(1)}%</small>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="reports-spending-ranking">
        <span className="reports-spending-ranking-title">Top expense entries</span>
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
      </div>
    </div>
  );
}

const SPENDING_GROUP_COLORS = [
  '#938ce3',
  '#4fb58b',
  '#e9ad4f',
  '#529bd3',
  '#db718f',
  '#4cb8b5',
  '#bd7fd5',
  '#df8268',
];

function PredictabilityPanel({
  story,
  previousStory,
  previousYear,
}: {
  story: FinancialStory;
  previousStory: FinancialStory | null;
  previousYear: number | null;
}) {
  return (
    <div className="reports-predictability">
      <StabilityGauge
        icon="/icons/ui/wallet.svg"
        label="Income"
        score={story.incomeStability}
        previousScore={previousStory?.incomeStability ?? null}
        previousYear={previousYear}
      />
      <StabilityGauge
        icon="/icons/ui/credit-card-pay.svg"
        label="Expenses"
        score={story.expenseStability}
        previousScore={previousStory?.expenseStability ?? null}
        previousYear={previousYear}
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
  previousScore,
  previousYear,
}: {
  icon: string;
  label: string;
  score: number | null;
  previousScore: number | null;
  previousYear: number | null;
}) {
  const change = score !== null && previousScore !== null ? score - previousScore : null;
  const changeDirection = change === null || change === 0
    ? 'flat'
    : change > 0
    ? 'up'
    : 'down';
  const changeLabel = change === null
    ? null
    : `${change > 0 ? '↑ +' : change < 0 ? '↓ ' : '→ '}${change} pp`;

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
        <span className="reports-stability-values">
          <span>{score === null ? 'Not enough data' : `${score}% stable`}</span>
          {changeLabel && previousYear && (
            <small className={`is-${changeDirection}`}>
              {changeLabel} <span>vs {previousYear}</span>
            </small>
          )}
        </span>
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
