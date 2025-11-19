export type ReportId =
  | 'monthly-balance'
  | 'spending-leaders'
  | 'income-stability'
  | 'expense-stability';

export const REPORT_DEFINITIONS: Array<{
  id: ReportId;
  label: string;
  icon: string;
  tooltip: string;
}> = [
  {
    id: 'monthly-balance',
    label: 'Income vs expenses',
    icon: '📊',
    tooltip: 'Monthly totals with best/worst months',
  },
  {
    id: 'spending-leaders',
    label: 'Top expenses',
    icon: '🏷️',
    tooltip: 'Highest annual expense categories',
  },
  {
    id: 'income-stability',
    label: 'Income stability',
    icon: '📈',
    tooltip: 'Variance in your income streams',
  },
  {
    id: 'expense-stability',
    label: 'Expense stability',
    icon: '📉',
    tooltip: 'Variance in your expense lines',
  },
];
