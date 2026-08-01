-- Tira os 5 decks de Direito Constitucional do Banco de Flashcards.
--
-- Motivo (decisão de produto): o conteúdo "pronto" do Banco vai ser
-- padronizado numa única origem (lei seca / jurisprudência curadas), e esses
-- decks vieram de baralhos Anki externos, com outro padrão de redação.
--
-- is_active = false, NÃO delete: os cards já copiados para "Meus Cards" de
-- quem ativou continuam existindo (flashcards.catalog_card_id aponta para
-- flashcard_catalog_cards sem ON DELETE CASCADE — deletar quebraria a FK e,
-- pior, apagaria estudo de usuário). listCatalogFlashcardDecks() já filtra por
-- is_active, então some da aba Banco na hora e volta com um UPDATE se preciso.

update flashcard_deck_catalog
set is_active = false
where slug in (
  'teoria-da-constituicao',
  'controle-de-constitucionalidade',
  'remedios-constitucionais',
  'direitos-e-garantias-fundamentais',
  'eficacia-das-normas-constitucionais'
);
