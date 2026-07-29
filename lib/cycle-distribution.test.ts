import { describe, it, expect } from 'vitest';
import { distributeMinutesAcrossSlots } from './cycle-distribution';

const slot = (id: string, plannedMinutes: number) => ({ id, plannedMinutes });

describe('distributeMinutesAcrossSlots', () => {
  it('matéria com um slot só recebe tudo', () => {
    expect(distributeMinutesAcrossSlots(62, [slot('a', 60)])).toEqual({ a: 62 });
  });

  // O bug que a Maria viu: 1h02 de Direito Administrativo, que ocupa 2 slots de
  // 60min no ciclo dela. Antes, os 2 slots exibiam 62min e "1 volta" cada — a
  // mesma hora contada duas vezes.
  it('não replica o total entre slots repetidos da mesma matéria', () => {
    const r = distributeMinutesAcrossSlots(62, [slot('s0', 60), slot('s5', 60)]);
    expect(r).toEqual({ s0: 60, s5: 2 });
    expect(r.s0 + r.s5).toBe(62);
  });

  it('enche um slot antes de começar o próximo', () => {
    expect(distributeMinutesAcrossSlots(45, [slot('s0', 60), slot('s5', 60)]))
      .toEqual({ s0: 45, s5: 0 });
  });

  it('conta volta cheia só quando todos os slots da matéria foram cumpridos', () => {
    // 120 = os dois slots de 60 cumpridos → 1 volta em cada.
    const r = distributeMinutesAcrossSlots(120, [slot('s0', 60), slot('s5', 60)]);
    expect(r).toEqual({ s0: 60, s5: 60 });
    expect(Math.floor(r.s0 / 60)).toBe(1);
    expect(Math.floor(r.s5 / 60)).toBe(1);
  });

  it('distribui várias voltas com sobra na ordem do ciclo', () => {
    // 351min em 2 slots de 30: 5 voltas cheias (300) + 51 de sobra.
    const r = distributeMinutesAcrossSlots(351, [slot('s0', 30), slot('s5', 30)]);
    expect(r).toEqual({ s0: 180, s5: 171 });
    expect(r.s0 + r.s5).toBe(351);
  });

  it('respeita slots com planejados diferentes', () => {
    const r = distributeMinutesAcrossSlots(100, [slot('s0', 30), slot('s5', 90)]);
    expect(r).toEqual({ s0: 30, s5: 70 });
    expect(r.s0 + r.s5).toBe(100);
  });

  it('preserva o total em qualquer combinação (invariante)', () => {
    for (const total of [0, 1, 59, 60, 61, 119, 120, 601, 1440]) {
      for (const slots of [
        [slot('a', 60)],
        [slot('a', 60), slot('b', 60)],
        [slot('a', 30), slot('b', 90), slot('c', 45)],
      ]) {
        const soma = Object.values(distributeMinutesAcrossSlots(total, slots))
          .reduce((s, n) => s + n, 0);
        expect(soma).toBe(total);
      }
    }
  });

  it('não quebra sem slots nem com minutos zerados', () => {
    expect(distributeMinutesAcrossSlots(60, [])).toEqual({});
    expect(distributeMinutesAcrossSlots(0, [slot('a', 60), slot('b', 60)]))
      .toEqual({ a: 0, b: 0 });
  });

  it('não perde minutos se o planejado for zero', () => {
    expect(distributeMinutesAcrossSlots(50, [slot('a', 0)])).toEqual({ a: 50 });
  });
});
