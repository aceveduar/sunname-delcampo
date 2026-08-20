-- Limpieza total de datos de prueba antes de cargar el catálogo real
-- de Del Campo. Se corre a mano, una sola vez:
--   supabase db query --linked --file supabase/reset-test-data.sql
--
-- Se borra: catálogo (productos/categorías), todas las ventas y sus
-- líneas/pagos, movimientos de inventario, cajas, órdenes de compra y
-- proveedores, y clientes.
--
-- Se conserva (no es data de prueba, es real): usuarios/perfiles
-- (Eduardo, María), unidades de medida (kg, g, PAQ, COS, PZA, L),
-- métodos de pago (efectivo/tarjeta/transferencia), tenant_modules.

delete from sale_payments;
delete from sale_items;
delete from inventory_movements;
delete from sales;
delete from cash_sessions;

delete from purchase_order_items;
delete from purchase_orders;
delete from suppliers;

delete from customers;

delete from products;
delete from product_categories;
