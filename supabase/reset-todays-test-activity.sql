-- Limpieza final antes de operar de verdad: quita toda la actividad de
-- prueba generada hoy (ventas, cajas, movimientos de inventario ligados
-- a esas ventas, y el producto "Tets" creado al probar Configuración),
-- dejando los 5 productos reales con su existencia inicial de 5kg cada
-- uno, exactamente como se cargó al principio del día.

delete from inventory_movements where reference_type in ('sale', 'sale_void');
delete from sale_payments;
delete from sale_items;
delete from sales;
delete from cash_sessions;
delete from products where sku is null and name = 'Tets';
