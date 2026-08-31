-- Se corre después de las migraciones en cada `supabase db reset` /
-- `supabase start` local (nunca contra el proyecto real). Por ahora solo
-- habilita pgTAP, que usan las pruebas de supabase/tests/database/.
create extension if not exists pgtap with schema extensions;
