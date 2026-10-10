import { useMemo, type ReactNode } from 'react';
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
import { formatCurrency, formatCurrencyWhole } from '../utils/currency';
import { getCurrentMonthForYear, type MonthKey } from '../utils/months';
import { useShellActions } from './shell/useShell';
import { Icon } from './ui';

// Overview (former Reports, plan Phase 5): the same queries and analytics,
// laid out as KPI row → month by month → where money went beside savings and
// predictability (docs/mockup_UI/final-ledger.html).

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

const formatSignedWhole = (value: number) =>
  `${value > 0 ? '+' : ''}${formatCurrencyWhole(value)}`;

const formatPercent = (value: number) => `${value.toFixed(1).replace('.', ',')}%`;

export function OverviewView() {
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
  const { goTo } = useShellActions();
  const openExpensesMonth = useAppStore((state) => state.openExpensesMonth);
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
    return <OverviewState message="Select a year to unlock yearly analytics." />;
  }

  if (isLoading) {
    return <OverviewState message="Preparing your financial story…" />;
  }

  if (isError) {
    return <OverviewState message="The financial story could not be prepared. Try again in a moment." />;
  }

  if (!story.hasActivity && savings.isError && !savings.data) {
    return <OverviewState message="The financial and savings reports could not be prepared. Try again in a moment." />;
  }

  if (!story.hasActivity && !savingsStory.hasGoals) {
    return <OverviewState message="Add income or expense values, or create a Savings goal, to build your financial story." />;
  }

  const savingsError = savings.isError && !savings.data;
  const comparisonYear = comparison ? previousYear : null;

  return (
    <div className="overview mode-enter">
      <dl className="overview-kpis" role="group" aria-label="Annual totals">
        <Kpi label="Income" swatch="income" value={formatCurrency(story.totalIncome)}>
          {comparison && comparisonYear && <ComparisonNote comparison={comparison.income} year={comparisonYear} />}
        </Kpi>
        <Kpi label="Expenses" swatch="expense" value={formatCurrency(story.totalExpense)}>
          {comparison && comparisonYear && <ComparisonNote comparison={comparison.expense} year={comparisonYear} />}
        </Kpi>
        <Kpi
          label="Net result"
          value={formatSignedCurrency(story.net)}
          tone={story.net >= 0 ? 'positive' : 'negative'}
        >
          {comparison && comparisonYear && <ComparisonNote comparison={comparison.net} year={comparisonYear} />}
        </Kpi>
        <SavedKpi story={savingsStory} error={savingsError} />
      </dl>

      <MonthByMonth story={story} currentMonth={getCurrentMonthForYear(year)} onOpenMonth={openExpensesMonth} />

      <div className="overview-cols">
        <section className="overview-card" aria-labelledby="overview-spending-heading">
          <CardHeading
            id="overview-spending-heading"
            title="Where money went"
            caption={`Expense groups and largest entries in ${year}`}
          />
          <SpendingBars story={story} />
        </section>

        <div className="overview-side">
          <SavingsCard story={savingsStory} error={savingsError} onOpenSavings={() => goTo('savings')} />
          <section className="overview-card" aria-labelledby="overview-predictability-heading">
            <CardHeading
              id="overview-predictability-heading"
              title="Predictability"
              caption="Stability and year-over-year change across active months"
            />
            <PredictabilityPanel
              story={story}
              previousStory={previousStory}
              previousYear={previousStory ? previousYear : null}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function OverviewState({ message }: { message: string }) {
  return (
    <div className="overview-state">
      <p>{message}</p>
    </div>
  );
}

function CardHeading({
  id,
  title,
  caption,
  children,
}: {
  id: string;
  title: string;
  caption: string;
  children?: ReactNode;
}) {
  return (
    <header className="overview-card-head">
      <h2 id={id}>{title}</h2>
      <p>{caption}</p>
      {children && <div className="overview-card-aside">{children}</div>}
    </header>
  );
}

function Kpi({
  label,
  value,
  swatch,
  icon,
  tone = 'neutral',
  children,
}: {
  label: string;
  value: string;
  swatch?: 'income' | 'expense';
  icon?: string;
  tone?: 'neutral' | 'positive' | 'negative';
  children?: ReactNode;
}) {
  return (
    <div className="overview-kpi">
      <dt>
        {swatch && <span className={`overview-swatch is-${swatch}`} aria-hidden="true" />}
        {icon && <Icon name={icon} size="sm" />}
        {label}
      </dt>
      <dd className={`overview-kpi-value is-${tone}`}>{value}</dd>
      {children && <dd className="overview-kpi-note">{children}</dd>}
    </div>
  );
}

function ComparisonNote({
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
    : `${arrow} ${(comparison.percent ?? 0) > 0 ? '+' : ''}${formatPercent(comparison.percent ?? 0)}`;

  return (
    <>
      <strong className={`is-${comparison.tone}`}>{detail}</strong> vs {year}
    </>
  );
}

// "Saved in goals" reuses the savings story (total saved and target coverage).
function SavedKpi({ story, error }: { story: SavingsStory; error: boolean }) {
  const note = error
    ? 'Savings data could not be loaded.'
    : !story.hasGoals
    ? 'No savings goals yet'
    : story.targetProgress === null
    ? 'No targets set'
    : `${Math.round(story.targetProgress)}% of targets covered`;
  return (
    <Kpi
      label="Saved in goals"
      icon="pig-money"
      value={error || !story.hasGoals ? '—' : formatCurrency(story.totalSaved)}
      tone={!error && story.totalSaved < 0 ? 'negative' : 'neutral'}
    >
      {note}
    </Kpi>
  );
}

function MonthByMonth({
  story,
  currentMonth,
  onOpenMonth,
}: {
  story: FinancialStory;
  currentMonth: MonthKey | null;
  onOpenMonth: (month: MonthKey) => void;
}) {
  return (
    <section className="overview-card" aria-labelledby="overview-months-heading">
      <CardHeading
        id="overview-months-heading"
        title="Month by month"
        caption="Net result per month with income and expense proportions"
      >
        <span><span className="overview-swatch is-income" aria-hidden="true" /> Income</span>
        <span><span className="overview-swatch is-expense" aria-hidden="true" /> Expenses</span>
      </CardHeading>
      <p id="overview-months-hint" className="sr-only">Opens the month in Expenses.</p>

      <ol className="overview-months">
        {story.months.map((month) => {
          const isBest = story.bestMonth?.month === month.month;
          const isWorst = story.worstMonth?.month === month.month;
          const isCurrent = month.month === currentMonth;
          const incomeHeight = Math.abs(month.income) / story.maxMonthlyFlow * 100;
          const expenseHeight = Math.abs(month.expense) / story.maxMonthlyFlow * 100;
          const status = isBest ? 'Best' : isWorst ? 'Weakest' : null;
          const label = (month.hasActivity
            ? `${month.month}: net ${formatSignedCurrency(month.balance)}, income ${formatCurrency(month.income)}, expenses ${formatCurrency(month.expense)}${status ? `, ${status.toLowerCase()} month` : ''}`
            : `${month.month}: no activity`) + (isCurrent ? ', current month' : '');
          const className = [
            'overview-month',
            !month.hasActivity && 'is-empty',
            isBest && 'is-best',
            isWorst && 'is-worst',
            isCurrent && 'is-current',
          ].filter(Boolean).join(' ');

          return (
            <li key={month.month}>
              <button
                type="button"
                className={className}
                aria-label={label}
                aria-describedby="overview-months-hint"
                aria-current={isCurrent ? 'date' : undefined}
                title={label}
                onClick={() => onOpenMonth(month.month)}
              >
                <span className="overview-month-top">
                  <span>{month.month}</span>
                  {status && <span className="overview-flag">{status}</span>}
                </span>
                <span className={`overview-month-net ${month.balance < 0 ? 'is-negative' : 'is-positive'}`}>
                  {month.hasActivity ? formatSignedWhole(month.balance) : 'No data'}
                </span>
                <span className="overview-month-bars" aria-hidden="true">
                  <span
                    className="is-income"
                    style={{ height: month.income === 0 ? 0 : `${Math.max(8, incomeHeight)}%` }}
                  />
                  <span
                    className="is-expense"
                    style={{ height: month.expense === 0 ? 0 : `${Math.max(8, expenseHeight)}%` }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// Groups and top entries share one scale: bar length = share of expenses.
function SpendingBars({ story }: { story: FinancialStory }) {
  if (!story.topExpenses.length) {
    return <p className="overview-empty">Add expense values to see where money went.</p>;
  }

  return (
    <>
      <h3 className="overview-subhead">Expense groups</h3>
      <ul className="overview-bars">
        {story.expenseGroups.map((group) => (
          <li className="overview-bar" key={group.groupId ?? 'ungrouped'}>
            <span className="overview-bar-name">{group.name}</span>
            <span className="overview-bar-value">{formatCurrency(group.total)}</span>
            <span className="overview-bar-share">{formatPercent(group.share)}</span>
            <span className="overview-bar-track" aria-hidden="true">
              <span style={{ width: `${Math.min(100, group.share)}%` }} />
            </span>
          </li>
        ))}
      </ul>

      <h3 className="overview-subhead">Top expense entries</h3>
      <ol className="overview-bars">
        {story.topExpenses.map((expense, index) => (
          <li className="overview-bar is-entry" key={`${expense.name}-${index}`}>
            <span className="overview-bar-name">
              <span className="overview-rank" aria-hidden="true">{index + 1}</span>
              {expense.name}
            </span>
            <span className="overview-bar-value">{formatCurrency(expense.total)}</span>
            <span className="overview-bar-share">{formatPercent(expense.share)}</span>
            <span className="overview-bar-track" aria-hidden="true">
              <span style={{ width: `${Math.min(100, expense.share)}%` }} />
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function SavingsCard({
  story,
  error,
  onOpenSavings,
}: {
  story: SavingsStory;
  error: boolean;
  onOpenSavings: () => void;
}) {
  const roundedProgress = story.targetProgress === null
    ? null
    : Math.round(story.targetProgress);
  const coveredTargetTotal = story.targetProgress === null
    ? 0
    : story.targetTotal * story.targetProgress / 100;

  return (
    <section className="overview-card" aria-labelledby="overview-savings-heading">
      <CardHeading id="overview-savings-heading" title="Savings overview" caption="Current balances and target coverage">
        <button type="button" className="overview-link" onClick={onOpenSavings}>
          Open savings <Icon name="chevron-right" size="sm" />
        </button>
      </CardHeading>

      {error ? (
        <p className="overview-empty" role="status">
          Savings data could not be loaded.
        </p>
      ) : !story.hasGoals ? (
        <p className="overview-empty">
          Add a Savings goal to include its balance and progress in this report.
        </p>
      ) : (
        <>
          <p className="overview-caption">Total saved</p>
          <p className={`overview-big-num ${story.totalSaved < 0 ? 'is-negative' : ''}`}>
            {formatCurrency(story.totalSaved)}
          </p>

          {roundedProgress === null ? (
            <p className="overview-empty">
              Add target values to measure overall progress.
            </p>
          ) : (
            <div className="overview-progress">
              <div className="overview-progress-label">
                <span>Target progress</span>
                <strong>{roundedProgress}%</strong>
              </div>
              <div
                className="overview-track is-accent"
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

          <dl className="overview-stats">
            <div>
              <dt>remaining</dt>
              <dd>{story.targetGoalCount > 0 ? formatCurrency(story.remainingToTargets) : '—'}</dd>
            </div>
            <div>
              <dt>goals reached</dt>
              <dd>{story.targetGoalCount > 0 ? `${story.reachedGoals} of ${story.targetGoalCount}` : '—'}</dd>
            </div>
            <div>
              <dt>without target</dt>
              <dd>{formatCurrency(story.withoutTargetBalance)}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}

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
    <>
      <StabilityRow
        icon="wallet"
        label="Income"
        score={story.incomeStability}
        previousScore={previousStory?.incomeStability ?? null}
        previousYear={previousYear}
      />
      <StabilityRow
        icon="credit-card-pay"
        label="Expenses"
        score={story.expenseStability}
        previousScore={previousStory?.expenseStability ?? null}
        previousYear={previousYear}
      />

      <div className="overview-insights">
        {story.steadiestIncome && (
          <div className="overview-insight is-positive">
            <Icon name="check" size="sm" />
            <p>
              <strong>{story.steadiestIncome.name} was your steadiest income source</strong>
              {story.steadiestIncome.score}% stability across the active part of the year.
            </p>
          </div>
        )}
        {story.mostVariableExpense && (
          <div className="overview-insight is-warning">
            <Icon name="alert-triangle" size="sm" />
            <p>
              <strong>{story.mostVariableExpense.name} varied most month to month</strong>
              {story.mostVariableExpense.score}% stability across the active part of the year.
            </p>
          </div>
        )}
        {!story.steadiestIncome && !story.mostVariableExpense && (
          <p className="overview-empty">Add values in at least two active months to assess predictability.</p>
        )}
      </div>
    </>
  );
}

function StabilityRow({
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
    <div className="overview-stability">
      <span className="overview-stability-name">
        <Icon name={icon} size="sm" />
        {label}
      </span>
      <div
        className={`overview-track ${score === null ? 'is-empty' : 'is-accent'}`}
        role={score === null ? undefined : 'progressbar'}
        aria-label={score === null ? undefined : `${label} stability`}
        aria-valuemin={score === null ? undefined : 0}
        aria-valuemax={score === null ? undefined : 100}
        aria-valuenow={score ?? undefined}
      >
        <span style={{ width: `${score ?? 0}%` }} />
      </div>
      <span className="overview-stability-value">
        {score === null ? 'Not enough data' : `${score}% stable`}
        {changeLabel && previousYear && (
          <small className={`is-${changeDirection}`}>
            {changeLabel} vs {previousYear}
          </small>
        )}
      </span>
    </div>
  );
}
