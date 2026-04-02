import { RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials not configured for server auth");
}

// Create a server-side client with the anon key
// This client will be used to proxy auth requests from the browser
const supabase = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey || "", {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

// Admin client with service role key — only used for privileged operations
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

export const handleGetUser: RequestHandler = async (req, res) => {
  try {
    if (!supabase) {
      return res
        .status(503)
        .json({
          error: "Supabase not configured",
          user: null,
          fallback: true,
        });
    }

    // Get the access token from the request body or header
    const { accessToken } = req.body;
    const authHeader = req.headers.authorization;
    const token = accessToken || (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null);

    if (!token) {
      return res.status(200).json({ user: null });
    }

    try {
      // Verify the token by calling getUser
      const { data, error } = await supabase.auth.getUser(token);

      if (error) {
        console.warn("[auth/user] Token verification failed:", error.message);
        return res.status(200).json({ user: null });
      }

      return res.status(200).json({ user: data.user });
    } catch (fetchError) {
      console.error("[auth/user] Network error:", fetchError);
      // Return 200 with null user instead of 500, allowing client fallback
      return res.status(200).json({ user: null, networkError: true });
    }
  } catch (error) {
    console.error("[auth/user] Unexpected error:", error);
    res.status(200).json({ user: null });
  }
};

export const handleSignOut: RequestHandler = async (req, res) => {
  try {
    if (!supabase) {
      return res.status(200).json({ success: true });
    }

    // Get the access token from the request body
    const { accessToken } = req.body;

    if (accessToken) {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (error) {
        console.warn("[auth/sign-out] Error signing out:", error);
        // Continue anyway - signing out is best-effort
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[auth/sign-out] Unexpected error:", error);
    res.status(200).json({ success: true });
  }
};

export const handleDeleteAuthUser: RequestHandler = async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: "Supabase admin not configured" });
    }

    // Verify the caller is authenticated and matches the userId being deleted
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    // Validate the token and get the caller's id
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const { userId } = req.body;
    if (!userId || userId !== userData.user.id) {
      return res.status(403).json({ error: "Proibido: userId não corresponde ao token" });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[auth/delete-account] Error deleting auth user:", error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[auth/delete-account] Unexpected error:", error);
    res.status(500).json({ error: "Erro interno ao encerrar conta" });
  }
};

export const handleRefreshSession: RequestHandler = async (req, res) => {
  try {
    if (!supabase) {
      return res
        .status(200)
        .json({
          error: "Supabase not configured",
          session: null,
          fallback: true,
        });
    }

    // Get the refresh token from the request body
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(200).json({ session: null });
    }

    try {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        console.warn("[auth/refresh] Token refresh failed:", error.message);
        return res.status(200).json({ session: null });
      }

      return res.status(200).json({ session: data.session });
    } catch (fetchError) {
      console.error("[auth/refresh] Network error:", fetchError);
      return res.status(200).json({ session: null, networkError: true });
    }
  } catch (error) {
    console.error("[auth/refresh] Unexpected error:", error);
    res.status(200).json({ session: null });
  }
};
