-- Endurece dos policies de insert que dejaban que cualquier
-- owner/local_admin/cashier marcara una fila como abierta/vendida por
-- OTRA persona (p. ej. un cajero insertando una venta con sold_by de
-- otro usuario). create_sale() ya no depende de esto porque decide
-- sold_by internamente con auth.uid(), pero las tablas crudas seguían
-- expuestas si alguien las escribe directo vía la API REST.

drop policy cash_sessions_insert on cash_sessions;
create policy cash_sessions_insert on cash_sessions for insert
  to authenticated
  with check (
    current_role_key() in ('owner', 'local_admin', 'cashier')
    and opened_by = auth.uid()
  );

drop policy sales_insert on sales;
create policy sales_insert on sales for insert
  to authenticated
  with check (
    current_role_key() in ('owner', 'local_admin', 'cashier')
    and sold_by = auth.uid()
  );
