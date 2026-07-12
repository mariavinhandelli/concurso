// app/(legal)/privacidade/page.tsx
// RASCUNHO — pendente de revisão jurídica antes de publicar (ver
// docs/plano-acao-fundadora.md). Campos entre 【】 são preenchidos pela
// fundadora/advogado: razão social, CNPJ, encarregado (DPO), e-mail.
// O inventário de dados abaixo reflete o schema real do banco em 12/07/2026
// (tabelas profiles, study_logs, error_notebooks, flashcards, study_notes,
// events, push_subscriptions, social_profiles, friendships, turmas) + Supabase Auth.
import type { Metadata } from 'next';
import { LegalDoc, Section, P, UL } from '../LegalDoc';

export const metadata: Metadata = {
  title: 'Política de Privacidade — focali',
  description: 'Como a focali coleta, usa e protege seus dados pessoais (LGPD).',
};

export default function PrivacidadePage() {
  return (
    <LegalDoc
      title="Política de Privacidade"
      updatedAt="【DD/MM/AAAA】"
      intro={
        <>
          Esta Política explica como a focali, operada por 【RAZÃO SOCIAL】 (CNPJ
          【00.000.000/0001-00】), trata seus dados pessoais, em conformidade com a
          Lei nº 13.709/2018 (LGPD). Para os fins da LGPD, a 【RAZÃO SOCIAL】 é a
          <strong> controladora</strong> dos dados.
        </>
      }
    >
      <Section id="dados" title="1. Quais dados coletamos">
        <P><strong>Dados que você fornece:</strong></P>
        <UL>
          <li>Cadastro: nome de exibição, e-mail e senha (a senha é armazenada de forma cifrada pelo nosso provedor de autenticação, não temos acesso a ela).</li>
          <li>Perfil: foto (avatar) opcional.</li>
          <li>Conteúdo de estudo: sessões registradas, metas, cronograma, caderno de anotações e de erros, flashcards e imagens que você anexa às anotações.</li>
          <li>Recursos sociais (opcionais): nome de exibição público, código de convite, e estatísticas que você escolhe compartilhar com amigos e turmas (sequência de dias, minutos na semana, cobertura).</li>
        </UL>
        <P><strong>Dados coletados automaticamente:</strong></P>
        <UL>
          <li>Eventos de uso do produto (por exemplo: abriu o app, iniciou/concluiu estudo, ativou notificações), associados à sua conta, para melhorar a plataforma.</li>
          <li>Se você autorizar notificações, os dados técnicos da assinatura de push do seu navegador (endpoint e chaves), incluindo o identificador do navegador (user agent).</li>
          <li>Dados técnicos padrão de acesso processados pela nossa infraestrutura de hospedagem (por exemplo, endereço IP e registros de log).</li>
        </UL>
        <P>
          A focali <strong>não coleta dados sensíveis</strong> (como origem racial,
          saúde, biometria) e não usa rastreadores de publicidade de terceiros.
        </P>
      </Section>

      <Section id="finalidades" title="2. Para que usamos e com qual base legal">
        <UL>
          <li><strong>Fornecer a plataforma</strong> (criar conta, salvar seu progresso, exibir seu conteúdo): execução do contrato.</li>
          <li><strong>Processar pagamentos</strong> da assinatura Pro: execução do contrato.</li>
          <li><strong>Enviar notificações</strong> que você ativou (lembretes de estudo): consentimento, revogável a qualquer momento.</li>
          <li><strong>Melhorar o produto</strong> (métricas de uso agregadas): legítimo interesse, respeitando suas expectativas.</li>
          <li><strong>Recursos sociais</strong> (amigos e turmas): consentimento, ativado somente quando você opta por eles.</li>
          <li><strong>Cumprir obrigações legais</strong> e responder a autoridades quando exigido: obrigação legal.</li>
        </UL>
      </Section>

      <Section id="compartilhamento" title="3. Com quem compartilhamos">
        <P>
          Não vendemos seus dados. Compartilhamos o mínimo necessário com
          operadores que sustentam o serviço:
        </P>
        <UL>
          <li><strong>Supabase</strong> — banco de dados, autenticação e armazenamento de arquivos.</li>
          <li><strong>【Vercel / provedor de hospedagem】</strong> — hospedagem da aplicação.</li>
          <li><strong>【Mercado Pago / Stripe】</strong> — processamento de pagamentos (recebe os dados de cobrança necessários; não recebe seu conteúdo de estudo).</li>
          <li>Outros usuários — apenas os dados que você escolher expor ao ativar amigos e turmas.</li>
        </UL>
        <P>
          Alguns operadores podem processar dados fora do Brasil. Nesses casos,
          adotamos as salvaguardas exigidas pela LGPD para transferência
          internacional.
        </P>
      </Section>

      <Section id="retencao" title="4. Por quanto tempo guardamos">
        <P>
          Mantemos seus dados enquanto sua conta existir. Ao excluir a conta,
          apagamos ou anonimizamos seus dados pessoais em prazo razoável,
          ressalvadas as informações que a lei exigir reter (por exemplo,
          registros fiscais de pagamentos).
        </P>
      </Section>

      <Section id="direitos" title="5. Seus direitos (LGPD)">
        <P>Você pode, a qualquer momento:</P>
        <UL>
          <li>confirmar a existência de tratamento e acessar seus dados;</li>
          <li>corrigir dados incompletos ou desatualizados;</li>
          <li>solicitar anonimização, bloqueio ou eliminação de dados desnecessários;</li>
          <li>solicitar a portabilidade e a exclusão da conta;</li>
          <li>revogar consentimentos (por exemplo, notificações e recursos sociais);</li>
          <li>obter informação sobre com quem compartilhamos seus dados.</li>
        </UL>
        <P>
          Boa parte disso já pode ser feita direto na plataforma (editar perfil,
          desligar notificações, desativar o social). Para os demais pedidos,
          fale com nosso encarregado.
        </P>
      </Section>

      <Section id="seguranca" title="6. Segurança">
        <P>
          Aplicamos medidas técnicas para proteger seus dados, incluindo controle
          de acesso por linha (cada usuário só acessa os próprios dados),
          arquivos de anotações em armazenamento privado com links temporários, e
          criptografia em trânsito. Nenhum sistema é 100% imune; em caso de
          incidente de segurança relevante, comunicaremos os titulares e a ANPD
          conforme a lei.
        </P>
      </Section>

      <Section id="encarregado" title="7. Encarregado (DPO) e contato">
        <P>
          Para exercer seus direitos ou tirar dúvidas sobre esta Política, contate
          nosso encarregado de dados: 【NOME DO ENCARREGADO】, pelo e-mail{' '}
          <a href="mailto:【privacidade@focali.app】" style={{ color: 'var(--teal)', textDecoration: 'underline' }}>【privacidade@focali.app】</a>.
        </P>
      </Section>

      <Section id="alteracoes" title="8. Alterações desta Política">
        <P>
          Podemos atualizar esta Política. Mudanças relevantes serão comunicadas
          por e-mail ou dentro da plataforma, e a data de &quot;última
          atualização&quot; no topo será revista.
        </P>
      </Section>
    </LegalDoc>
  );
}
