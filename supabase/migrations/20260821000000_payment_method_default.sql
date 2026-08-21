-- Caja arrancaba cada venta con "Método de pago" vacío, obligando a
-- elegirlo siempre a mano. No hay pantalla para administrar métodos de
-- pago todavía (se cargaron una sola vez por SQL), así que en vez de
-- adivinar un orden (alfabético, por ejemplo), se marca explícitamente
-- cuál es el default de cada negocio -- genérico para cualquier giro,
-- no un valor fijo en el código.

alter table payment_methods add column is_default boolean not null default false;

-- Máximo un default a la vez.
create unique index payment_methods_one_default
  on payment_methods (is_default)
  where is_default;

-- Del Campo cobra ~90% en efectivo -- decisión real del dueño, no una
-- suposición del código.
update payment_methods set is_default = true where code = 'cash';
