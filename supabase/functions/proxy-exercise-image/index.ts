import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { wgerId, imageUrl } = await req.json();

    if (!wgerId || !imageUrl) {
      return new Response(JSON.stringify({ error: "wgerId and imageUrl are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download image server-side (no CORS issues here)
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch image" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blob = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const ext = imageUrl.split(".").pop()?.split("?")[0] ?? "jpg";
    const path = `exercises/${wgerId}.${ext}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.storage
      .from("exercises")
      .upload(path, blob, { upsert: true, contentType });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data } = supabase.storage.from("exercises").getPublicUrl(path);

    return new Response(JSON.stringify({ publicUrl: data.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
