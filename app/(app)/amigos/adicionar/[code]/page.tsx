// app/(app)/amigos/adicionar/[code]/page.tsx
// Deep-link de convite: resolve o código, mostra o perfil e adiciona. Está sob
// (app), então o login já é exigido pelo layout. Se o visitante ainda não ativou
// o social, o botão vira "Ativar e adicionar" (opt-in consciente). Mesmo
// wrapper/fluxo de turmas/entrar/[code] — ver InvitePage.
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Handshake } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { invalidateAfter } from '@/lib/cache-invalidation';
import {
  findProfileByCode, getMySocialProfile, enableSocial, sendFriendRequest, type SocialProfile,
} from '@/services/social.service';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { InvitePage, inviteStyles as s } from '@/components/features/social/InvitePage';

export default function AdicionarAmigoPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? '').toUpperCase();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
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
      // /amigos (destino do botão "Ver meus amigos") pode ter cache anterior à
      // ativação/pedido — sem isto, mostrava o gate ou a lista velha por 60s.
      invalidateAfter(queryClient, 'social');
      setDone(true);
      toast.success(res === 'accepted' ? 'Vocês já são amigos! 🎉' : `Pedido enviado para ${prof.name}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível adicionar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <InvitePage>
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
          <Handshake size={32} color={theme.teal} strokeWidth={1.5} style={{ marginBottom: 8 }} />
          <h1 style={s.h1}>Feito!</h1>
          <p style={s.body}>Assim que <b style={s.strong}>{prof.name}</b> aceitar (ou já aceitou), vocês aparecem no ranking um do outro.</p>
          <Button onClick={() => router.push('/amigos')}>Ver meus amigos</Button>
        </>
      ) : (
        <>
          <span style={s.avatarBig}>{(prof.name?.[0] ?? '?').toUpperCase()}</span>
          <h1 style={s.h1}>{prof.name}</h1>
          {/* A copy anterior dizia "quer estudar junto com você", o que o
              sistema não sabe: qualquer pessoa com o link vê esta tela, e
              quem convidou não escolheu VOCÊ. Era pressão social inventada
              sobre um fato inexistente (auditoria de Amigos, P2-11). */}
          <p style={s.body}>
            Este é o convite de <b style={s.strong}>{prof.name}</b> no Focali.
            Quer adicionar como amigo? O pedido só vira amizade depois que a pessoa aceitar.
          </p>
          {!jaAtivo && (
            <p style={s.note}>Ao adicionar, seu perfil social é ativado — amigos veem só seus números (sequência, minutos, % do edital), nunca seu conteúdo.</p>
          )}
          <div style={s.actions}>
            <Button onClick={adicionar} disabled={busy}>
              {busy ? 'Adicionando…' : jaAtivo ? 'Adicionar amigo' : 'Ativar e adicionar'}
            </Button>
            <Button variant="ghost" onClick={() => router.push('/amigos')}>Agora não</Button>
          </div>
        </>
      )}
    </InvitePage>
  );
}
