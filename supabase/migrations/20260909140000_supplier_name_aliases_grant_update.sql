-- La migración anterior (20260909130000) listaba el GRANT incompleto
-- (select, insert, delete) para una tabla a la que rememberSupplierName
-- le hace upsert(..., {onConflict: 'supplier_id,ticket_text'}) -- eso
-- exige también UPDATE, aunque la fila termine insertándose. En la
-- práctica no llegó a fallar: el ALTER DEFAULT PRIVILEGES de
-- 20260820140358 ya venía dando UPDATE (y el resto) de forma implícita a
-- toda tabla nueva, verificado en dev y en producción antes de este
-- parche. Se deja explícito de todos modos, igual que
-- supplier_product_aliases, para no depender en silencio de una regla
-- puesta en otra migración de hace semanas.

grant update on supplier_name_aliases to authenticated;
