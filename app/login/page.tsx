'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, CalendarClock, ChartLine, Goal } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';

type Mode = 'login' | 'signup' | 'recover';

// Tokens do design system (globals.css). O boot script do layout raiz aplica
// data-palette/data-mode também aqui, então o login acompanha paleta e modo.
const B = {
  navy: 'var(--primary)',
  navyHover: 'var(--primary-hover)',
  green: 'var(--brand-accent)',
  greenBg: 'var(--ok-bg)',
  indigo: 'var(--clay)',
  bg: 'var(--bg)',
  surface: 'var(--card)',
  ink: 'var(--ink)',
  inkSoft: 'var(--ink-soft)',
  inkMuted: 'var(--ink-faint)',
  border: 'var(--line-strong)',
  borderLight: 'var(--line)',
  danger: 'var(--danger)',
  dangerBg: 'var(--danger-bg)',
  ok: 'var(--ok)',
  okBg: 'var(--ok-bg)',
};

function traduzErro(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (m.includes('user already registered')) return 'Este e-mail já tem cadastro. Faça login.';
  if (m.includes('password should be at least')) return 'A senha precisa de no mínimo 6 caracteres.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'E-mail inválido.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde um instante e tente de novo.';
  return 'Algo deu errado. Tente novamente.';
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [btnHover, setBtnHover] = useState(false);

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  function trocarModo(novo: Mode) {
    if (novo === mode) return;
    setMode(novo);
    setFeedback(null);
    setName('');
  }

  async function handleSubmit() {
    if (loading) return;

    if (mode === 'recover') {
      if (!email) { setFeedback({ kind: 'error', text: 'Digite seu e-mail.' }); return; }
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
        setFeedback({ kind: 'ok', text: 'Se houver conta com esse e-mail, enviamos um link de redefinição.' });
      }
      return;
    }

    if (!email || !password) { setFeedback({ kind: 'error', text: 'Preencha e-mail e senha.' }); return; }
    if (mode === 'signup' && !name.trim()) { setFeedback({ kind: 'error', text: 'Digite seu nome para continuar.' }); return; }

    setLoading(true);
    setFeedback(null);
    const supabase = createClient();

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setFeedback({ kind: 'error', text: traduzErro(error.message) });
      } else {
        const requested = new URLSearchParams(window.location.search).get('returnTo');
        const returnTo = requested?.startsWith('/') && !requested.startsWith('//')
          ? requested
          : '/';
        router.push(returnTo);
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } });
      setLoading(false);
      if (error) {
        setFeedback({ kind: 'error', text: traduzErro(error.message) });
      } else {
        setFeedback({ kind: 'ok', text: 'Conta criada! Já pode entrar.' });
        setPassword('');
        setMode('login');
      }
    }
  }

  const titulo = mode === 'login' ? 'Que bom ter você de volta!' : mode === 'signup' ? 'Bem-vindo!' : 'Recuperar senha';
  const subtitulo = mode === 'login' ? 'Faça login para continuar sua jornada.' : mode === 'signup' ? 'Comece sua jornada de estudos.' : 'Enviaremos um link para redefinir sua senha.';
  const textoBotao = mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link';

  return (
    /*
     * CONTAINER PRINCIPAL
     * position: relative + overflow: hidden → impede qualquer elemento de vazar
     * Os blobs ficam DENTRO deste contexto e nunca quebram o layout
     */
    <main style={{
      position: 'relative',
      width: '100%',
      minHeight: '100vh',
      overflowX: 'hidden',
      overflowY: 'auto',
      display: 'flex',
      fontFamily: 'var(--font-poppins), Inter, Arial, sans-serif',
      background: B.bg,
    }}>

      {/* ══ LADO ESQUERDO — visível apenas no desktop ══ */}
      {!narrow && (
        <div style={{
          flex: '0 0 46%',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/*
           * CAMADA DE FUNDO — isolada do layout
           * position: absolute + inset 0 → preenche o painel sem ocupar espaço
           * overflow: hidden → corta os blobs que vazam pela borda
           * z-index: 0 → sempre abaixo do conteúdo (z-index: 1)
           *
           * CÍRCULOS:
           *  – position: absolute com bottom/left em % → responsivos
           *  – filter: blur(80px) → efeito soft/glow da referência
           *  – z-index: -1 → atrás de tudo, inclusive do fundo do painel
           *  – aspect-ratio: 1 → mantém forma circular com width em %
           */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              overflow: 'hidden',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          >
            {/* Blob mint — canto inferior-esquerdo, projetado para fora */}
            <div style={{
              position: 'absolute',
              bottom: '-12%',
              left: '-10%',
              width: '68%',
              aspectRatio: '1',
              borderRadius: '50%',
              background: 'rgba(143, 231, 194, 0.61)',
              filter: 'blur(80px)',
              zIndex: -1,
            }} />

            {/* Blob lavanda — canto inferior, levemente à direita do mint */}
            <div style={{
              position: 'absolute',
              bottom: '-6%',
              left: '20%',
              width: '72%',
              aspectRatio: '1',
              borderRadius: '50%',
              background: 'rgba(154, 166, 255, 0.39)',
              filter: 'blur(80px)',
              zIndex: -1,
            }} />

            {/* Blob verde — base central, maioria abaixo do painel */}
            <div style={{
              position: 'absolute',
              bottom: '-22%',
              left: '6%',
              width: '50%',
              aspectRatio: '1',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.46)',
              filter: 'blur(80px)',
              zIndex: -1,
            }} />


          </div>

          {/* CONTEÚDO — z-index: 1, sempre acima dos blobs */}
          <div style={{ position: 'relative', zIndex: 1, padding: '44px 48px', flex: 1, display: 'flex', flexDirection: 'column' }}>

            {/* Logo */}
            <div style={{ marginBottom: 4 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-slogan-transparent.svg"
                alt="focali — Clareza para evoluir."
                style={{ height: 84, width: 'auto', maxWidth: 260 }}
              />
            </div>

            {/* Hero */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 24 }}>
              <h1 style={{ margin: '0 0 12px', fontSize: 36, fontWeight: 700, color: B.ink, lineHeight: 1.2, letterSpacing: -0.8 }}>
                Estude com foco e <br /> <span style={{ color: B.green }}>direção.</span>
              </h1>
              <p style={{ margin: '0 0 36px', fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.65 }}>
                A plataforma que transforma<br />seu aprendizado em evolução real.{' '}
    
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {FEATURES.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: B.greenBg, display: 'grid', placeItems: 'center' }}>
                      {f.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 2 }}>{f.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.4 }}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ LADO DIREITO — card flutuante centrado ══ */}
<div style={{
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: narrow ? '20px 16px 24px' : '24px 40px 32px',
  minWidth: 0,
  overflowY: 'auto',
  background: 'color-mix(in srgb, var(--card) 94%, transparent)',
  borderLeft: '1px solid var(--line)',
  boxShadow: '-10px 0 30px rgba(0,0,0,0.03)',
}}>

        {/* Topo: toggle de modo */}
        <div style={{ width: '100%', textAlign: 'right', marginBottom: 8 }}>
          {mode !== 'recover' && (
            <>
              <span style={{ fontSize: 14, color: B.inkSoft }}>
                {mode === 'login' ? 'Ainda não tem conta?  ' : 'Já tem conta?  '}
              </span>
              <button
                type="button"
                onClick={() => trocarModo(mode === 'login' ? 'signup' : 'login')}
                style={{ background: 'none', border: 'none', color: B.green, fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              >
                {mode === 'login' ? 'Criar conta' : 'Entrar'} →
              </button>
            </>
          )}
        </div>

        {/* Card flutuante */}
        <div style={{
          width: '100%',
          maxWidth: 460,
          background: B.surface,
          borderRadius: 24,
          boxShadow: '0 8px 32px rgba(15,23,42,.09), 0 1px 3px rgba(15,23,42,.04)',
          padding: narrow ? '32px 24px' : '40px 48px',
          margin: 'auto 0',
        }}>
          <form
            style={{ width: '100%' }}
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >

            {/* Focali icon centered */}
            <div style={{ 
             display: 'flex', 
             justifyContent: 'center', // Centraliza horizontalmente
             alignItems: 'center',     // Centraliza verticalmente (caso o pai tenha altura)
             marginBottom: 20 
       }}>
  <FocaliIcon size={44} idPrefix="rf" />
</div>

            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: B.ink, textAlign: 'center', letterSpacing: -0.5 }}>
              {titulo}
            </h2>
            <p style={{ margin: '0 0 28px', fontSize: 13, color: B.inkSoft, textAlign: 'center' }}>
              {subtitulo}
            </p>

            {/* Nome — apenas no cadastro */}
            {mode === 'signup' && (
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="signup-name" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: B.inkSoft, marginBottom: 6 }}>Seu nome</label>
                <Input
                  id="signup-name"
                  name="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como podemos te chamar?"
                  autoComplete="name"
                  required
                  icon={<User size={16} strokeWidth={1.8} />}
                  style={{ padding: '13px 14px 13px 42px', borderRadius: 12, border: '1.5px solid var(--line-strong)' }}
                />
              </div>
            )}

            {/* E-mail */}
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="auth-email" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: B.inkSoft, marginBottom: 6 }}>E-mail</label>
              <Input
                id="auth-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                required
                icon={<Mail size={16} strokeWidth={1.8} />}
                style={{ padding: '13px 14px 13px 42px', borderRadius: 12, border: '1.5px solid var(--line-strong)' }}
              />
            </div>

            {/* Senha */}
            {mode !== 'recover' && (
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="auth-password" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: B.inkSoft, marginBottom: 6 }}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <Input
                    id="auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    icon={<Lock size={16} strokeWidth={1.8} />}
                    style={{ padding: '13px 44px 13px 42px', borderRadius: 12, border: '1.5px solid var(--line-strong)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showPassword}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: B.inkMuted, display: 'flex' }}
                  >
                    {showPassword
                      ? <EyeOff size={16} strokeWidth={1.8} />
                      : <Eye size={16} strokeWidth={1.8} />
                    }
                  </button>
                </div>
              </div>
            )}

            {/* Recuperação de senha */}
            {mode === 'login' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 24 }}>
                <button type="button" onClick={() => trocarModo('recover')} style={{ background: 'none', border: 'none', color: B.green, fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                  Esqueci minha senha
                </button>
              </div>
            )}

            {mode === 'recover' && (
              <div style={{ marginBottom: 20 }}>
                <button type="button" onClick={() => trocarModo('login')} style={{ background: 'none', border: 'none', color: B.green, fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                  ← Voltar para o login
                </button>
              </div>
            )}

            {mode === 'signup' && <div style={{ marginBottom: 24 }} />}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                background: loading
                  ? 'var(--muted)'
                  : btnHover ? 'var(--gradient-cta-hover)' : 'var(--gradient-cta)',
                color: loading ? 'var(--ink-faint)' : 'var(--on-cta)', fontSize: 15, fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'filter 150ms cubic-bezier(.4,0,.2,1)',
              }}
            >
              {loading ? 'Aguarde…' : (
                <>
                  {textoBotao}
                  <ArrowRight size={16} strokeWidth={2.2} />
                </>
              )}
            </button>

            {/* Feedback */}
            {feedback && (
              <p role={feedback.kind === 'error' ? 'alert' : 'status'} aria-live="polite" style={{ fontSize: 13, marginTop: 14, textAlign: 'center', padding: '10px 14px', borderRadius: 10, lineHeight: 1.5, color: feedback.kind === 'error' ? B.danger : B.ok, background: feedback.kind === 'error' ? B.dangerBg : B.okBg }}>
                {feedback.text}
              </p>
            )}

            {/* Aceite dos termos — só no cadastro (o clique em "Criar conta" implica concordância) */}
            {mode === 'signup' && (
              <p style={{ fontSize: 12, color: B.inkMuted, textAlign: 'center', marginTop: 14, lineHeight: 1.55 }}>
                Ao criar conta, você concorda com os{' '}
                <a href="/termos" target="_blank" rel="noopener noreferrer" style={{ color: B.green, fontWeight: 600 }}>Termos de Uso</a>{' '}
                e a{' '}
                <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: B.green, fontWeight: 600 }}>Política de Privacidade</a>.
              </p>
            )}


            {/* Security badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 32, paddingTop: 24, borderTop: `1px solid ${B.borderLight}` }}>
              <ShieldCheck size="1em" strokeWidth={1.8} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: B.inkSoft }}>Ambiente seguro</div>
                <div style={{ fontSize: 12, color: B.inkMuted }}>Seus dados estão protegidos.</div>
              </div>
            </div>

          </form>
        </div>
      </div>
    </main>
  );
}

/* ── Sub-components ── */

function FocaliIcon({ size, idPrefix }: { size: number; idPrefix: string }) {
  const g1 = `${idPrefix}-g1`;
  const g2 = `${idPrefix}-g2`;
  const g3 = `${idPrefix}-g3`;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={g1} x1="118" y1="96" x2="319" y2="245" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22C55E"/><stop offset="1" stopColor="#A7F5D0"/>
        </linearGradient>
        <linearGradient id={g2} x1="118" y1="242" x2="287" y2="303" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A7F5D0"/><stop offset="1" stopColor="#93C5FD"/>
        </linearGradient>
        <linearGradient id={g3} x1="175" y1="290" x2="312" y2="421" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6366F1"/><stop offset="1" stopColor="#4338CA"/>
        </linearGradient>
      </defs>
      <path d="M118 151C118 120.624 142.624 96 173 96H331C359.719 96 383 119.281 383 148C383 176.719 359.719 200 331 200H222C193.281 200 170 223.281 170 252V252H118V151Z" fill={`url(#${g1})`}/>
      <path d="M170 252C170 223.281 193.281 200 222 200H292C320.719 200 344 223.281 344 252C344 280.719 320.719 304 292 304H170V252Z" fill={`url(#${g2})`}/>
      <path d="M175 304H227V361C227 391.376 202.376 416 172 416C142.177 416 118 391.823 118 362C118 330 143 304 175 304Z" fill={`url(#${g3})`}/>
    </svg>
  );
}


const FEATURES = [
  {
    title: 'Organize seus estudos',
    desc: 'Sua rotina sob controle, do planejamento à execução.',
    icon: <CalendarClock size={18} color="var(--ok)" strokeWidth={2} />,
  },
  {
    title: 'Enxergue sua evolução',
    desc: 'Dados precisos para decisões mais assertivas.',
    icon: <ChartLine size={18} color="var(--ok)" strokeWidth={2} />,
  },
  {
    title: 'Estude com propósito',
    desc: 'Direcionamento claro para ir muito mais longe.',
    icon: <Goal size={18} color="var(--ok)" strokeWidth={2} />,
  },
];
