ALTER TABLE target_exams ADD COLUMN IF NOT EXISTS exam_date DATE;
COMMENT ON COLUMN target_exams.exam_date IS 'Data específica da prova (opcional). Quando preenchida, alimenta a contagem regressiva no home.';
