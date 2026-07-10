// app/(app)/turmas/entrar/[code]/page.tsx
// Deep-link de convite de turma: resolve o código, mostra a turma e entra. Sob
// (app), então o login já é exigido. "Ativar e entrar" quando o social ainda não
// está ativo (opt-in consciente).
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/ToastProvider';
import { findTurmaByCode, joinTurmaByCode } from '@/services/turmas.service';
import { getMySocialProfile, type SocialProfile } from '@/services/social.service';
import { theme } from '@/lib/theme';

export default function EntrarTurmaPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? '').toUpperCase();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const { data: turma, isLoading } = useQuery({
    queryKey: ['find-turma', code],
    queryFn: () => findTurmaByCode(code),
    enabled: code.length > 0,
  });
  const { data: mine } = useQuery<SocialProfile | null>({ queryKey: ['my-social-profile'], queryFn: getMySocialProfile });
  const jaAtivo = !!mine?.enabled;

  async function entrar() {
    if (!turma || busy) return;
    setBusy(true);
    try {
      const res = await joinTurmaByCode(code);
      if (!res) throw new Error('Turma não encontrada.');
      toast.success(`Você entrou na turma "${res.name}"!`);
      router.push('/amigos?tab=turmas');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={s.wrap}>
      <section style={s.card}>
        {isLoading ? (
          <p style={s.muted}>Procurando a turma…</p>
        ) : !turma ? (
          <>
            <div style={s.emoji}>🔍</div>
            <h1 style={s.h1}>Turma não encontrada</h1>
            <p style={s.body}>O código <code style={s.code}>{code}</code> não corresponde a nenhuma turma. Confira o link com quem te enviou.</p>
            <button onClick={() => router.push('/amigos?tab=turmas')} style={s.primary}>Ir para Turmas</button>
          </>
        ) : (
          <>
            <div style={s.emoji}>👥</div>
            <h1 style={s.h1}>{turma.name}</h1>
            <p style={s.body}>{turma.memberCount} {turma.memberCount === 1 ? 'membro' : 'membros'}. Entrar nesta turma?</p>
            {!jaAtivo && (
              <p style={s.note}>Ao entrar, seu perfil social é ativado — a turma vê só seus números (sequência, minutos, % do edital), nunca seu conteúdo.</p>
            )}
            <div style={s.actions}>
              <button onClick={entrar} disabled={busy} style={{ ...s.primary, opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Entrando…' : jaAtivo ? 'Entrar na turma' : 'Ativar e entrar'}
              </button>
              <button onClick={() => router.push('/amigos?tab=turmas')} style={s.ghost}>Agora não</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 480, margin: '0 auto', padding: '48px 20px', fontFamily: theme.font },
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 32, textAlign: 'center' },
  emoji: { fontSize: 44, lineHeight: 1, marginBottom: 12 },
  h1: { fontSize: 22, fontWeight: 800, color: theme.ink, margin: '0 0 8px', letterSpacing: -0.4 },
  body: { fontSize: 14.5, color: theme.inkSoft, lineHeight: 1.6, margin: '0 0 18px' },
  note: { fontSize: 12.5, color: theme.inkFaint, lineHeight: 1.55, margin: '0 0 18px', background: theme.bg, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, padding: '10px 12px' },
  code: { fontFamily: 'ui-monospace, monospace', fontWeight: 700, letterSpacing: 1, color: theme.ink },
  actions: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  primary: { padding: '12px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  ghost: { padding: '12px 16px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  muted: { fontSize: 14, color: theme.inkFaint, textAlign: 'center', margin: 0 },
};
