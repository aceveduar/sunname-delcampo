-- La fecha real de la compra (la impresa en el ticket del proveedor)
-- no es la misma que created_at: una orden capturada por foto se
-- confirma en el sistema días después de la compra real (el dueño
-- sube varios tickets juntos). Mostrar solo created_at en la lista y
-- el detalle de órdenes hacía ver una fecha de compra que no era real.
--
-- Nula para órdenes manuales (Nueva orden), que no vienen de un ticket
-- fechado -- ahí created_at sigue siendo la única fecha que existe.

alter table purchase_orders add column ticket_date date;
