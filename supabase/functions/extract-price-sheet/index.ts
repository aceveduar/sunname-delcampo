// Lee la foto de una hoja de precios escrita a mano por el dueño y
// devuelve sus renglones ya estructurados, para que la pantalla de
// Catálogo los muestre y una persona los confirme antes de tocar ningún
// precio.
//
// Mismos dos principios que la lectura de tickets de compra
// (extract-purchase-ticket), por las mismas razones:
//
// 1. EL MODELO NO HACE CUENTAS. Solo transcribe lo escrito. Deducir el
//    precio del kilo a partir del cuarto, o comprobar que el cuarto sea
//    exactamente kilo/4, lo hace este código, que es determinista. Un
//    precio inventado que además cuadre sería el peor error posible.
//
// 2. NUNCA ADIVINAR. La letra manuscrita se presta a confundir un 3 con
//    un 8 o un 1 con un 7. Si un número no se distingue con certeza, se
//    marca ilegible en vez de inventarlo: aquí un error se cobra a los
//    clientes durante semanas.
//
// Lo que se sabe de las hojas reales (docs/precios-granel.md y la carga
// manual del 2026-09-02): cada renglón trae el nombre del producto, el
// precio por 100 g y el precio por kilo. El precio del cuarto, cuando
// aparece, es exactamente kilo/4 -- confirmado en los 27 productos
// revisados a mano -- así que no se guarda, se deriva.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const BUCKET = "price-sheets";
// El cuarto se confirmó exacto (kilo/4) en los 27 productos revisados a
// mano, pero un centavo de diferencia por redondeo no debe marcar la
// hoja como inconsistente.
const TOLERANCIA_PESOS = 0.05;

interface RenglonExtraido {
  descripcion: string | null;
  precio_100g: number | null;
  precio_cuarto: number | null;
  precio_kilo: number | null;
  ilegible: boolean;
}

interface Extraccion {
  hoja: { titulo: string | null; fecha: string | null };
  renglones: RenglonExtraido[];
  notas: string | null;
}

const PROMPT =
  `Eres un asistente que lee hojas de precios escritas a mano por el dueño de una tienda mexicana de chiles, moles y semillas a granel, y extrae sus datos.

CÓMO SON ESTAS HOJAS:
- Una lista de productos, uno por renglón, con uno o varios precios cada uno.
- Los precios suelen venir en columnas encabezadas por algo como "100 grs", "1/4", "kilo" o "KG". A veces el encabezado se escribe una sola vez arriba y no se repite.
- Los nombres son de productos a granel: chiles secos, moles, semillas, granos, especias.

REGLAS ESTRICTAS:
1. Extrae ÚNICAMENTE lo que alcanzas a leer. Si un dato no está o no se distingue, ponlo en null.
2. NO hagas operaciones aritméticas. No calcules el precio del kilo a partir del cuarto, ni al revés, ni completes columnas vacías. Solo transcribe lo escrito.
3. NO ajustes ningún número para que las cuentas cuadren ni para que un renglón se parezca a los de arriba.
4. Es letra manuscrita: un 3 puede parecer un 8, un 1 un 7, un 0 un 6. Si un número no se distingue con CERTEZA, pon null en ese campo y marca "ilegible": true en ese renglón. Aquí un número equivocado termina cobrándose mal a los clientes durante semanas: es mucho mejor un campo vacío.
5. Asigna cada precio a la columna que le corresponde según su encabezado: "precio_100g" para 100 gramos, "precio_cuarto" para 1/4 de kilo, "precio_kilo" para el kilo. Si un renglón trae un solo precio y NO puedes determinar a qué medida corresponde, ponlo en null en las tres y marca el renglón como ilegible, explicándolo en "notas".
6. Copia los nombres tal como están escritos, sin corregir la ortografía ni completar abreviaturas.
7. Ignora tachones y renglones cancelados. Si un precio fue tachado y corregido encima, transcribe el valor NUEVO (el que corrige), no el tachado.
8. "titulo" es el encabezado de la hoja si lo tiene (ej. "CHILES SECOS", "MOLES"). "fecha" en formato YYYY-MM-DD si la hoja la trae; si no, null.
9. En "notas" menciona cualquier cosa que dificulte la lectura: columnas sin encabezado, tachones, papel doblado, renglones que no supiste interpretar. Si no hay nada que reportar, deja null.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    hoja: {
      type: "object",
      properties: {
        titulo: { type: "string", nullable: true },
        fecha: { type: "string", nullable: true },
      },
      required: ["titulo", "fecha"],
    },
    renglones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          descripcion: { type: "string", nullable: true },
          precio_100g: { type: "number", nullable: true },
          precio_cuarto: { type: "number", nullable: true },
          precio_kilo: { type: "number", nullable: true },
          ilegible: { type: "boolean" },
        },
        required: [
          "descripcion",
          "precio_100g",
          "precio_cuarto",
          "precio_kilo",
          "ilegible",
        ],
      },
    },
    notas: { type: "string", nullable: true },
  },
  required: ["hoja", "renglones", "notas"],
};

// Misma lista y mismas razones que extract-purchase-ticket: Google retira
// modelos seguido y el plan gratuito se satura con 503. Se usa el primero
// que responda. GEMINI_MODELS permite cambiarlos sin desplegar código.
const MODELOS_POR_DEFECTO = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3-flash",
];

const REINTENTABLES = new Set([404, 429, 503]);

// Cada intento tiene su propio reloj. Sin esto, un modelo lento se lleva
// todo el presupuesto de tiempo de la función y la mata la puerta de
// enlace con un 504 -- que no trae mensaje, así que el usuario se queda
// mirando "Leyendo…" sin saber qué pasó. Con el corte, se cae al
// siguiente modelo o se devuelve un 502 propio, que sí explica.
const TIMEOUT_POR_MODELO_MS = 25_000;

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
          temperature: 0,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_POR_MODELO_MS),
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
    let res: Response;
    try {
      res = await llamarModelo(modelo, base64, mimeType, apiKey);
    } catch (error) {
      // Se agotó el reloj de este modelo (o falló la red): se prueba el
      // siguiente en vez de arrastrar la espera hasta el 504.
      fallos.push(`${modelo}: ${error instanceof Error ? error.name : "error de red"}`);
      continue;
    }

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
    `Ningún modelo de lectura está disponible en este momento (${
      fallos.join("; ")
    }). Es común que el servicio gratuito se sature; vuelve a intentar en unos minutos.`,
  );
}

const redondear = (v: number) => Math.round(v * 100) / 100;

// Toda la aritmética vive aquí, fuera del modelo: deduce lo deducible y
// reporta lo que no cuadre, sin modificar nada de lo leído.
function verificar(extraccion: Extraccion) {
  const renglones = extraccion.renglones.map((r, indice) => {
    let precioKilo = r.precio_kilo;
    let kiloDeducido = false;

    // Recuperación: si el kilo no se alcanza a leer pero sí el cuarto, se
    // deriva. Es válido porque la relación cuarto = kilo/4 se confirmó
    // exacta en los 27 productos revisados a mano (docs/precios-granel.md).
    if (precioKilo === null && r.precio_cuarto !== null && r.precio_cuarto > 0) {
      precioKilo = redondear(r.precio_cuarto * 4);
      kiloDeducido = true;
    }

    // Si vienen los dos, deben ser coherentes. Si no lo son, uno de los
    // dos se leyó mal y hay que mirarlo -- no se elige por el sistema.
    const cuartoCuadra = r.precio_cuarto !== null && precioKilo !== null && !kiloDeducido
      ? Math.abs(precioKilo / 4 - r.precio_cuarto) <= TOLERANCIA_PESOS
      : null;

    // El precio por 100 g NO se puede derivar del kilo: es una tarifa
    // independiente y más cara por gramo (docs/precios-granel.md). Si no
    // viene en la hoja, tiene que capturarlo una persona.
    return {
      ...r,
      indice,
      precio_kilo: precioKilo,
      kilo_deducido: kiloDeducido,
      cuarto_cuadra: cuartoCuadra,
      requiere_revision: r.ilegible ||
        cuartoCuadra === false ||
        precioKilo === null ||
        precioKilo <= 0 ||
        r.precio_100g === null ||
        r.precio_100g <= 0,
    };
  });

  return {
    renglones,
    renglones_por_revisar: renglones.filter((r) => r.requiere_revision).length,
    // Señal barata de que la foto salió mal o la hoja no era una hoja de
    // precios: conviene decirlo antes de que la persona revise 40 renglones.
    sin_precio_legible: renglones.filter(
      (r) => r.precio_kilo === null && r.precio_100g === null,
    ).length,
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ message: "Method not allowed" }, { status: 405 });
    }

    // Cambiar precios de venta es de las operaciones más sensibles del
    // sistema: mismo alcance que editar el catálogo (CLAUDE.md §6).
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
        { message: "Solo un propietario o administrador puede cargar precios" },
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
        { message: error instanceof Error ? error.message : "Error al leer la hoja" },
        { status: 502 },
      );
    }

    return Response.json({
      extraccion: resultado.extraccion,
      modelo: resultado.modelo,
      verificacion: verificar(resultado.extraccion),
    });
  }),
};
