-- Convierte los 5 productos ya cargados (que estaban duplicados en
-- filas "Kilo"/"100g") al modelo real de venta a granel: una sola
-- fila por producto, con tarifa de kilo (price) y tarifa de menudeo
-- por 100g (price_per_100g). Ver supabase/migrations/20260820181500_granel_pricing.sql.

update products set sold_by_weight = true, name = 'Ajonjolí Moreno', sku = 'AJO', price_per_100g = 10.00
  where sku = 'AJO-KG';
update products set sold_by_weight = true, name = 'Cacahuate tostado', sku = 'CAC', price_per_100g = 10.00
  where sku = 'CAC-KG';
update products set sold_by_weight = true, name = 'Comino entero', sku = 'COM', price_per_100g = 13.00
  where sku = 'COM-KG';
update products set sold_by_weight = true, name = 'Tapioca', sku = 'TAP', price_per_100g = 10.00
  where sku = 'TAP-KG';
update products set sold_by_weight = true, name = 'Guajillo herradura', sku = 'GUA', price_per_100g = 23.00
  where sku = 'GUA-KG';

delete from products where sku in ('AJO-100G', 'CAC-100G', 'COM-100G', 'TAP-100G', 'GUA-100G');
