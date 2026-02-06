import { RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase credentials not configured for server auth");
}

const supabase = supabaseUrl
  ? createClient(supabaseUrl, supabaseServiceKey || "", {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export const handleGetUser: RequestHandler = async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    // Get the session from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.substring(7);

    // Verify the token and get user info
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error("[auth] Error getting user:", error);
      return res.status(401).json({ error: error.message });
    }

    return res.status(200).json({ user: data.user });
  } catch (error) {
    console.error("[auth] Unexpected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleSignOut: RequestHandler = async (req, res) => {
  try {
    // Sign out is handled on the client by clearing localStorage
    // This endpoint exists for consistency with the auth API
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[auth] Sign out error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
