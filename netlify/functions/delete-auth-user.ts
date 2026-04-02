import { createClient } from "@supabase/supabase-js";
import type { Handler } from "@netlify/functions";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!supabaseAdmin) {
    return { statusCode: 503, body: JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor" }) };
  }

  const authHeader = event.headers["authorization"] || event.headers["Authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: "Não autorizado" }) };
  }

  // Validate token and get caller identity
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    return { statusCode: 401, body: JSON.stringify({ error: "Token inválido" }) };
  }

  let body: { userId?: string };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Body inválido" }) };
  }

  if (!body.userId || body.userId !== userData.user.id) {
    return { statusCode: 403, body: JSON.stringify({ error: "Proibido: userId não corresponde ao token" }) };
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(body.userId);
  if (error) {
    console.error("[delete-auth-user] Error:", error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
