// services/activation.service.ts
// N7 — Ativação de módulos dormentes. Detecta módulos de conteúdo que a pessoa
// NUNCA usou (0 interações) para que o Plano de Hoje possa convidar ao 1º uso —
// atacando o padrão "montei tudo, mas nunca abri o Vade Mecum/Jurisprudências".
// Só leitura de contagens (head), nada é alterado.

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';

export interface DormantModules {
  lei: boolean;         // Vade Mecum nunca usado (0 interações em lei_interacoes)
  juris: boolean;       // Jurisprudências nunca usado (0 em juris_interacoes)
  flashcards: boolean;  // nenhum flashcard criado
}

const NONE: DormantModules = { lei: false, juris: false, flashcards: false };

export async function getDormantModules(): Promise<DormantModules> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return NONE;

  const head = (table: string) =>
    supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', user.id);

  const [lei, juris, fc] = await Promise.all([
    head('lei_interacoes'),
    head('juris_interacoes'),
    head('flashcards'),
  ]);

  return {
    lei: (lei.count ?? 0) === 0,
    juris: (juris.count ?? 0) === 0,
    flashcards: (fc.count ?? 0) === 0,
  };
}
