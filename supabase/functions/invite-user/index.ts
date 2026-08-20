// Invita a un usuario nuevo (crea su login en Supabase Auth) y le
// asigna nombre/rol vía los metadatos que toma el trigger
// handle_new_user. Corre con la llave de servicio (ctx.supabaseAdmin),
// que nunca llega al navegador — solo existe dentro de esta función.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const VALID_ROLES = new Set([
  "owner",
  "local_admin",
  "cashier",
  "accountant",
  "viewer",
]);

interface InviteBody {
  email?: string;
  full_name?: string;
  role?: string;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ message: "Method not allowed" }, { status: 405 });
    }

    const callerId = ctx.userClaims!.id;
    const { data: callerProfile, error: profileError } = await ctx.supabase
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .single();

    if (profileError || !callerProfile) {
      return Response.json({ message: "No se pudo verificar tu perfil" }, { status: 403 });
    }

    const callerRole = callerProfile.role as string;
    if (callerRole !== "owner" && callerRole !== "local_admin") {
      return Response.json(
        { message: "Solo un propietario o administrador puede invitar usuarios" },
        { status: 403 },
      );
    }

    let body: InviteBody;
    try {
      body = await req.json();
    } catch {
      return Response.json({ message: "Cuerpo de la solicitud inválido" }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase();
    const fullName = body.full_name?.trim();
    const role = body.role;

    if (!email || !fullName || !role) {
      return Response.json(
        { message: "Faltan campos: email, full_name y role son requeridos" },
        { status: 400 },
      );
    }

    if (!VALID_ROLES.has(role)) {
      return Response.json({ message: `Rol inválido: ${role}` }, { status: 400 });
    }

    if (role === "owner" && callerRole !== "owner") {
      return Response.json(
        { message: "Solo un propietario puede invitar a otro propietario" },
        { status: 403 },
      );
    }

    const { data, error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, role },
    });

    if (error) {
      return Response.json({ message: error.message }, { status: 400 });
    }

    return Response.json({ user_id: data.user?.id });
  }),
};
