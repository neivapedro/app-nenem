-- App Heitor · Cofrinho: transferência entre contas.
-- Uma transferência são dois lançamentos com o mesmo transferencia_id: uma
-- retirada na conta de origem e um depósito na de destino. Mudam o saldo de cada
-- conta, mas não contam como depósito (nem em "quem contribuiu", nem no total colocado).
-- Sem chave estrangeira: é só o elo entre as duas pontas (excluir uma conta solta a outra ponta).
-- Idempotente: pode rodar mais de uma vez sem problema.

alter table public.nenem_cofrinho_movimentos add column if not exists transferencia_id uuid;

-- Achar a outra ponta (e o lembrete do mês ignorar transferências)
create index if not exists nenem_cofrinho_movimentos_transferencia
  on public.nenem_cofrinho_movimentos (transferencia_id) where transferencia_id is not null;
