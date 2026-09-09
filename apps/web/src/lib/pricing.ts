/** Un producto activo cuyo costo ya alcanzó o superó su precio de venta
 * -- vender así pierde dinero o no deja margen. No sugiere un precio
 * nuevo (haría falta saber qué margen quiere el dueño, todavía sin
 * definir) -- solo detecta la condición, para que Catálogo (el badge
 * "En pérdida") y Compras (el aviso al recibir una orden) avisen con la
 * misma regla en vez de cada uno con la suya. */
export function isEnPerdida(product: { active: boolean; price: number; cost: number }): boolean {
  return product.active && product.price > 0 && product.cost >= product.price
}
