'use client';

// Pedido de edital — o escape hatch do banco. Nenhuma busca termina em beco
// sem saída: quem não achou o concurso registra o pedido, a curadoria recebe
// demanda real (não palpite) e o usuário é avisado quando o edital entrar.

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { requestEdital } from '@/services/editaisCatalog.service';
import { tryGetUser } from '@/lib/supabase/requireUser';
import { track, EV } from '@/lib/analytics';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Overlay } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

interface Props {
  /** Pré-preenche o concurso com o que o usuário buscou e não achou. */
  initialConcurso?: string;
  onClose: () => void;
}

export function PedirEditalModal({ initialConcurso, onClose }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [concurso, setConcurso] = useState(initialConcurso ?? '');
  const [cargo, setCargo] = useState('');
  const [uf, setUf] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit() {
    if (concurso.trim().length < 2) {
      toast.error('Diga qual concurso você procura (ex.: SEFAZ-GO, INSS).');
      return;
    }
    // Página pública: pedir exige conta — visitante vai para o login e volta
    // (mesmo fluxo do "Acompanhar novidades").
    if (!(await tryGetUser())) {
      router.push('/login?returnTo=/editais');
      return;
    }
    setSending(true);
    try {
      await requestEdital({ concurso, cargo: cargo || undefined, uf: uf || undefined });
      track(EV.editalRequested, { concurso: concurso.trim() });
      toast.success('Pedido registrado! Quando o edital entrar no banco, você passa a acompanhá-lo automaticamente.');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao registrar o pedido.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Overlay onClose={onClose} maxWidth={440} labelledBy="pedir-edital-title">
      <h3 id="pedir-edital-title" style={s.title}>Pedir um edital</h3>
      <p style={s.sub}>
        Não achou seu concurso no banco? Conta qual é — os pedidos definem o que
        a curadoria cadastra primeiro. Quando o edital entrar, você passa a
        acompanhá-lo automaticamente e recebe as novidades dele.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Input
          value={concurso}
          onChange={(e) => setConcurso(e.target.value)}
          placeholder="Concurso ou órgão (ex.: SEFAZ-GO, INSS)"
          aria-label="Concurso ou órgão"
          maxLength={120}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <Input
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Cargo (opcional)"
            aria-label="Cargo"
            maxLength={120}
            style={{ flex: 1 }}
          />
          <Select value={uf} onChange={(e) => setUf(e.target.value)} aria-label="UF" style={{ width: 92 }}>
            <option value="">UF</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={sending} loading={sending}>
          {sending ? 'Enviando…' : 'Enviar pedido'}
        </Button>
      </div>
    </Overlay>
  );
}

const s: Record<string, CSSProperties> = {
  title: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: '0 0 6px' },
  sub: { fontSize: 13, color: theme.inkSoft, margin: '0 0 16px', lineHeight: 1.55 },
};
