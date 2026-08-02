// app/(app)/turmas/entrar/[code]/page.tsx
// Deep-link de convite de turma: resolve o código, mostra a turma e entra. Sob
// (app), então o login já é exigido. "Ativar e entrar" quando o social ainda não
// está ativo (opt-in consciente). Mesmo wrapper/fluxo de amigos/adicionar/[code]
// — ver InvitePage.
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Users, Check } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { invalidateAfter } from '@/lib/cache-invalidation';
import { findTurmaByCode, joinTurmaByCode } from '@/services/turmas.service';
import { getMySocialProfile, enableSocial, type SocialProfile } from '@/services/social.service';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { InvitePage, inviteStyles as s } from '@/components/features/social/InvitePage';

export default function EntrarTurmaPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? '').toUpperCase();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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
      // A tela avisa "seu perfil social é ativado" e o botão diz "Ativar e
      // entrar" — mas a RPC join_turma_by_code só insere a associação. Sem esta
      // chamada, quem entrava por convite ficava na turma como membro
      // "silencioso" (enabled=false, zerado no fim do ranking), contradizendo
      // a promessa. Mesmo padrão do deep-link de amigo.
      if (!jaAtivo) await enableSocial();
      const res = await joinTurmaByCode(code);
      if (!res) throw new Error('Turma não encontrada.');
      // /amigos pode ter cache de antes ("ative seu perfil", lista de turmas) —
      // invalidar ANTES de navegar, senão a tela de destino mente por até 60s.
      invalidateAfter(queryClient, 'social');
      setDone(true);
      toast.success(`Você entrou na turma "${res.name}"!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <InvitePage>
      {isLoading ? (
        <p style={s.muted}>Procurando a turma…</p>
      ) : !turma ? (
        <>
          <Search size={32} color={theme.inkFaint} strokeWidth={1.5} style={{ marginBottom: 8 }} />
          <h1 style={s.h1}>Turma não encontrada</h1>
          <p style={s.body}>O código <code style={s.code}>{code}</code> não corresponde a nenhuma turma. Confira o link com quem te enviou.</p>
          <Button onClick={() => router.push('/amigos?tab=turmas')}>Ir para Turmas</Button>
        </>
      ) : done ? (
        <>
          <Check size={32} color={theme.teal} strokeWidth={1.5} style={{ marginBottom: 8 }} />
          <h1 style={s.h1}>Feito!</h1>
          <p style={s.body}>Você entrou em <b style={s.strong}>{turma.name}</b>. Confira o ranking e a atividade da turma.</p>
          <Button onClick={() => router.push('/amigos?tab=turmas')}>Ver minha turma</Button>
        </>
      ) : (
        <>
          <Users size={32} color={theme.teal} strokeWidth={1.5} style={{ marginBottom: 8 }} />
          <h1 style={s.h1}>{turma.name}</h1>
          <p style={s.body}>{turma.memberCount} {turma.memberCount === 1 ? 'membro' : 'membros'}. Entrar nesta turma?</p>
          {!jaAtivo && (
            <p style={s.note}>Ao entrar, seu perfil social é ativado — a turma vê só seus números (sequência, minutos, % do edital), nunca seu conteúdo.</p>
          )}
          <div style={s.actions}>
            <Button onClick={entrar} disabled={busy}>
              {busy ? 'Entrando…' : jaAtivo ? 'Entrar na turma' : 'Ativar e entrar'}
            </Button>
            <Button variant="ghost" onClick={() => router.push('/amigos?tab=turmas')}>Agora não</Button>
          </div>
        </>
      )}
    </InvitePage>
  );
}
