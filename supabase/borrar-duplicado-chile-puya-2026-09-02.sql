-- Borra el "Chile Puya" duplicado -- verificado que ninguna de las dos
-- filas tiene ventas ni movimientos de inventario, así que no hay
-- riesgo de perder historial real. Se conserva la más antigua
-- (creada 2026-08-25), se borra la duplicada (2026-08-31).

delete from products where id = '56967819-77b4-49b2-8008-68de079e16db';

-- Verificación: debe quedar exactamente 1 fila.
select id, name, price, active from products where name = 'Chile Puya';
