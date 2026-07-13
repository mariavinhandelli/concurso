// app/(app)/amigos/adicionar/[code]/page.tsx
// Deep-link de convite: resolve o código, mostra o perfil e adiciona. Está sob
// (app), então o login já é exigido pelo layout. Se o visitante ainda não ativou
// o social, o botão vira "Ativar e adicionar" (opt-in consciente).
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import {
  findProfileByCode, getMySocialProfile, enableSocial, sendFriendRequest, type SocialProfile,
} from '@/services/social.service';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

export default function AdicionarAmigoPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? '').toUpperCase();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const { data: prof, isLoading } = useQuery({
    queryKey: ['find-profile', code],
    queryFn: () => findProfileByCode(code),
    enabled: code.length > 0,
  });
  const { data: mine } = useQuery<SocialProfile | null>({ queryKey: ['my-social-profile'], queryFn: getMySocialProfile });

  const jaAtivo = !!mine?.enabled;

  async function adicionar() {
    if (!prof || busy) return;
    setBusy(true);
    try {
      if (!jaAtivo) await enableSocial();
      const res = await sendFriendRequest(prof.userId);
      setDone(true);
      toast.success(res === 'accepted' ? 'Vocês já são amigos! 🎉' : `Pedido enviado para ${prof.name}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível adicionar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={s.wrap}>
      <section style={s.card}>
        {isLoading ? (
          <p style={s.muted}>Procurando o convite…</p>
        ) : !prof ? (
          <>
            <Search size={32} color={theme.inkFaint} strokeWidth={1.5} style={{ marginBottom: 8 }} />
            <h1 style={s.h1}>Convite não encontrado</h1>
            <p style={s.body}>O código <code style={s.code}>{code}</code> não corresponde a nenhum perfil ativo. Confira o link com quem te enviou.</p>
            <Button onClick={() => router.push('/amigos')}>Ir para Amigos</Button>
          </>
        ) : done ? (
          <>
            <div style={s.emoji}>🤝</div>
            <h1 style={s.h1}>Feito!</h1>
            <p style={s.body}>Assim que <b style={s.strong}>{prof.name}</b> aceitar (ou já aceitou), vocês aparecem no ranking um do outro.</p>
            <Button onClick={() => router.push('/amigos')}>Ver meus amigos</Button>
          </>
        ) : (
          <>
            <span style={s.avatarBig}>{(prof.name?.[0] ?? '?').toUpperCase()}</span>
            <h1 style={s.h1}>{prof.name}</h1>
            <p style={s.body}>quer estudar junto com você no Focali. Adicionar como amigo?</p>
            {!jaAtivo && (
              <p style={s.note}>Ao adicionar, seu perfil social é ativado — amigos veem só seus números (sequência, minutos, % do edital), nunca seu conteúdo.</p>
            )}
            <div style={s.actions}>
              <Button onClick={adicionar} disabled={busy}>
                {busy ? 'Adicionando…' : jaAtivo ? 'Adicionar amigo' : 'Ativar e adicionar'}
              </Button>
              <button onClick={() => router.push('/amigos')} style={s.ghost}>Agora não</button>
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
  avatarBig: { width: 72, height: 72, borderRadius: '50%', background: theme.primary, color: theme.onTeal, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 30, margin: '0 auto 14px' },
  h1: { fontSize: 22, fontWeight: 800, color: theme.ink, margin: '0 0 8px', letterSpacing: -0.4 },
  body: { fontSize: 15, color: theme.inkSoft, lineHeight: 1.6, margin: '0 0 18px' },
  note: { fontSize: 13, color: theme.inkFaint, lineHeight: 1.55, margin: '0 0 18px', background: theme.bg, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, padding: '10px 12px' },
  strong: { color: theme.ink, fontWeight: 700 },
  code: { fontFamily: 'ui-monospace, monospace', fontWeight: 700, letterSpacing: 1, color: theme.ink },
  actions: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  primary: { padding: '12px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  ghost: { padding: '12px 16px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  muted: { fontSize: 14, color: theme.inkFaint, textAlign: 'center', margin: 0 },
};
