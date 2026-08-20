-- La restricción original (quantity > 0) hacía imposible registrar un
-- ajuste a la baja (merma, conteo físico menor al esperado), que es
-- el caso más común de "ajuste" en la práctica: la vista
-- inventory_stock suma la cantidad de un ajuste tal cual (sin invertir
-- signo como sí hace con 'out'), así que un ajuste negativo requiere
-- una quantity negativa. 'in'/'out' siguen exigiendo cantidades
-- positivas — su dirección ya la da el tipo de movimiento.

alter table inventory_movements drop constraint inventory_movements_quantity_check;

alter table inventory_movements add constraint inventory_movements_quantity_check
  check (
    (type in ('in', 'out') and quantity > 0)
    or (type = 'adjustment' and quantity <> 0)
  );
