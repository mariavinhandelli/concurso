/** Formata uma data civil no fuso local, sem convertê-la para UTC. */
export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Converte YYYY-MM-DD para meia-noite no fuso local. */
export function parseLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) throw new Error(`Data inválida: ${value}`);

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    throw new Error(`Data inválida: ${value}`);
  }

  return date;
}

export function startOfLocalDay(value: Date | string): Date {
  if (typeof value === 'string') return parseLocalDate(value);
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function localDateInDays(days: number, from: Date = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}
