const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function buildDateString(year: string, month: string, day: string): string {
  if (!year) return '';
  let result = year.padStart(4, '0');
  if (!month) return result;
  result += '-' + month.padStart(2, '0');
  if (!day) return result;
  result += '-' + day.padStart(2, '0');
  return result;
}

export function isPartialDate(value: string): boolean {
  return value.length > 0 && value.length < 10;
}

export function expandPartialDate(partial: string): { start: string; end: string } {
  if (!partial) return { start: '', end: '' };

  const parts = partial.split('-');

  if (parts.length === 1) {
    const year = parseInt(parts[0], 10);
    return {
      start: `${parts[0].padStart(4, '0')}-01-01`,
      end: `${parts[0].padStart(4, '0')}-12-31`,
    };
  }

  if (parts.length === 2) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const lastDay = daysInMonth(year, month);
    return {
      start: `${parts[0].padStart(4, '0')}-${parts[1].padStart(2, '0')}-01`,
      end: `${parts[0].padStart(4, '0')}-${parts[1].padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  return { start: partial, end: partial };
}

export function expandPartialStart(partial: string): string {
  return expandPartialDate(partial).start;
}

export function expandPartialEnd(partial: string): string {
  return expandPartialDate(partial).end;
}

export function formatPartialDateLabel(partial: string): string {
  if (!partial) return '?';

  const parts = partial.split('-');

  if (parts.length === 1) {
    return parts[0];
  }

  if (parts.length === 2) {
    const monthIdx = parseInt(parts[1], 10) - 1;
    const monthName = MONTH_NAMES[monthIdx] || parts[1];
    return `${monthName} ${parts[0]}`;
  }

  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] || parts[1];
  const day = parseInt(parts[2], 10);
  return `${monthName} ${day}, ${parts[0]}`;
}

export function parsePartialDate(dateStr: string): { year: string; month: string; day: string } {
  if (!dateStr) return { year: '', month: '', day: '' };
  const parts = dateStr.split('-');
  return {
    year: parts[0] || '',
    month: parts[1] ? String(parseInt(parts[1], 10)) : '',
    day: parts[2] ? String(parseInt(parts[2], 10)) : '',
  };
}
