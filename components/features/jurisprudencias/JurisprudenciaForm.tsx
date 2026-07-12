'use client';

import { useState } from 'react';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { EstrelasBadge } from './EstrelasBadge';
import {
  TRIBUNAIS, TIPOS, STATUS_OPTIONS, INCIDENCIA_OPTIONS,
  type Jurisprudencia, type JurisprudenciaInput,
} from '@/services/jurisprudencias.service';

interface Props {
  initial?: Partial<JurisprudenciaInput>;
  saving: boolean;
  onSave: (data: JurisprudenciaInput) => void;
  onCancel: () => void;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={styles.label}>
        {label}{required && <span style={{ color: theme.danger }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={styles.sectionTitle}>{title}</div>
  );
}

export function JurisprudenciaForm({ initial = {}, saving, onSave, onCancel }: Props) {
  const [tribunal, setTribunal] = useState(initial.tribunal ?? '');
  const [orgaoJulgador, setOrgaoJulgador] = useState(initial.orgao_julgador ?? '');
  const [tipo, setTipo] = useState<Jurisprudencia['tipo']>(initial.tipo ?? 'acordao');
  const [informativo, setInformativo] = useState(initial.informativo ?? '');
  const [processo, setProcesso] = useState(initial.processo ?? '');
  const [relator, setRelator] = useState(initial.relator ?? '');
  const [dataJulgamento, setDataJulgamento] = useState(initial.data_julgamento ?? '');
  const [dataPublicacao, setDataPublicacao] = useState(initial.data_publicacao ?? '');
  const [status, setStatus] = useState<Jurisprudencia['status']>(initial.status ?? 'vigente');

  const [disciplina, setDisciplina] = useState(initial.disciplina ?? '');
  const [materia, setMateria] = useState(initial.materia ?? '');
  const [assunto, setAssunto] = useState(initial.assunto ?? '');
  const [subassunto, setSubassunto] = useState(initial.subassunto ?? '');

  const [dispositivos, setDispositivos] = useState(initial.dispositivos_relacionados ?? '');
  const [tese, setTese] = useState(initial.tese ?? '');
  const [resumo, setResumo] = useState(initial.resumo ?? '');
  const [explicacao, setExplicacao] = useState(initial.explicacao_comparativa ?? '');
  const [porQueAplica, setPorQueAplica] = useState(initial.por_que_aplica ?? '');
  const [esquema, setEsquema] = useState(initial.esquema_visual ?? '');
  const [exemplo, setExemplo] = useState(initial.exemplo_pratico ?? '');
  const [pegadinhas, setPegadinhas] = useState(initial.pegadinhas ?? '');
  const [teseBanca, setTeseBanca] = useState(initial.tese_banca ?? '');
  const [comoBancaCobra, setComoBancaCobra] = useState(initial.como_banca_cobra ?? '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(initial.palavras_chave ?? []);

  const [estrelas, setEstrelas] = useState<1|2|3|4|5>(initial.estrelas ?? 3);
  const [incidencia, setIncidencia] = useState<Jurisprudencia['incidencia_concursos']>(initial.incidencia_concursos ?? 'media');

  const [flashcardFrente, setFlashcardFrente] = useState(initial.flashcard_frente ?? '');
  const [flashcardVerso, setFlashcardVerso] = useState(initial.flashcard_verso ?? '');
  const [questaoEnunciado, setQuestaoEnunciado] = useState(initial.questao_enunciado ?? '');
  const [questaoGabarito, setQuestaoGabarito] = useState<boolean | null>(initial.questao_gabarito ?? null);
  const [questaoComentario, setQuestaoComentario] = useState(initial.questao_comentario ?? '');

  const [superaEntendimento, setSuperaEntendimento] = useState(initial.supera_entendimento_anterior ?? false);
  const [observacaoEvolucao, setObservacaoEvolucao] = useState(initial.observacao_evolucao ?? '');

  const [error, setError] = useState('');

  function addTag(e: React.KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim().toLowerCase();
      if (!tags.includes(t)) setTags((prev) => [...prev, t]);
      setTagInput('');
    }
  }

  function handleSubmit() {
    if (!tribunal.trim()) { setError('Informe o tribunal.'); return; }
    if (!disciplina.trim()) { setError('Informe a disciplina.'); return; }
    if (!tese.trim()) { setError('Informe a tese.'); return; }

    onSave({
      tribunal: tribunal.trim(),
      orgao_julgador: orgaoJulgador.trim() || null,
      tipo,
      informativo: informativo.trim() || null,
      processo: processo.trim() || null,
      relator: relator.trim() || null,
      data_julgamento: dataJulgamento || null,
      data_publicacao: dataPublicacao || null,
      status,
      disciplina: disciplina.trim(),
      materia: materia.trim() || null,
      assunto: assunto.trim() || null,
      subassunto: subassunto.trim() || null,
      dispositivos_relacionados: dispositivos.trim() || null,
      tese: tese.trim(),
      resumo: resumo.trim() || null,
      explicacao_comparativa: explicacao.trim() || null,
      por_que_aplica: porQueAplica.trim() || null,
      esquema_visual: esquema.trim() || null,
      exemplo_pratico: exemplo.trim() || null,
      pegadinhas: pegadinhas.trim() || null,
      tese_banca: teseBanca.trim() || null,
      como_banca_cobra: comoBancaCobra.trim() || null,
      palavras_chave: tags,
      estrelas,
      incidencia_concursos: incidencia,
      flashcard_frente: flashcardFrente.trim() || null,
      flashcard_verso: flashcardVerso.trim() || null,
      questao_enunciado: questaoEnunciado.trim() || null,
      questao_gabarito: questaoGabarito,
      questao_comentario: questaoComentario.trim() || null,
      supera_entendimento_anterior: superaEntendimento,
      observacao_evolucao: observacaoEvolucao.trim() || null,
    });
  }

  return (
    <div className="juris-form" style={{ fontFamily: theme.font, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── 1. IDENTIFICAÇÃO ── */}
      <section>
        <SectionTitle title="1. Identificação" />
        <div style={styles.grid2}>
          <Field label="Tribunal" required>
            <Select value={tribunal} onChange={(e) => setTribunal(e.target.value)}>
              <option value="">Selecione…</option>
              {TRIBUNAIS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Órgão julgador">
            <Input value={orgaoJulgador} onChange={(e) => setOrgaoJulgador(e.target.value)} placeholder="Ex: Primeira Turma" />
          </Field>
          <Field label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as Jurisprudencia['tipo'])}>
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Informativo / Número">
            <Input value={informativo} onChange={(e) => setInformativo(e.target.value)} placeholder="Ex: Inf. 789 ou Súmula 123" />
          </Field>
          <Field label="Processo">
            <Input value={processo} onChange={(e) => setProcesso(e.target.value)} placeholder="Ex: RE 123456/SP" />
          </Field>
          <Field label="Relator(a)">
            <Input value={relator} onChange={(e) => setRelator(e.target.value)} placeholder="Nome do(a) relator(a)" />
          </Field>
          <Field label="Data de julgamento">
            <Input type="date" value={dataJulgamento} onChange={(e) => setDataJulgamento(e.target.value)} />
          </Field>
          <Field label="Data de publicação">
            <Input type="date" value={dataPublicacao} onChange={(e) => setDataPublicacao(e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as Jurisprudencia['status'])}>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
        </div>
      </section>

      {/* ── 2. CLASSIFICAÇÃO ── */}
      <section>
        <SectionTitle title="2. Classificação" />
        <div style={styles.grid2}>
          <Field label="Disciplina" required>
            <Input value={disciplina} onChange={(e) => setDisciplina(e.target.value)} placeholder="Ex: Direito Administrativo" />
          </Field>
          <Field label="Matéria">
            <Input value={materia} onChange={(e) => setMateria(e.target.value)} placeholder="Ex: Atos administrativos" />
          </Field>
          <Field label="Assunto">
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Ex: Motivação" />
          </Field>
          <Field label="Subassunto">
            <Input value={subassunto} onChange={(e) => setSubassunto(e.target.value)} placeholder="Ex: Motivação per relationem" />
          </Field>
        </div>
      </section>

      {/* ── 3. DISPOSITIVOS ── */}
      <section>
        <SectionTitle title="3. Dispositivos relacionados" />
        <Textarea value={dispositivos} onChange={(e) => setDispositivos(e.target.value)} rows={3}
          placeholder="Ex: Art. 37, §6º, CF — Art. 186 do CC" />
      </section>

      {/* ── 4. TESE ── */}
      <section>
        <SectionTitle title="4. Tese" />
        <p style={{ fontSize: 13, color: theme.inkFaint, margin: '0 0 8px' }}>
          Escreva a tese do jeito que o tribunal fixou. Este campo é o coração do card.
        </p>
        <Textarea value={tese} onChange={(e) => setTese(e.target.value)} rows={4}
          placeholder="Tese fixada pelo tribunal…" style={{ borderColor: tese ? theme.teal : theme.line }} required />
      </section>

      {/* ── 5. RESUMO ── */}
      <section>
        <SectionTitle title="5. Resumo" />
        <Textarea value={resumo} onChange={(e) => setResumo(e.target.value)} rows={4}
          placeholder="Resumo do caso e da decisão…" />
      </section>

      {/* ── 6. ENTENDA A DIFERENÇA ── */}
      <section>
        <SectionTitle title="6. Entenda a diferença / Explicação comparativa" />
        <Textarea value={explicacao} onChange={(e) => setExplicacao(e.target.value)} rows={4}
          placeholder="Compare com outras teses similares ou explique a distinção…" />
      </section>

      {/* ── 7. POR QUE SE APLICA ── */}
      <section>
        <SectionTitle title="7. Por que se aplica / não se aplica" />
        <Textarea value={porQueAplica} onChange={(e) => setPorQueAplica(e.target.value)} rows={3}
          placeholder="Contexto e condições de aplicação…" />
      </section>

      {/* ── 8. ESQUEMA VISUAL ── */}
      <section>
        <SectionTitle title="8. Esquema visual em bloco" />
        <p style={{ fontSize: 13, color: theme.inkFaint, margin: '0 0 8px' }}>
          Use texto puro com indentação e símbolos (→, ├, └) para criar o esquema.
        </p>
        <Textarea value={esquema} onChange={(e) => setEsquema(e.target.value)} rows={5}
          placeholder={'Conceito\n├── Requisito 1\n├── Requisito 2\n└── Exceção → caso X'}
          style={{ fontFamily: 'monospace', fontSize: 13 }} />
      </section>

      {/* ── 9. EXEMPLO PRÁTICO ── */}
      <section>
        <SectionTitle title="9. Exemplo prático" />
        <Textarea value={exemplo} onChange={(e) => setExemplo(e.target.value)} rows={3}
          placeholder="Descreva um caso concreto que ilustra a aplicação da tese…" />
      </section>

      {/* ── 10. PEGADINHAS ── */}
      <section>
        <SectionTitle title="10. Pegadinhas de concurso" />
        <div style={{ borderLeft: `3px solid ${theme.danger}`, paddingLeft: 12 }}>
          <Textarea value={pegadinhas} onChange={(e) => setPegadinhas(e.target.value)} rows={3}
            placeholder="Quais erros comuns a banca induz? Como o candidato é pego?" />
        </div>
      </section>

      {/* ── 11. TESE DA BANCA ── */}
      <section>
        <SectionTitle title="11. Tese da banca" />
        <Textarea value={teseBanca} onChange={(e) => setTeseBanca(e.target.value)} rows={3}
          placeholder="Como a banca costuma apresentar a tese nas questões?" />
      </section>

      {/* ── 12. COMO A BANCA COBRA ── */}
      <section>
        <SectionTitle title="12. Como a banca cobra" />
        <div style={{ borderLeft: `3px solid ${theme.clay}`, paddingLeft: 12 }}>
          <Textarea value={comoBancaCobra} onChange={(e) => setComoBancaCobra(e.target.value)} rows={3}
            placeholder="Descreva o padrão de cobrança: assertiva V/F, lacuna, caso concreto…" />
        </div>
      </section>

      {/* ── MODO FLASHCARD (opcional) ── */}
      <section>
        <SectionTitle title="Modo flashcard (opcional)" />
        <p style={{ fontSize: 13, color: theme.inkFaint, margin: '0 0 10px' }}>
          Se preenchido, esta jurisprudência aparecerá no modo flashcard e nas sessões de revisão espaçada.
        </p>
        <div style={styles.grid2}>
          <Field label="Frente (pergunta)">
            <Textarea value={flashcardFrente} onChange={(e) => setFlashcardFrente(e.target.value)} rows={2}
              placeholder="Ex: O Judiciário pode determinar a implementação de políticas públicas?" />
          </Field>
          <Field label="Verso (resposta)">
            <Textarea value={flashcardVerso} onChange={(e) => setFlashcardVerso(e.target.value)} rows={2}
              placeholder="Ex: Sim, em casos de omissão estatal que comprometa o mínimo existencial." />
          </Field>
        </div>
      </section>

      {/* ── MODO QUESTÃO C/E (opcional) ── */}
      <section>
        <SectionTitle title="Modo questão Certo/Errado (opcional)" />
        <p style={{ fontSize: 13, color: theme.inkFaint, margin: '0 0 10px' }}>
          Crie uma mini-assertiva no estilo CESPE/FGV para treinar a aplicação da tese.
        </p>
        <Field label="Enunciado da assertiva">
          <Textarea value={questaoEnunciado} onChange={(e) => setQuestaoEnunciado(e.target.value)} rows={2}
            placeholder="Ex: Segundo o STF, o Judiciário nunca pode interferir em políticas públicas…" style={{ marginBottom: 10 }} />
        </Field>
        <Field label="Gabarito">
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setQuestaoGabarito(true)}
              style={{ ...styles.gabaritoBtn, ...(questaoGabarito === true ? styles.gabaritoBtnCerto : {}) }}>
              Certo
            </button>
            <button type="button" onClick={() => setQuestaoGabarito(false)}
              style={{ ...styles.gabaritoBtn, ...(questaoGabarito === false ? styles.gabaritoBtnErrado : {}) }}>
              Errado
            </button>
          </div>
        </Field>
        <div style={{ marginTop: 10 }}>
          <Field label="Comentário (explicação do gabarito)">
            <Textarea value={questaoComentario} onChange={(e) => setQuestaoComentario(e.target.value)} rows={2}
              placeholder="Explique por que é certo ou errado…" />
          </Field>
        </div>
      </section>

      {/* ── EVOLUÇÃO JURISPRUDENCIAL (opcional) ── */}
      <section>
        <SectionTitle title="Evolução jurisprudencial (opcional)" />
        <p style={{ fontSize: 13, color: theme.inkFaint, margin: '0 0 10px' }}>
          Marque se este julgado supera um entendimento anterior do tribunal e explique a mudança.
        </p>
        <Field label="Supera entendimento anterior?">
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setSuperaEntendimento(true)}
              style={{ ...styles.gabaritoBtn, ...(superaEntendimento ? styles.gabaritoBtnCerto : {}) }}>
              Sim
            </button>
            <button type="button" onClick={() => setSuperaEntendimento(false)}
              style={{ ...styles.gabaritoBtn, ...(!superaEntendimento ? styles.gabaritoBtnErrado : {}) }}>
              Não
            </button>
          </div>
        </Field>
        {superaEntendimento && (
          <div style={{ marginTop: 10 }}>
            <Field label="Observação sobre a evolução">
              <Textarea value={observacaoEvolucao} onChange={(e) => setObservacaoEvolucao(e.target.value)} rows={2}
                placeholder="Ex: O STJ adequou sua jurisprudência ao entendimento firmado pelo STF no HC 232.254/PE…" />
            </Field>
          </div>
        )}
      </section>

      {/* ── 12. PALAVRAS-CHAVE ── */}
      <section>
        <SectionTitle title="13. Palavras-chave / tags" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {tags.map((t) => (
            <span key={t} style={styles.tagChip}>
              {t}
              <button onClick={() => setTags((prev) => prev.filter((x) => x !== t))} style={styles.tagRemove}>×</button>
            </span>
          ))}
        </div>
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={addTag}
          placeholder="Digite uma tag e pressione Enter…"
        />
        <p style={{ fontSize: 12, color: theme.inkFaint, margin: '6px 0 0' }}>
          Pressione Enter ou vírgula para adicionar.
        </p>
      </section>

      {/* ── 13. IMPORTÂNCIA ── */}
      <section>
        <SectionTitle title="14. Importância" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: theme.inkSoft, minWidth: 130 }}>Relevância (estrelas)</span>
            <EstrelasBadge value={estrelas} onChange={setEstrelas} size={22} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: theme.inkSoft, minWidth: 130 }}>Incidência</span>
            <Select value={incidencia} onChange={(e) => setIncidencia(e.target.value as Jurisprudencia['incidencia_concursos'])} style={{ width: 160, maxWidth: '100%' }}>
              {INCIDENCIA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        </div>
      </section>

      {error && <p role="alert" style={{ color: theme.danger, fontSize: 13, margin: 0 }}>{error}</p>}

      {/* ── AÇÕES ── */}
      <div className="juris-form-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: `0.5px solid ${theme.line}` }}>
        <Button variant="outline" className="touch-target" onClick={onCancel}>Cancelar</Button>
        <Button className="touch-target" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar jurisprudência'}
        </Button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px 18px' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: theme.inkSoft, marginBottom: 6 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: theme.teal, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, paddingBottom: 8, borderBottom: `0.5px solid ${theme.line}` },
  tagChip: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: theme.tealDeep, background: theme.tealBg, borderRadius: theme.radiusPill, padding: '3px 10px' },
  tagRemove: { border: 'none', background: 'transparent', color: theme.tealDeep, cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1, fontFamily: 'inherit' },
  gabaritoBtn: { padding: '9px 22px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  gabaritoBtnCerto: { border: `1.5px solid ${theme.ok}`, background: theme.okTint, color: theme.ok },
  gabaritoBtnErrado: { border: `1.5px solid ${theme.danger}`, background: theme.dangerTint, color: theme.danger },
};
