-- Seed SOMENTE para o ambiente local (supabase db reset).
-- E-mails fictícios no domínio .test, usados pelos testes e pelo desenvolvimento.
insert into private.auth_allowlist (email, note) values
  ('investigador.a@duossie.test', 'local: jogador A'),
  ('investigador.b@duossie.test', 'local: jogador B'),
  ('investigador.c@duossie.test', 'local: terceiro (testes de isolamento)')
on conflict do nothing;
