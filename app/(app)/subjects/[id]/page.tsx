// Server Component — verifica subject no servidor antes de enviar qualquer HTML.
// Benefícios vs. versão anterior 100% client-side:
//  • Redirect imediato se subject inválido (sem flash de tela em branco no cliente)
//  • getSubject é resolvido no servidor — useTopics recebe initialSubject e
//    pula esse round-trip na hidratação, só buscando listTopics + getSaudeMap
//  • HTML inicial chega com estrutura da página (não apenas spinner)

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Subject } from '@/services/subjects.service';
import { TopicsClient } from './TopicsClient';

async function fetchSubject(id: string): Promise<Subject | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('subjects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  return data ?? null;
}

export default async function TopicsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subject = await fetchSubject(id);
  if (!subject) redirect('/subjects');
  return <TopicsClient subjectId={id} initialSubject={subject} />;
}
