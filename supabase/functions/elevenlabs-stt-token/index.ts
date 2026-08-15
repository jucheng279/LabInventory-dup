import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const elevenlabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");

    if (!elevenlabsApiKey) {
      return new Response(
        JSON.stringify({ error: "Speech-to-text not configured. Please add ELEVENLABS_API_KEY secret." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: teamMember, error: tmError } = await supabase
      .from("team_members")
      .select("id, workspace_id")
      .eq("auth_user_id", user.id)
      .not("workspace_id", "is", null)
      .maybeSingle();

    if (tmError || !teamMember) {
      return new Response(
        JSON.stringify({ error: "No workspace membership found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const elevenLabsResponse = await fetch(
      "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenlabsApiKey,
        },
      }
    );

    if (!elevenLabsResponse.ok) {
      const errText = await elevenLabsResponse.text();
      console.error("ElevenLabs token error:", elevenLabsResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `Failed to generate STT token (${elevenLabsResponse.status})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await elevenLabsResponse.json();

    return new Response(
      JSON.stringify({ token: tokenData.token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("elevenlabs-stt-token error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
