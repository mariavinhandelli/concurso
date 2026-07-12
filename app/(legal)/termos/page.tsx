// app/(legal)/termos/page.tsx
// RASCUNHO — pendente de revisão jurídica antes de publicar (ver
// docs/plano-acao-fundadora.md). Campos entre 【】 são preenchidos pela
// fundadora/advogado: razão social, CNPJ, foro, e-mail, preços.
import type { Metadata } from 'next';
import { LegalDoc, Section, P, UL } from '../LegalDoc';

export const metadata: Metadata = {
  title: 'Termos de Uso — focali',
  description: 'Termos de Uso da plataforma de estudos focali.',
};

export default function TermosPage() {
  return (
    <LegalDoc
      title="Termos de Uso"
      updatedAt="【DD/MM/AAAA】"
      intro={
        <>
          Estes Termos regem o uso da plataforma focali (&quot;focali&quot;, &quot;plataforma&quot;,
          &quot;nós&quot;), operada por 【RAZÃO SOCIAL】, inscrita no CNPJ sob o nº
          【00.000.000/0001-00】. Ao criar uma conta ou usar a plataforma, você
          (&quot;usuário&quot;) concorda integralmente com estes Termos. Se não
          concordar, não utilize a focali.
        </>
      }
    >
      <Section id="objeto" title="1. O que é a focali">
        <P>
          A focali é uma ferramenta de organização e acompanhamento de estudos
          para concursos públicos. Ela ajuda o usuário a planejar sua rotina,
          registrar sessões de estudo, revisar conteúdos, manter um caderno de
          anotações e erros, e visualizar seu progresso. A focali é um apoio ao
          estudo e <strong>não garante aprovação em qualquer concurso ou exame</strong>.
        </P>
        <P>
          O conteúdo de referência disponibilizado (textos de leis, súmulas,
          jurisprudências, mapas de incidência e questões) tem finalidade
          didática e de organização. Apesar do cuidado na curadoria, pode conter
          imprecisões ou estar desatualizado; a fonte oficial de cada norma
          prevalece sobre o que é exibido na plataforma.
        </P>
      </Section>

      <Section id="cadastro" title="2. Cadastro e conta">
        <UL>
          <li>Para usar a focali é necessário criar uma conta com e-mail e senha válidos, informando um nome de exibição.</li>
          <li>Você é responsável por manter a confidencialidade da sua senha e por toda atividade realizada na sua conta.</li>
          <li>Você declara ter pelo menos 18 anos ou, se menor, estar autorizado e assistido por responsável legal.</li>
          <li>Os dados informados no cadastro devem ser verdadeiros e mantidos atualizados.</li>
        </UL>
      </Section>

      <Section id="planos" title="3. Planos, pagamento e cancelamento">
        <P>
          A focali oferece um plano gratuito com funcionalidades limitadas e um
          plano pago (&quot;focali Pro&quot;) por 【R$ 24,90/mês ou R$ 199/ano】, cobrado
          de forma recorrente por meio do processador de pagamentos 【Mercado
          Pago / Stripe】. Impostos aplicáveis podem incidir sobre o preço.
        </P>
        <UL>
          <li>A assinatura renova automaticamente ao fim de cada ciclo até que seja cancelada.</li>
          <li>Você pode cancelar a qualquer momento; o acesso Pro permanece até o fim do período já pago, sem novas cobranças.</li>
          <li>Reembolsos seguem o Código de Defesa do Consumidor, incluindo o direito de arrependimento em até 7 dias da primeira contratação feita à distância.</li>
          <li>Podemos alterar preços mediante aviso prévio; mudanças não afetam o ciclo já pago.</li>
        </UL>
      </Section>

      <Section id="uso" title="4. Uso aceitável">
        <P>Ao usar a focali, você concorda em não:</P>
        <UL>
          <li>copiar, redistribuir ou revender o conteúdo de referência da plataforma fora do seu uso pessoal de estudo;</li>
          <li>acessar áreas ou dados de outros usuários, ou tentar burlar mecanismos de segurança;</li>
          <li>usar robôs, scraping ou meios automatizados para extrair conteúdo em massa;</li>
          <li>inserir conteúdo ilícito, ofensivo ou que viole direitos de terceiros nas anotações, no caderno ou nos recursos sociais (amigos e turmas).</li>
        </UL>
        <P>
          Podemos suspender ou encerrar contas que violem estes Termos, com aviso
          quando possível.
        </P>
      </Section>

      <Section id="conteudo-usuario" title="5. Conteúdo do usuário">
        <P>
          Anotações, erros, flashcards, imagens e demais dados que você cria
          continuam sendo seus. Você nos concede apenas a licença necessária para
          armazenar e exibir esse conteúdo a você (e, quando você opta pelos
          recursos sociais, aos usuários que você escolher). Não usamos seu
          conteúdo de estudo para outros fins nem o tornamos público sem sua ação.
        </P>
      </Section>

      <Section id="propriedade" title="6. Propriedade intelectual">
        <P>
          A marca focali, a interface, o código e a curadoria própria de conteúdo
          são protegidos e pertencem a 【RAZÃO SOCIAL】. Textos de leis e decisões
          judiciais são de domínio público; a organização, os comentários e os
          mapas de incidência produzidos pela focali não são.
        </P>
      </Section>

      <Section id="disponibilidade" title="7. Disponibilidade e limitação de responsabilidade">
        <P>
          Empenhamo-nos para manter a plataforma disponível, mas ela é fornecida
          &quot;no estado em que se encontra&quot;, sem garantia de operação
          ininterrupta ou livre de erros. Na máxima extensão permitida em lei, a
          focali não responde por danos indiretos, perda de dados decorrente de
          mau uso, ou por decisões de estudo tomadas com base na plataforma.
        </P>
      </Section>

      <Section id="privacidade" title="8. Privacidade">
        <P>
          O tratamento de dados pessoais é descrito na nossa{' '}
          <a href="/privacidade" style={{ color: 'var(--teal)', textDecoration: 'underline' }}>Política de Privacidade</a>,
          que integra estes Termos.
        </P>
      </Section>

      <Section id="alteracoes" title="9. Alterações destes Termos">
        <P>
          Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas
          por e-mail ou dentro da plataforma. O uso continuado após a vigência
          implica concordância com a versão atualizada.
        </P>
      </Section>

      <Section id="foro" title="10. Lei aplicável e foro">
        <P>
          Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da
          comarca de 【CIDADE/UF】 para dirimir controvérsias, sem prejuízo do foro
          de domicílio do consumidor quando aplicável.
        </P>
      </Section>
    </LegalDoc>
  );
}
