import { describe, expect, it } from 'vitest';
import {
  localDateInDays,
  parseLocalDate,
  toLocalDateString,
} from '@/lib/local-date';

describe('local-date', () => {
  it('não avança a data civil quando o horário local é 22h', () => {
    const lateEvening = new Date(2026, 5, 27, 22, 0, 0);

    expect(toLocalDateString(lateEvening)).toBe('2026-06-27');
    expect(localDateInDays(1, lateEvening)).toBe('2026-06-28');
  });

  it('atravessa corretamente o fim do mês', () => {
    expect(localDateInDays(1, new Date(2026, 5, 30, 23))).toBe('2026-07-01');
  });

  it('interpreta YYYY-MM-DD no fuso local', () => {
    const date = parseLocalDate('2026-06-27');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(5);
    expect(date.getDate()).toBe(27);
    expect(date.getHours()).toBe(0);
  });

  it('rejeita datas civis impossíveis', () => {
    expect(() => parseLocalDate('2026-02-30')).toThrow('Data inválida');
  });
});
