// Placeholder manual. En cuanto el proyecto de Supabase exista y esté
// enlazado (`supabase link --project-ref <ref>`), regenerar con:
//
//   pnpm --filter @sunname/web exec supabase gen types typescript --linked > src/lib/database.types.ts
//
// y borrar este placeholder. Mientras tanto da tipado laxo (no `any`
// desnudo) para que el cliente de Supabase compile sin mentir sobre
// la forma exacta de cada tabla.

type Row = Record<string, unknown>

export type Database = {
  public: {
    Tables: Record<string, { Row: Row; Insert: Row; Update: Row }>
    Views: Record<string, { Row: Row }>
    Functions: Record<string, { Args: Row; Returns: unknown }>
    Enums: Record<string, string>
  }
}
