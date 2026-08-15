import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M59,31H44.8157A2.9635,2.9635,0,0,0,45,30V13.8157A2.995,2.995,0,0,0,47,11V9a3.0033,3.0033,0,0,0-3-3H20a3.0033,3.0033,0,0,0-3,3v2a2.995,2.995,0,0,0,2,2.8157V30a2.966,2.966,0,0,0,.1843,1H5a3.0033,3.0033,0,0,0-3,3v2a2.995,2.995,0,0,0,2,2.8157V55a3.0033,3.0033,0,0,0,3,3H27a3.0033,3.0033,0,0,0,3-3V38.8157A2.995,2.995,0,0,0,32,36a2.995,2.995,0,0,0,2,2.8157V55a3.0033,3.0033,0,0,0,3,3H57a3.0033,3.0033,0,0,0,3-3V38.8157A2.995,2.995,0,0,0,62,36V34A3.0033,3.0033,0,0,0,59,31ZM19,9a1.0009,1.0009,0,0,1,1-1H44a1.0009,1.0009,0,0,1,1,1v2a1.0009,1.0009,0,0,1-1,1H20a1.0009,1.0009,0,0,1-1-1Zm2,21V14H43V30a1.0009,1.0009,0,0,1-1,1H22A1.0009,1.0009,0,0,1,21,30Zm7,25a1.0009,1.0009,0,0,1-1,1H7a1.0009,1.0009,0,0,1-1-1V39H28Zm2-19a1.0009,1.0009,0,0,1-1,1H5a1.0009,1.0009,0,0,1-1-1V34a1.0009,1.0009,0,0,1,1-1H29a1.0009,1.0009,0,0,1,1,1Zm1.8157-3h.3686A2.9635,2.9635,0,0,0,32,34,2.9635,2.9635,0,0,0,31.8157,33ZM58,55a1.0009,1.0009,0,0,1-1,1H37a1.0009,1.0009,0,0,1-1-1V39H58Zm2-19a1.0009,1.0009,0,0,1-1,1H35a1.0009,1.0009,0,0,1-1-1V34a1.0009,1.0009,0,0,1,1-1H59a1.0009,1.0009,0,0,1,1,1Z" fill="currentColor"/></svg>`;

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabase.storage
    .from("icons")
    .upload("other/stock.svg", new TextEncoder().encode(svgContent), {
      contentType: "image/svg+xml",
      upsert: true,
    });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, path: "other/stock.svg" }), {
    headers: { "Content-Type": "application/json" },
  });
});
