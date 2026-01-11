export const pln = (n:number)=> new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);

export function formatCurrency(value: number) {
  const negative = value < 0 ? '-' : '';
  const [intPart, decimals = '00'] = Math.abs(value).toFixed(2).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${negative}${grouped},${decimals}`;
}

export function formatCurrencyPlain(value: number) {
  const negative = value < 0 ? '-' : '';
  const [intPart, decimals = '00'] = Math.abs(value).toFixed(2).split('.');
  return `${negative}${intPart},${decimals}`;
}

export function parseCurrencyInput(input: string) {
  if (!input) return 0;
  const normalized = input.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

export function parseCurrencyInputNullable(input: string) {
  if (!input) return 0;
  const trimmed = input.trim();
  if (trimmed === '-' || trimmed === '–') return null;
  return parseCurrencyInput(input);
}
