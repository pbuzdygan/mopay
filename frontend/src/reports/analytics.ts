import { MONTHS, type MonthKey } from '../utils/months';

export type ReportEntry = {
  id: number;
  name: string;
  comment?: string | null;
  groupId?: number | null;
  [key: string]: number | string | null | undefined;
};

export type ReportEntryGroup = {
  id: number;
  name: string;
};

export type ReportMonth = {
  month: MonthKey;
  income: number;
  expense: number;
  balance: number;
  incomeHasData: boolean;
  expenseHasData: boolean;
  hasActivity: boolean;
};

export type SpendingBreakdown = {
  name: string;
  total: number;
  share: number;
};

export type SpendingGroupBreakdown = SpendingBreakdown & {
  groupId: number | null;
};

export type EntryStability = {
  name: string;
  score: number;
};

export type FinancialStory = {
  months: ReportMonth[];
  totalIncome: number;
  totalExpense: number;
  net: number;
  hasActivity: boolean;
  bestMonth: ReportMonth | null;
  worstMonth: ReportMonth | null;
  maxMonthlyFlow: number;
  topExpenses: SpendingBreakdown[];
  expenseGroups: SpendingGroupBreakdown[];
  incomeStability: number | null;
  expenseStability: number | null;
  steadiestIncome: EntryStability | null;
  mostVariableExpense: EntryStability | null;
};

export type MetricComparison = {
  kind: 'percentage' | 'no-baseline' | 'turned-positive' | 'turned-negative';
  direction: 'up' | 'down' | 'flat';
  tone: 'positive' | 'negative' | 'neutral';
  percent: number | null;
};

export type AnnualComparison = {
  income: MetricComparison;
  expense: MetricComparison;
  net: MetricComparison;
};

export type SavingsReportGoal = {
  targetValue: number | null;
  items: Array<{ value: number }>;
};

export type SavingsStory = {
  hasGoals: boolean;
  totalSaved: number;
  targetTotal: number;
  targetProgress: number | null;
  remainingToTargets: number;
  reachedGoals: number;
  targetGoalCount: number;
  withoutTargetBalance: number;
};

const monthValue = (entry: ReportEntry, month: MonthKey) => {
  const raw = month === 'Dec' ? (entry.Decm ?? entry.Dec) : entry[month];
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};

const entryTotal = (entry: ReportEntry) =>
  MONTHS.reduce((total, month) => total + (monthValue(entry, month) ?? 0), 0);

const aggregateMonth = (entries: ReportEntry[], month: MonthKey) =>
  entries.reduce(
    (result, entry) => {
      const value = monthValue(entry, month);
      if (value === null) return result;
      return { total: result.total + value, hasData: true };
    },
    { total: 0, hasData: false }
  );

const stabilityScore = (values: number[]) => {
  if (values.length < 2) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average <= 0) return null;
  const variance = values.reduce(
    (sum, value) => sum + Math.pow(value - average, 2),
    0
  ) / values.length;
  const coefficient = Math.sqrt(variance) / average;
  return Math.round(Math.max(0, Math.min(100, 100 - coefficient * 100)));
};

const entryStabilities = (entries: ReportEntry[], activeMonths: MonthKey[]) =>
  entries
    .map((entry) => {
      const values = activeMonths
        .map((month) => monthValue(entry, month))
        .filter((value): value is number => value !== null);
      const score = stabilityScore(values);
      return score === null || entryTotal(entry) <= 0
        ? null
        : { name: entry.name, score };
    })
    .filter((entry): entry is EntryStability => entry !== null);

export function buildFinancialStory(
  incomes: ReportEntry[],
  expenses: ReportEntry[],
  expenseGroupDefinitions: ReportEntryGroup[] = []
): FinancialStory {
  const months = MONTHS.map((month) => {
    const incomeResult = aggregateMonth(incomes, month);
    const expenseResult = aggregateMonth(expenses, month);
    const income = incomeResult.total;
    const expense = expenseResult.total;
    return {
      month,
      income,
      expense,
      balance: income - expense,
      incomeHasData: incomeResult.hasData,
      expenseHasData: expenseResult.hasData,
      hasActivity: income !== 0 || expense !== 0,
    };
  });

  const activeIndexes = months
    .map((month, index) => (month.hasActivity ? index : -1))
    .filter((index) => index >= 0);
  const firstActiveIndex = activeIndexes[0];
  const lastActiveIndex = activeIndexes[activeIndexes.length - 1];
  const analysisMonths = firstActiveIndex === undefined || lastActiveIndex === undefined
    ? []
    : months.slice(firstActiveIndex, lastActiveIndex + 1);
  const activeMonthKeys = analysisMonths.map((month) => month.month);
  const monthsWithActivity = months.filter((month) => month.hasActivity);

  const totalIncome = months.reduce((sum, month) => sum + month.income, 0);
  const totalExpense = months.reduce((sum, month) => sum + month.expense, 0);
  const expenseEntryTotals = expenses
    .map((entry) => ({ name: entry.name, total: entryTotal(entry) }))
    .filter((entry) => entry.total > 0);
  const topExpenses = expenseEntryTotals
    .sort((left, right) => right.total - left.total)
    .slice(0, 5)
    .map((entry) => ({
      ...entry,
      share: totalExpense > 0 ? (entry.total / totalExpense) * 100 : 0,
    }));
  const groupNames = new Map(expenseGroupDefinitions.map((group) => [group.id, group.name]));
  const groupTotals = new Map<number | null, number>();
  expenses.forEach((entry) => {
    const total = entryTotal(entry);
    if (total <= 0) return;
    const groupId = entry.groupId ?? null;
    groupTotals.set(groupId, (groupTotals.get(groupId) ?? 0) + total);
  });
  const groupedExpenseTotal = Array.from(groupTotals.values())
    .reduce((sum, total) => sum + total, 0);
  const expenseGroups = Array.from(groupTotals.entries())
    .map(([groupId, total]) => ({
      groupId,
      name: groupId === null ? 'Ungrouped' : groupNames.get(groupId) ?? `Group ${groupId}`,
      total,
      share: groupedExpenseTotal > 0 ? total / groupedExpenseTotal * 100 : 0,
    }))
    .sort((left, right) => right.total - left.total);

  const incomeEntries = entryStabilities(incomes, activeMonthKeys)
    .sort((left, right) => right.score - left.score);
  const expenseEntries = entryStabilities(expenses, activeMonthKeys)
    .sort((left, right) => left.score - right.score);
  const bestMonth = monthsWithActivity.length
    ? monthsWithActivity.reduce((best, month) => month.balance > best.balance ? month : best)
    : null;
  const worstMonth = monthsWithActivity.length
    ? monthsWithActivity.reduce((worst, month) => month.balance < worst.balance ? month : worst)
    : null;
  const canCompareMonths = monthsWithActivity.length > 1
    && bestMonth?.balance !== worstMonth?.balance;

  return {
    months,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    hasActivity: monthsWithActivity.length > 0,
    bestMonth: canCompareMonths ? bestMonth : null,
    worstMonth: canCompareMonths ? worstMonth : null,
    maxMonthlyFlow: Math.max(
      1,
      ...months.flatMap((month) => [Math.abs(month.income), Math.abs(month.expense)])
    ),
    topExpenses,
    expenseGroups,
    incomeStability: stabilityScore(
      analysisMonths.filter((month) => month.incomeHasData).map((month) => month.income)
    ),
    expenseStability: stabilityScore(
      analysisMonths.filter((month) => month.expenseHasData).map((month) => month.expense)
    ),
    steadiestIncome: incomeEntries[0] ?? null,
    mostVariableExpense: expenseEntries[0] ?? null,
  };
}

function compareMetric(
  current: number,
  previous: number,
  options: { lowerIsBetter?: boolean; detectSignChange?: boolean } = {}
): MetricComparison {
  const change = current - previous;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

  if (options.detectSignChange && previous < 0 && current > 0) {
    return { kind: 'turned-positive', direction, tone: 'positive', percent: null };
  }
  if (options.detectSignChange && previous > 0 && current < 0) {
    return { kind: 'turned-negative', direction, tone: 'negative', percent: null };
  }
  if (previous === 0) {
    return { kind: 'no-baseline', direction, tone: 'neutral', percent: null };
  }

  const improved = direction === 'flat'
    ? null
    : options.lowerIsBetter
    ? direction === 'down'
    : direction === 'up';

  return {
    kind: 'percentage',
    direction,
    tone: improved === null ? 'neutral' : improved ? 'positive' : 'negative',
    percent: change / Math.abs(previous) * 100,
  };
}

export function buildAnnualComparison(
  current: Pick<FinancialStory, 'totalIncome' | 'totalExpense' | 'net'>,
  previous: Pick<FinancialStory, 'totalIncome' | 'totalExpense' | 'net'>
): AnnualComparison {
  return {
    income: compareMetric(current.totalIncome, previous.totalIncome),
    expense: compareMetric(current.totalExpense, previous.totalExpense, { lowerIsBetter: true }),
    net: compareMetric(current.net, previous.net, { detectSignChange: true }),
  };
}

export function buildSavingsStory(goals: SavingsReportGoal[]): SavingsStory {
  const balances = goals.map((goal) => ({
    goal,
    saved: goal.items.reduce((sum, item) => {
      const value = Number(item.value ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0),
  }));
  const targetGoals = balances
    .filter(({ goal }) => Number(goal.targetValue) > 0)
    .map(({ goal, saved }) => {
      const target = Number(goal.targetValue);
      return {
        saved,
        target,
        remaining: Math.max(0, target - saved),
        reached: saved >= target,
      };
    });
  const targetTotal = targetGoals.reduce((sum, goal) => sum + goal.target, 0);
  const fundedTargetTotal = targetGoals.reduce(
    (sum, goal) => sum + Math.min(goal.target, Math.max(0, goal.saved)),
    0
  );
  const withoutTarget = balances.filter(({ goal }) => Number(goal.targetValue) <= 0);

  return {
    hasGoals: goals.length > 0,
    totalSaved: balances.reduce((sum, goal) => sum + goal.saved, 0),
    targetTotal,
    targetProgress: targetTotal > 0 ? fundedTargetTotal / targetTotal * 100 : null,
    remainingToTargets: targetGoals.reduce((sum, goal) => sum + goal.remaining, 0),
    reachedGoals: targetGoals.filter((goal) => goal.reached).length,
    targetGoalCount: targetGoals.length,
    withoutTargetBalance: withoutTarget.reduce((sum, goal) => sum + goal.saved, 0),
  };
}
