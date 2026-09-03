// Lee la foto de un ticket/nota de proveedor y devuelve sus datos ya
// estructurados, para que la pantalla de Compras los muestre y el
// usuario los confirme antes de guardar nada.
//
// Dos principios de diseño, ambos por razones concretas encontradas al
// analizar 11 tickets reales (docs/captura-tickets-analisis.md):
//
// 1. EL MODELO NO HACE CUENTAS. Su trabajo es leer lo que dice el papel.
//    Toda la aritmética (verificar que los renglones sumen el total,
//    deducir una cantidad tapada) la hace este código, que es
//    determinista. Si se le pidiera al modelo "asegúrate de que cuadre",
//    ajustaría números para lograrlo -- un costo inventado que además
//    pasa la validación es el peor error posible aquí.
//
// 2. NUNCA ADIVINAR. Si un número está tapado por un círculo de pluma o
//    un sello (pasa en la mayoría de los tickets del dueño), el modelo
//    debe marcarlo como ilegible, no inventarlo.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const BUCKET = "purchase-tickets";
// Tolerancia al comparar importes: los tickets redondean a centavos y
// algunos traen impuestos prorrateados, así que exigir igualdad exacta
// marcaría como "no cuadra" tickets que están bien.
const TOLERANCIA_PESOS = 0.05;

interface RenglonExtraido {
  descripcion: string | null;
  codigo_proveedor: string | null;
  cantidad: number | null;
  unidad: string | null;
  precio_unitario: number | null;
  importe: number | null;
  ilegible: boolean;
}

interface Extraccion {
  proveedor: { nombre: string | null; rfc: string | null };
  documento: {
    tipo: string | null;
    folio: string | null;
    fecha: string | null;
    subtotal: number | null;
    impuestos: number | null;
    total: number | null;
  };
  renglones: RenglonExtraido[];
  notas: string | null;
}

const PROMPT = `Eres un asistente que lee tickets y notas de compra de proveedores mexicanos (central de abastos) y extrae sus datos.

REGLAS ESTRICTAS:
1. Extrae ÚNICAMENTE lo que alcanzas a leer en la imagen. Si un dato no está o no se distingue, ponlo en null.
2. NO hagas operaciones aritméticas. No calcules cantidades, no sumes importes, no verifiques totales. Solo transcribe lo impreso.
3. NO ajustes ningún número para que las cuentas cuadren. Si un renglón parece inconsistente, transcríbelo tal cual lo ves.
4. Estos tickets suelen traer círculos de pluma, rayas de marcatextos y sellos de goma ENCIMA del texto impreso. Si una marca tapa un número y no puedes leerlo con certeza, pon null en ese campo y marca "ilegible": true en ese renglón. Es preferible un campo vacío a un número equivocado.
5. Copia los nombres de producto tal como aparecen, sin corregirlos ni traducirlos, incluyendo la presentación (ej. "ARROZ SAMAN C/25 KG", "ACHIOTE LA ANITA 50/110 GRS").
6. Las secciones "MAYOREO" y "MENUDEO" son solo agrupaciones del proveedor: incluye los renglones de ambas en la misma lista.
7. La fecha en formato YYYY-MM-DD. Los tickets suelen usar DD/MM/AAAA.
8. "tipo" es "ticket_impreso" si es un ticket de máquina, o "nota_manuscrita" si es una nota llenada a mano.
9. En "notas" menciona cualquier cosa que dificulte la lectura (marcas encima de números, papel doblado, dos documentos en la foto, etc.). Si no hay nada que reportar, deja null.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    proveedor: {
      type: "object",
      properties: {
        nombre: { type: "string", nullable: true },
        rfc: { type: "string", nullable: true },
      },
      required: ["nombre", "rfc"],
    },
    documento: {
      type: "object",
      properties: {
        tipo: { type: "string", nullable: true },
        folio: { type: "string", nullable: true },
        fecha: { type: "string", nullable: true },
        subtotal: { type: "number", nullable: true },
        impuestos: { type: "number", nullable: true },
        total: { type: "number", nullable: true },
      },
      required: ["tipo", "folio", "fecha", "subtotal", "impuestos", "total"],
    },
    renglones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          descripcion: { type: "string", nullable: true },
          codigo_proveedor: { type: "string", nullable: true },
          cantidad: { type: "number", nullable: true },
          unidad: { type: "string", nullable: true },
          precio_unitario: { type: "number", nullable: true },
          importe: { type: "number", nullable: true },
          ilegible: { type: "boolean" },
        },
        required: [
          "descripcion",
          "codigo_proveedor",
          "cantidad",
          "unidad",
          "precio_unitario",
          "importe",
          "ilegible",
        ],
      },
    },
    notas: { type: "string", nullable: true },
  },
  required: ["proveedor", "documento", "renglones", "notas"],
};

// Aislado a propósito: cambiar de proveedor de IA es reemplazar esta
// función, no tocar el resto del flujo.
//
// Se intentan en orden y se usa el primero que responda. Dos razones
// reales, ambas vistas el 2026-09-03 al construir esto:
//
// - Google retira modelos seguido (gemini-2.5-flash ya rechazaba
//   cuentas nuevas; 2.5 se apaga en octubre de 2026). Un solo nombre
//   fijo se rompe solo con el tiempo.
// - El plan gratuito se satura y devuelve 503. Como el usuario final
//   está esperando frente a la pantalla, es mejor caer al siguiente
//   modelo que hacerlo esperar y fallar.
//
// GEMINI_MODELS (lista separada por comas) permite cambiarlos sin
// volver a desplegar código.
const MODELOS_POR_DEFECTO = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3-flash",
];

// Códigos que ameritan probar el siguiente modelo en vez de rendirse:
// 404 = el modelo ya no existe, 429 = cuota, 503 = saturado.
const REINTENTABLES = new Set([404, 429, 503]);

async function llamarModelo(
  modelo: string,
  base64: string,
  mimeType: string,
  apiKey: string,
): Promise<Response> {
  return await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          // Sin creatividad: se trata de transcribir, no de redactar.
          temperature: 0,
        },
      }),
    },
  );
}

// Aislado a propósito: cambiar de proveedor de IA es reemplazar esta
// función, no tocar el resto del flujo.
async function extraerConGemini(
  base64: string,
  mimeType: string,
  apiKey: string,
): Promise<{ extraccion: Extraccion; modelo: string }> {
  const modelos =
    Deno.env.get("GEMINI_MODELS")?.split(",").map((m) => m.trim()).filter(Boolean) ??
    MODELOS_POR_DEFECTO;

  const fallos: string[] = [];

  for (const modelo of modelos) {
    const res = await llamarModelo(modelo, base64, mimeType, apiKey);

    if (res.ok) {
      const data = await res.json();
      const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!texto) {
        fallos.push(`${modelo}: respuesta sin contenido`);
        continue;
      }
      return { extraccion: JSON.parse(texto) as Extraccion, modelo };
    }

    const detalle = (await res.text()).slice(0, 200);
    fallos.push(`${modelo}: ${res.status}`);
    if (!REINTENTABLES.has(res.status)) {
      throw new Error(`El servicio de lectura respondió ${res.status}: ${detalle}`);
    }
  }

  throw new Error(
    `Ningún modelo de lectura está disponible en este momento (${fallos.join("; ")}). Es común que el servicio gratuito se sature; vuelve a intentar en unos minutos.`,
  );
}

const redondear = (v: number) => Math.round(v * 100) / 100;

// Toda la aritmética vive aquí, fuera del modelo: deduce lo que se pueda
// deducir y reporta lo que no cuadre, sin modificar nada de lo leído.
function verificar(extraccion: Extraccion) {
  const renglones = extraccion.renglones.map((r, indice) => {
    let cantidad = r.cantidad;
    let cantidadDeducida = false;

    // Recuperación: el caso más común es que el círculo de pluma tape la
    // cantidad, pero se alcancen a leer precio e importe.
    if (
      cantidad === null &&
      r.precio_unitario !== null &&
      r.importe !== null &&
      r.precio_unitario > 0
    ) {
      cantidad = redondear(r.importe / r.precio_unitario);
      cantidadDeducida = true;
    }

    const puedeCuadrar =
      cantidad !== null && r.precio_unitario !== null && r.importe !== null;
    const cuadra = puedeCuadrar
      ? Math.abs(cantidad! * r.precio_unitario! - r.importe!) <= TOLERANCIA_PESOS
      : null;

    return {
      ...r,
      indice,
      cantidad,
      cantidad_deducida: cantidadDeducida,
      cuadra,
      // Lo que el humano debe revisar sí o sí antes de guardar.
      requiere_revision:
        r.ilegible || cuadra === false || cantidad === null || r.importe === null,
    };
  });

  const importes = renglones
    .map((r) => r.importe)
    .filter((v): v is number => v !== null);
  const sumaRenglones =
    importes.length > 0 ? redondear(importes.reduce((a, b) => a + b, 0)) : null;

  const total = extraccion.documento.total;
  const diferencia =
    sumaRenglones !== null && total !== null ? redondear(total - sumaRenglones) : null;

  return {
    renglones,
    suma_renglones: sumaRenglones,
    total_documento: total,
    diferencia,
    // null = no se pudo comprobar (falta el total o algún importe).
    cuadra: diferencia === null ? null : Math.abs(diferencia) <= TOLERANCIA_PESOS,
    renglones_por_revisar: renglones.filter((r) => r.requiere_revision).length,
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ message: "Method not allowed" }, { status: 405 });
    }

    // Un ticket de compra trae costos y márgenes: mismo alcance que el
    // resto de Compras, admin-only (CLAUDE.md §6).
    const { data: perfil, error: perfilError } = await ctx.supabase
      .from("profiles")
      .select("role")
      .eq("id", ctx.userClaims!.id)
      .single();

    if (perfilError || !perfil) {
      return Response.json({ message: "No se pudo verificar tu perfil" }, { status: 403 });
    }
    if (perfil.role !== "owner" && perfil.role !== "local_admin") {
      return Response.json(
        { message: "Solo un propietario o administrador puede capturar compras" },
        { status: 403 },
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return Response.json(
        { message: "Falta configurar la llave del servicio de lectura (GEMINI_API_KEY)" },
        { status: 500 },
      );
    }

    let body: { storage_path?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ message: "Cuerpo de la solicitud inválido" }, { status: 400 });
    }

    const storagePath = body.storage_path?.trim();
    if (!storagePath) {
      return Response.json({ message: "Falta storage_path" }, { status: 400 });
    }

    const { data: archivo, error: descargaError } = await ctx.supabaseAdmin.storage
      .from(BUCKET)
      .download(storagePath);

    if (descargaError || !archivo) {
      return Response.json(
        { message: `No se pudo leer la foto: ${descargaError?.message ?? "no encontrada"}` },
        { status: 404 },
      );
    }

    // Por bloques: String.fromCharCode con un arreglo completo desborda
    // la pila con imágenes grandes, y concatenar byte por byte es lento.
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const BLOQUE = 8192;
    const partes: string[] = [];
    for (let i = 0; i < bytes.length; i += BLOQUE) {
      partes.push(String.fromCharCode(...bytes.subarray(i, i + BLOQUE)));
    }
    const base64 = btoa(partes.join(""));

    let resultado: { extraccion: Extraccion; modelo: string };
    try {
      resultado = await extraerConGemini(base64, archivo.type || "image/jpeg", apiKey);
    } catch (error) {
      return Response.json(
        { message: error instanceof Error ? error.message : "Error al leer el ticket" },
        { status: 502 },
      );
    }

    return Response.json({
      extraccion: resultado.extraccion,
      // Cuál modelo acabó respondiendo -- útil al comparar calidad entre
      // modelos y al diagnosticar por qué una lectura salió peor.
      modelo: resultado.modelo,
      verificacion: verificar(resultado.extraccion),
    });
  }),
};
