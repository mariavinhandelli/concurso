// services/editalPdfExtraction.service.ts
// IA ativa — sobe o PDF do edital pro bucket privado `edital-uploads` e chama
// a Edge Function extract-edital-pdf, que devolve a estrutura extraída SEM
// persistir nada ainda (a usuária revisa/edita antes de confirmar — ver
// ImportarEditalPdfModal + editalImport.service.ts::importEditalAsTarget).
'use client';

import { requireUser } from '@/lib/supabase/requireUser';

export interface EditalMateriaExtraida {
  nome: string;
  topicos: string[];
}

export interface EditalExtraido {
  orgao: string;
  cargo: string;
  banca: string;
  ano: number;
  examDate: string;
  materias: EditalMateriaExtraida[];
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export async function extractEditalFromPdf(file: File): Promise<EditalExtraido> {
  if (file.type !== 'application/pdf') throw new Error('Envie um arquivo PDF.');
  if (file.size > MAX_SIZE_BYTES) throw new Error('O PDF precisa ter até 10MB.');

  const { supabase, userId } = await requireUser();
  const path = `${userId}/${crypto.randomUUID()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('edital-uploads')
    .upload(path, file, { contentType: 'application/pdf' });
  if (uploadError) throw new Error('Não foi possível enviar o PDF: ' + uploadError.message);

  const { data, error } = await supabase.functions.invoke('extract-edital-pdf', { body: { path } });
  if (error) {
    let message = 'Não foi possível extrair o edital deste PDF. Tente colar o texto manualmente.';
    try {
      const body = await error.context?.json();
      if (body?.error) message = body.error;
    } catch {
      // mantém a mensagem genérica
    }
    throw new Error(message);
  }

  return data.edital as EditalExtraido;
}
