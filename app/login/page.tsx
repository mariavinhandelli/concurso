// app/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mode = 'login' | 'signup' | 'recover';

// Identidade da marca — fixa (login não herda o sistema de paletas do app).
const BRAND = {
  petrol: '#22484C',
  petrolDeep: '#163033',
  ivory: '#FAF8F3',
  card: '#FFFFFF',
  ink: '#16221F',
  inkSoft: '#5C5A52',
  inkFaint: '#9A968C',
  line: '#E5E0D6',
  lineStrong: '#D8D2C6',
  danger: '#A3352B',
  dangerBg: '#F6E5E2',
  ok: '#16794A',
  okBg: '#E7F5EC',
};

// Traduz os retornos crus do Supabase para mensagens claras em PT-BR
function traduzErro(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (m.includes('user already registered')) return 'Este e-mail já tem cadastro. Faça login.';
  if (m.includes('password should be at least')) return 'A senha precisa de no mínimo 6 caracteres.';
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'E-mail inválido.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Muitas tentativas. Aguarde um instante e tente de novo.';
  return 'Algo deu errado. Tente novamente.';
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Responsivo: abaixo de 880px o painel de marca some, fica só o form.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 880);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  function trocarModo(novo: Mode) {
    if (novo === mode) return;
    setMode(novo);
    setFeedback(null);
  }

  async function handleSubmit() {
    if (loading) return;

    if (mode === 'recover') {
      if (!email) {
        setFeedback({ kind: 'error', text: 'Digite seu e-mail.' });
        return;
      }
      setLoading(true);
      setFeedback(null);
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setLoading(false);
      if (error) {
        setFeedback({ kind: 'error', text: traduzErro(error.message) });
      } else {
        setFeedback({
          kind: 'ok',
          text: 'Se houver conta com esse e-mail, enviamos um link de redefinição.',
        });
      }
      return;
    }

    if (!email || !password) {
      setFeedback({ kind: 'error', text: 'Preencha e-mail e senha.' });
      return;
    }

    setLoading(true);
    setFeedback(null);
    const supabase = createClient();

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setFeedback({ kind: 'error', text: traduzErro(error.message) });
      } else {
        router.push('/');
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setFeedback({ kind: 'error', text: traduzErro(error.message) });
      } else {
        setFeedback({ kind: 'ok', text: 'Conta criada! Já pode entrar.' });
        setMode('login');
      }
    }
  }

  // Quando o Google estiver ativo, descomente esta função e o botão lá embaixo.
  // async function handleGoogle() {
  //   const supabase = createClient();
  //   await supabase.auth.signInWithOAuth({
  //     provider: 'google',
  //     options: { redirectTo: `${window.location.origin}/` },
  //   });
  // }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
  }

  const titulo =
    mode === 'login' ? 'Que bom te ver de novo' : mode === 'signup' ? 'Crie sua conta' : 'Recuperar senha';
  const subtitulo =
    mode === 'login'
      ? 'Entre para continuar seus estudos.'
      : mode === 'signup'
      ? 'Comece a organizar sua preparação.'
      : 'Enviaremos um link para você redefinir a senha.';
  const textoBotao =
    mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link';

  return (
    <main style={styles.page}>
      <div style={{ ...styles.shell, gridTemplateColumns: narrow ? '1fr' : '1fr 1fr' }}>

        {/* COLUNA ESQUERDA — formulário */}
        <div style={styles.formCol}>
          <div style={styles.formInner}>
            <div style={styles.brand}>
              <div style={styles.logo}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" />
                </svg>
              </div>
              <span style={styles.brandText}>Gerenciador de Estudos</span>
            </div>

            <h1 style={styles.title}>{titulo}</h1>
            <p style={styles.subtitle}>{subtitulo}</p>

            {mode !== 'recover' && (
              <div style={styles.segment}>
                <button
                  onClick={() => trocarModo('login')}
                  style={{ ...styles.segmentBtn, ...(mode === 'login' ? styles.segmentActive : {}) }}
                >
                  Entrar
                </button>
                <button
                  onClick={() => trocarModo('signup')}
                  style={{ ...styles.segmentBtn, ...(mode === 'signup' ? styles.segmentActive : {}) }}
                >
                  Criar conta
                </button>
              </div>
            )}

            <label style={styles.label}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="voce@email.com"
              autoComplete="email"
              style={styles.input}
            />

            {mode !== 'recover' && (
              <>
                <label style={styles.label}>Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="mínimo 6 caracteres"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  style={styles.input}
                />
              </>
            )}

            <button onClick={handleSubmit} style={{ ...styles.primary, ...(loading ? styles.primaryLoading : {}) }} disabled={loading}>
              {loading ? 'Aguarde…' : textoBotao}
            </button>

            {mode === 'login' && (
              <button onClick={() => trocarModo('recover')} style={styles.linkBtn}>
                Esqueci minha senha
              </button>
            )}
            {mode === 'recover' && (
              <button onClick={() => trocarModo('login')} style={styles.linkBtn}>
                Voltar para o login
              </button>
            )}

            {/* ===== LOGIN COM GOOGLE (pronto — descomente quando ativar) =====
            {mode !== 'recover' && (
              <>
                <div style={styles.divider}>
                  <span style={styles.dividerLine} />
                  <span style={styles.dividerText}>ou</span>
                  <span style={styles.dividerLine} />
                </div>
                <button onClick={handleGoogle} style={styles.googleBtn}>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                  </svg>
                  Continuar com Google
                </button>
              </>
            )}
            ===== fim do bloco Google ===== */}

            {feedback && (
              <p
                style={{
                  ...styles.feedback,
                  color: feedback.kind === 'error' ? BRAND.danger : BRAND.ok,
                  background: feedback.kind === 'error' ? BRAND.dangerBg : BRAND.okBg,
                }}
              >
                {feedback.text}
              </p>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA — painel de marca (some no mobile) */}
        {!narrow && (
          <div style={styles.brandCol}>
            <div style={styles.brandColInner}>
              <h2 style={styles.brandHeadline}>Preparação de alta performance para concursos.</h2>
              <p style={styles.brandSupport}>
                Acompanhe seu ritmo, revise no tempo certo e veja exatamente onde focar.
              </p>
            </div>
            <div style={styles.brandFooter}>Gerenciador de Estudos</div>
          </div>
        )}

      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: BRAND.ivory,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    fontFamily: 'var(--font-geist-sans), Arial, sans-serif',
  },
  shell: {
    display: 'grid',
    width: 'min(940px, 100%)',
    minHeight: 560,
    background: BRAND.card,
    borderRadius: 24,
    overflow: 'hidden',
    boxShadow: '0 20px 70px -24px rgba(40,40,30,0.28), 0 2px 8px rgba(40,40,30,0.04)',
    border: `0.5px solid ${BRAND.line}`,
  },
  formCol: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '44px 40px',
  },
  formInner: { width: '100%', maxWidth: 340 },
  brand: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 30 },
  logo: {
    width: 34, height: 34, borderRadius: 9, background: BRAND.petrol,
    display: 'grid', placeItems: 'center', flexShrink: 0,
  },
  brandText: { fontSize: 13.5, fontWeight: 600, color: BRAND.ink, letterSpacing: -0.2 },
  title: { margin: 0, fontSize: 23, color: BRAND.ink, fontWeight: 700, letterSpacing: -0.4 },
  subtitle: { margin: '6px 0 24px', fontSize: 14, color: BRAND.inkSoft, lineHeight: 1.5 },
  segment: {
    display: 'flex', gap: 4, padding: 4, background: '#F0ECE3',
    borderRadius: 11, marginBottom: 22,
  },
  segmentBtn: {
    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: 'transparent',
    color: BRAND.inkSoft, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  },
  segmentActive: {
    background: BRAND.card, color: BRAND.ink, fontWeight: 600,
    boxShadow: '0 1px 3px rgba(40,40,30,0.10)',
  },
  label: { display: 'block', fontSize: 12.5, color: BRAND.inkSoft, fontWeight: 500, marginBottom: 6, marginTop: 14 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '12px 13px', borderRadius: 10,
    borderWidth: 0.5, borderStyle: 'solid', borderColor: BRAND.lineStrong,
    background: BRAND.ivory, fontSize: 14, color: BRAND.ink, fontFamily: 'inherit', outline: 'none',
  },
  primary: {
    width: '100%', padding: '13px 0', borderRadius: 11, border: 'none',
    background: BRAND.petrol, color: '#FFFFFF', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', marginTop: 24, fontFamily: 'inherit',
  },
  primaryLoading: { opacity: 0.7, cursor: 'wait' },
  linkBtn: {
    display: 'block', width: '100%', marginTop: 15, padding: 0, border: 'none',
    background: 'transparent', color: BRAND.petrol, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
  },
  divider: { display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' },
  dividerLine: { flex: 1, height: 0.5, background: BRAND.line },
  dividerText: { fontSize: 12, color: BRAND.inkFaint },
  googleBtn: {
    width: '100%', padding: '11px 0', borderRadius: 11,
    borderWidth: 0.5, borderStyle: 'solid', borderColor: BRAND.lineStrong,
    background: BRAND.card, color: BRAND.ink, fontSize: 13.5, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  feedback: {
    fontSize: 13, marginTop: 16, textAlign: 'center', padding: '10px 12px',
    borderRadius: 10, lineHeight: 1.4,
  },
  brandCol: {
    background: BRAND.petrol,
    padding: '48px 44px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    position: 'relative',
  },
  brandColInner: {},
  brandHeadline: {
    margin: 0, fontSize: 26, fontWeight: 700, color: '#fff',
    lineHeight: 1.32, letterSpacing: -0.5,
  },
  brandSupport: {
    margin: '16px 0 0', fontSize: 14.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6,
  },
  brandFooter: {
    position: 'absolute', bottom: 32, left: 44,
    fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.3,
  },
};