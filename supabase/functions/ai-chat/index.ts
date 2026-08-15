import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ToolContext {
  supabase: SupabaseClient;
  serviceClient: SupabaseClient;
  teamMemberId: string;
  workspaceId: string;
  requestId: string;
}

interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateString(val: unknown, maxLen: number): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  return trimmed.length > 0 && trimmed.length <= maxLen ? trimmed : null;
}

function validateInt(val: unknown, min: number, max: number, def: number): number {
  if (val === null || val === undefined) return def;
  const n = typeof val === "number" ? val : parseInt(String(val), 10);
  if (isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function validateBool(val: unknown, def: boolean): boolean {
  return typeof val === "boolean" ? val : def;
}

function validateStringArray(val: unknown, allowed: string[]): string[] {
  if (!Array.isArray(val)) return allowed;
  return val.filter((v) => typeof v === "string" && allowed.includes(v));
}

function validateRefCode(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const v = val.trim().toUpperCase();
  if (/^[LSPB]\d+$/.test(v)) return v;
  if (/^I\d+$/.test(v)) return v;
  if (/^IF\d+$/.test(v)) return v;
  if (/^PR\d+$/.test(v)) return v;
  if (/^EX\d+$/.test(v)) return v;
  if (/^B\d+:[A-Z]+\d+$/.test(v)) return v;
  return null;
}

function validateRefCodeArray(val: unknown, maxLen: number): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((v) => validateRefCode(v)).filter((v): v is string => v !== null).slice(0, maxLen);
}

function validateIsoDate(val: unknown): string | null {
  if (typeof val !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(val)) return null;
  return isNaN(new Date(val).getTime()) ? null : val;
}

// ─── Location Code Resolution ────────────────────────────────────────────────

async function resolveLocationCode(val: unknown, ctx: ToolContext): Promise<string | null> {
  if (typeof val !== "string" || !val.trim()) return null;
  const code = val.trim().toUpperCase();
  if (!/^L\d+$/.test(code)) return null;
  const { data } = await ctx.serviceClient.rpc("ai_resolve_ref_to_uuid", {
    p_workspace_id: ctx.workspaceId,
    p_ref: code,
  });
  return data || null;
}

// ─── Code Extraction from Tool Results ───────────────────────────────────────

const CODE_EXTRACT_RE = /\b((?:PR|EX|IF|[LSPBI])\d+)\b/g;
const CELL_REF_RE = /\bB\d+:[A-Z]+\d+\b/g;
const NAV_LINK_CODE_PATH_RE = /\{\{nav:([^|]+)\|/g;

function extractCodesFromResult(result: unknown, codes: Set<string>) {
  const json = JSON.stringify(result);
  let m: RegExpExecArray | null;
  CODE_EXTRACT_RE.lastIndex = 0;
  while ((m = CODE_EXTRACT_RE.exec(json)) !== null) codes.add(m[1]);
  CELL_REF_RE.lastIndex = 0;
  while ((m = CELL_REF_RE.exec(json)) !== null) codes.add(m[0]);
  // Extract box_code fields explicitly (e.g. "box_code":"B7")
  const BOX_CODE_FIELD_RE = /"box_code"\s*:\s*"(B\d+)"/g;
  BOX_CODE_FIELD_RE.lastIndex = 0;
  while ((m = BOX_CODE_FIELD_RE.exec(json)) !== null) codes.add(m[1]);
}

function extractCodesFromNavLinks(text: string, codes: Set<string>) {
  let m: RegExpExecArray | null;
  NAV_LINK_CODE_PATH_RE.lastIndex = 0;
  while ((m = NAV_LINK_CODE_PATH_RE.exec(text)) !== null) {
    const codePath = m[1];
    const colonIdx = codePath.lastIndexOf(':');
    let pathPart = codePath;
    let cellCoord = '';
    if (colonIdx > 0) {
      const afterColon = codePath.slice(colonIdx + 1);
      if (/^[A-Z]+\d+$/i.test(afterColon)) {
        cellCoord = afterColon;
        pathPart = codePath.slice(0, colonIdx);
      }
    }
    const segments = pathPart.split('.').filter(Boolean);
    for (const seg of segments) codes.add(seg);
    if (cellCoord) {
      // Find the box code in segments (any B-prefixed segment)
      const boxSeg = segments.find(s => /^B\d+$/i.test(s));
      if (boxSeg) {
        codes.add(`${boxSeg}:${cellCoord}`);
      } else {
        // No box code in path but cell coord present (e.g. {{nav:L1:D4|D4}})
        // Try to pair with any already-collected B-codes to form cell refs
        for (const existing of [...codes]) {
          if (/^B\d+$/i.test(existing)) {
            codes.add(`${existing}:${cellCoord}`);
          }
        }
      }
    }
  }
}

// ─── Web Search (Tavily) ─────────────────────────────────────────────────────

const WEB_SEARCH_MAX_PER_REQUEST = 3;
const webSearchCounts = new Map<string, number>();

async function executeWebSearch(args: Record<string, unknown>, ctx: ToolContext) {
  const query = validateString(args.query, 400);
  if (!query) return { ok: false, error: "query is required (1-400 chars)" };

  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  if (!tavilyKey) return { ok: false, error: "Web search is not configured. Ask your admin to add the TAVILY_API_KEY secret." };

  const count = webSearchCounts.get(ctx.requestId) || 0;
  if (count >= WEB_SEARCH_MAX_PER_REQUEST) {
    return { ok: false, error: `Web search limit reached (max ${WEB_SEARCH_MAX_PER_REQUEST} per conversation turn). Please refine your question.` };
  }
  webSearchCounts.set(ctx.requestId, count + 1);

  const searchDepth = args.search_depth === "advanced" ? "advanced" : "basic";
  const maxResults = validateInt(args.max_results, 1, 10, 5);
  const topic = args.topic === "news" ? "news" : "general";

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: searchDepth,
        max_results: maxResults,
        topic,
        include_answer: true,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Tavily API error:", response.status, errText);
      return { ok: false, error: "Web search request failed" };
    }

    const data = await response.json();
    const results = (data.results || []).map((r: Record<string, unknown>) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    }));

    return {
      ok: true,
      answer: data.answer || null,
      results,
      source: "web_search",
    };
  } catch (err) {
    console.error("Tavily fetch error:", err);
    return { ok: false, error: "Web search failed due to a network error" };
  }
}

// ─── Tool Implementations ─────────────────────────────────────────────────────

async function executeSearchInventory(args: Record<string, unknown>, ctx: ToolContext) {
  const query = validateString(args.query, 200);
  if (!query) return { ok: false, error: "query is required (1-200 chars)" };
  const entityTypes = validateStringArray(args.entity_types, ["cell", "item", "box"]);
  const locationId = await resolveLocationCode(args.location_id, ctx);
  const includeCrossed = validateBool(args.include_crossed, false);
  const onlyAvailable = validateBool(args.only_available, false);
  const limit = validateInt(args.limit, 1, 100, 20);

  const { data, error } = await ctx.supabase.rpc("ai_search_inventory", {
    p_team_member_id: ctx.teamMemberId, p_query: query, p_entity_types: entityTypes,
    p_location_id: locationId, p_include_crossed: includeCrossed,
    p_only_available: onlyAvailable, p_limit: limit,
  });
  if (error) { console.error("search_inventory RPC error:", error.message); return { ok: false, error: "Failed to search inventory" }; }
  return data;
}

async function executeGetItemDetails(args: Record<string, unknown>, ctx: ToolContext) {
  const refCode = validateRefCode(args.ref_code);
  if (!refCode) return { ok: false, error: "ref_code is required (e.g. I5, B7:A1, B3)" };

  const { data, error } = await ctx.supabase.rpc("ai_get_item_details", {
    p_team_member_id: ctx.teamMemberId, p_ref_code: refCode,
  });
  if (error) { console.error("get_item_details RPC error:", error.message); return { ok: false, error: "Failed to get details" }; }
  return data;
}

async function executeGetItemLocations(args: Record<string, unknown>, ctx: ToolContext) {
  const refCodes = validateRefCodeArray(args.ref_codes, 20);
  if (refCodes.length === 0) return { ok: false, error: "ref_codes must contain at least one valid code" };

  const { data, error } = await ctx.supabase.rpc("ai_get_item_locations", {
    p_team_member_id: ctx.teamMemberId, p_ref_codes: refCodes,
  });
  if (error) { console.error("get_item_locations RPC error:", error.message); return { ok: false, error: "Failed to get locations" }; }
  return data;
}

async function executeListExpiringInventory(args: Record<string, unknown>, ctx: ToolContext) {
  const withinDays = validateInt(args.within_days, 0, 365, 30);
  const includeExpired = validateBool(args.include_expired, true);
  const locationId = await resolveLocationCode(args.location_id, ctx);
  const onlyAvailable = validateBool(args.only_available, false);
  const sort = ["expiration_ascending", "expiration_descending", "location", "name"].includes(args.sort as string)
    ? args.sort as string : "expiration_ascending";
  const limit = validateInt(args.limit, 1, 100, 50);

  const { data, error } = await ctx.supabase.rpc("ai_list_expiring_inventory", {
    p_team_member_id: ctx.teamMemberId, p_within_days: withinDays, p_include_expired: includeExpired,
    p_location_id: locationId, p_only_available: onlyAvailable, p_sort: sort, p_limit: limit,
  });
  if (error) { console.error("list_expiring_inventory RPC error:", error.message); return { ok: false, error: "Failed to list expiring inventory" }; }
  return data;
}

async function executeListLowStockItems(args: Record<string, unknown>, ctx: ToolContext) {
  const locationId = await resolveLocationCode(args.location_id, ctx);
  const includeOutOfStock = validateBool(args.include_out_of_stock, true);
  const limit = validateInt(args.limit, 1, 100, 50);

  const { data, error } = await ctx.supabase.rpc("ai_list_low_stock_items", {
    p_team_member_id: ctx.teamMemberId, p_location_id: locationId,
    p_include_out_of_stock: includeOutOfStock, p_limit: limit,
  });
  if (error) { console.error("list_low_stock_items RPC error:", error.message); return { ok: false, error: "Failed to list low stock items" }; }
  return data;
}

async function executeGetWorkspaceMemberStats(_args: Record<string, unknown>, ctx: ToolContext) {
  const { data, error } = await ctx.supabase.rpc("ai_get_workspace_member_stats", { p_team_member_id: ctx.teamMemberId });
  if (error) { console.error("get_workspace_member_stats RPC error:", error.message); return { ok: false, error: "Failed to get member statistics" }; }
  return data;
}

async function executeGetWorkspaceInventoryStats(args: Record<string, unknown>, ctx: ToolContext) {
  const locationId = await resolveLocationCode(args.location_id, ctx);
  const { data, error } = await ctx.supabase.rpc("ai_get_workspace_inventory_stats", {
    p_team_member_id: ctx.teamMemberId, p_location_id: locationId,
  });
  if (error) { console.error("get_workspace_inventory_stats RPC error:", error.message); return { ok: false, error: "Failed to get inventory statistics" }; }
  return data;
}

async function executeGetInventoryActivity(args: Record<string, unknown>, ctx: ToolContext) {
  const dateFrom = validateIsoDate(args.date_from) || new Date(Date.now() - 7 * 86400000).toISOString();
  const dateTo = validateIsoDate(args.date_to) || new Date().toISOString();
  const locationId = await resolveLocationCode(args.location_id, ctx);
  const limit = validateInt(args.limit, 1, 50, 30);

  const { data, error } = await ctx.supabase.rpc("ai_get_inventory_activity", {
    p_team_member_id: ctx.teamMemberId, p_date_from: dateFrom, p_date_to: dateTo,
    p_location_id: locationId, p_limit: limit,
  });
  if (error) { console.error("get_inventory_activity RPC error:", error.message); return { ok: false, error: "Failed to get inventory activity" }; }
  return data;
}

async function executeGetInventoryRiskSummary(args: Record<string, unknown>, ctx: ToolContext) {
  const expirationWindowDays = validateInt(args.expiration_window_days, 1, 365, 30);
  const activityWindowDays = validateInt(args.activity_window_days, 1, 365, 7);
  const { data, error } = await ctx.supabase.rpc("ai_get_inventory_risk_summary", {
    p_team_member_id: ctx.teamMemberId, p_expiration_window_days: expirationWindowDays,
    p_activity_window_days: activityWindowDays,
  });
  if (error) { console.error("get_inventory_risk_summary RPC error:", error.message); return { ok: false, error: "Failed to get risk summary" }; }
  return data;
}

async function executeListProjects(_args: Record<string, unknown>, ctx: ToolContext) {
  const { data, error } = await ctx.supabase.rpc("ai_list_projects", { p_team_member_id: ctx.teamMemberId });
  if (error) { console.error("list_projects RPC error:", error.message); return { ok: false, error: "Failed to list projects" }; }
  return data;
}

async function executeGetProjectContents(args: Record<string, unknown>, ctx: ToolContext) {
  const projectCode = validateRefCode(args.project_code);
  if (!projectCode) return { ok: false, error: "project_code is required (e.g. PR1)" };
  const experimentCode = args.experiment_code ? validateRefCode(args.experiment_code) : null;

  const { data, error } = await ctx.supabase.rpc("ai_get_project_contents", {
    p_team_member_id: ctx.teamMemberId, p_project_code: projectCode,
    p_experiment_code: experimentCode,
  });
  if (error) { console.error("get_project_contents RPC error:", error.message); return { ok: false, error: "Failed to get project contents" }; }
  return data;
}

// ─── Tool Registry ────────────────────────────────────────────────────────────

const TOOL_REGISTRY: ToolDefinition[] = [
  {
    name: "search_inventory",
    description: "Search the workspace inventory by name, note, or information. Finds cells (samples in box grids), inventory items (tracked reagents/supplies), and boxes (storage containers).",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text (name, note, or info). Max 200 chars." },
        entity_types: { type: "array", items: { type: "string", enum: ["cell", "item", "box"] }, description: "Which types to search. Defaults to all." },
        location_id: { type: ["string", "null"], description: "Optional location code (e.g. 'L3') to scope search." },
        include_crossed: { type: "boolean", description: "Include crossed-out cells. Default false." },
        only_available: { type: "boolean", description: "Only items with stock > 0. Default false." },
        limit: { type: "integer", description: "Max results (1-100). Default 20." },
      },
      required: ["query"],
    },
    execute: executeSearchInventory,
  },
  {
    name: "get_item_details",
    description: "Get full details for a specific entity by its ref code. Accepts cell refs (B7:A1), item codes (I5), or box codes (B3). Returns complete info including custom fields, expiration, and location.",
    input_schema: {
      type: "object",
      properties: {
        ref_code: { type: "string", description: "The entity ref code from search results: cell ref like 'B7:A1', item code like 'I5', or box code like 'B3'." },
      },
      required: ["ref_code"],
    },
    execute: executeGetItemDetails,
  },
  {
    name: "get_item_locations",
    description: "Get the full storage location path for one or more items or cells by their ref codes.",
    input_schema: {
      type: "object",
      properties: {
        ref_codes: { type: "array", items: { type: "string" }, description: "Array of ref codes (e.g. ['I5','I12','B7:A1']). Max 20." },
      },
      required: ["ref_codes"],
    },
    execute: executeGetItemLocations,
  },
  {
    name: "list_expiring_inventory",
    description: "Find expired or expiring inventory within a time window. Returns cells and items with expiration dates.",
    input_schema: {
      type: "object",
      properties: {
        within_days: { type: "integer", description: "Days from today (0-365). Default 30." },
        include_expired: { type: "boolean", description: "Include already-expired. Default true." },
        location_id: { type: ["string", "null"], description: "Optional location code (e.g. 'L3')." },
        only_available: { type: "boolean", description: "Exclude depleted/crossed. Default false." },
        sort: { type: "string", enum: ["expiration_ascending", "expiration_descending", "location", "name"] },
        limit: { type: "integer", description: "Max results (1-100). Default 50." },
      },
      required: [],
    },
    execute: executeListExpiringInventory,
  },
  {
    name: "list_low_stock_items",
    description: "Find items at or below their stock threshold, sorted by severity.",
    input_schema: {
      type: "object",
      properties: {
        location_id: { type: ["string", "null"], description: "Optional location code (e.g. 'L3')." },
        include_out_of_stock: { type: "boolean", description: "Include zero-stock items. Default true." },
        limit: { type: "integer", description: "Max results (1-100). Default 50." },
      },
      required: [],
    },
    execute: executeListLowStockItems,
  },
  {
    name: "get_workspace_member_statistics",
    description: "Get team membership stats: active members, pending invitations, role breakdown.",
    input_schema: { type: "object", properties: {}, required: [] },
    execute: executeGetWorkspaceMemberStats,
  },
  {
    name: "get_workspace_inventory_statistics",
    description: "Get high-level inventory metrics: total locations, boxes, items, expired/expiring/low stock counts.",
    input_schema: {
      type: "object",
      properties: {
        location_id: { type: ["string", "null"], description: "Optional location code to scope stats." },
      },
      required: [],
    },
    execute: executeGetWorkspaceInventoryStats,
  },
  {
    name: "get_inventory_activity",
    description: "Get recent inventory activity (edits, moves, clears, copies) within a date range.",
    input_schema: {
      type: "object",
      properties: {
        date_from: { type: ["string", "null"], description: "Start date ISO. Default: 7 days ago." },
        date_to: { type: ["string", "null"], description: "End date ISO. Default: now." },
        location_id: { type: ["string", "null"], description: "Optional location code." },
        limit: { type: "integer", description: "Max events (1-50). Default 30." },
      },
      required: [],
    },
    execute: executeGetInventoryActivity,
  },
  {
    name: "get_inventory_risk_summary",
    description: "Get aggregated workspace risk/health: expirations, stock alerts, data quality, activity volume, team size.",
    input_schema: {
      type: "object",
      properties: {
        expiration_window_days: { type: "integer", description: "Days ahead for expirations (1-365). Default 30." },
        activity_window_days: { type: "integer", description: "Days of activity (1-365). Default 7." },
      },
      required: [],
    },
    execute: executeGetInventoryRiskSummary,
  },
  {
    name: "list_projects",
    description: "List all projects with their experiments and linked item/box counts. Returns project codes (PR1, PR2) and experiment codes (EX1, EX2).",
    input_schema: { type: "object", properties: {}, required: [] },
    execute: executeListProjects,
  },
  {
    name: "get_project_contents",
    description: "Get a project's full contents: linked items, boxes, and cells grouped by experiment. Use project codes from list_projects.",
    input_schema: {
      type: "object",
      properties: {
        project_code: { type: "string", description: "Project code from list_projects (e.g. 'PR1')." },
        experiment_code: { type: ["string", "null"], description: "Optional experiment code to scope to one experiment (e.g. 'EX2')." },
      },
      required: ["project_code"],
    },
    execute: executeGetProjectContents,
  },
  {
    name: "web_search",
    description: "Search the internet for external knowledge — scientific literature, protocols, product comparisons, cell line properties, reagent specifications, general facts, etc. Use this when the user's question requires information beyond what is stored in their workspace inventory. Always try to follow up with an inventory search to connect web findings to what the user actually has.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query. Be specific and scientific when possible (e.g. 'best tumor cell lines for extracellular vesicle EV research')." },
        search_depth: { type: "string", enum: ["basic", "advanced"], description: "Use 'advanced' for complex scientific queries that need deeper results. Default 'basic'." },
        max_results: { type: "integer", description: "Number of results to return (1-10). Default 5." },
        topic: { type: "string", enum: ["general", "news"], description: "Use 'news' for recent developments, 'general' for everything else. Default 'general'." },
      },
      required: ["query"],
    },
    execute: executeWebSearch,
  },
];

// ─── Audit Logging ────────────────────────────────────────────────────────────

async function logToolCall(
  ctx: ToolContext, toolName: string, args: Record<string, unknown>,
  status: "success" | "error", resultCount: number, truncated: boolean,
  durationMs: number, errorCode?: string
) {
  try {
    await ctx.serviceClient.from("ai_tool_audit_log").insert({
      request_id: ctx.requestId, team_member_id: ctx.teamMemberId,
      workspace_id: ctx.workspaceId, tool_name: toolName, arguments: args,
      status, result_count: resultCount, truncated, duration_ms: durationMs,
      error_code: errorCode || null,
    });
  } catch (e) { console.error("Audit log write failed:", e); }
}

// ─── Tool Dispatcher ──────────────────────────────────────────────────────────

async function dispatchTool(toolName: string, args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const tool = TOOL_REGISTRY.find((t) => t.name === toolName);
  if (!tool) return { ok: false, error: `Unknown tool: ${toolName}` };
  const start = Date.now();
  try {
    const result = await tool.execute(args, ctx);
    const duration = Date.now() - start;
    const rc = (result as Record<string, unknown>)?.total_count as number || 0;
    const tr = (result as Record<string, unknown>)?.truncated === true;
    logToolCall(ctx, toolName, args, "success", rc, tr, duration);
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`Tool ${toolName} error:`, err);
    logToolCall(ctx, toolName, args, "error", 0, false, duration, "INTERNAL_ERROR");
    return { ok: false, error: "Tool execution failed" };
  }
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI inventory assistant for a laboratory workspace management system. You are READ-ONLY — you cannot create, modify, or delete any data.

Your Capabilities:
- Find items, cells, and boxes by name or note using the search tool
- Get detailed information about specific items or cells
- Show where things are stored with full location paths
- Report on expiring inventory (expired and soon-to-expire)
- Identify low-stock items that need reordering
- Summarize workspace statistics (locations, boxes, items, members)
- Report on recent inventory activity (edits, moves, etc.)
- Generate overall workspace health/risk summaries
- List all projects and their experiments
- Retrieve the full contents of a project (linked items, boxes, and cells inside those boxes, grouped by experiment)
- Generate materials lists, reagent summaries, or any formatted output from project data
- Search the web for external scientific knowledge, protocols, product info, and general facts

CRITICAL — Web Search Guidelines:
1. Use the web_search tool when a question requires knowledge beyond the workspace inventory (e.g. "which cell lines are good for EV research", "what is the recommended storage temperature for X", "best protocol for Y").
2. ALWAYS combine web findings with inventory data. After a web search, follow up with search_inventory to check if the user has any of the items or materials mentioned in the web results.
3. Clearly label the source of information. Preface web-sourced knowledge with phrases like "According to published research..." or "Based on external sources..." and inventory-sourced data with "In your inventory..." or "You currently have..."
4. NEVER send private inventory details (item names, locations, stock levels, custom fields) to the web search. Construct generic search queries based on the scientific concept, not the user's specific data.
5. You may use up to 3 web searches per conversation turn. Use them wisely — combine related questions into one well-crafted query rather than making multiple narrow searches.
6. When web results mention specific products, cell lines, reagents, or materials, search the inventory for those specific names to see if the user already has them.
7. If web search is unavailable or returns an error, inform the user and answer as best you can from your general knowledge and their inventory data.

Entity Codes:
Every entity has a short ref code that you MUST use to reference it:
- Locations: L1, L2, L3...
- Sublocations: S1, S2...
- Positions: P1, P2...
- Boxes: B1, B2...
- Item Sheets (folders): IF1, IF2...
- Inventory Items: I1, I2...
- Grid cells: B7:A1 (box code + cell coordinate)
- Projects: PR1, PR2...
- Experiments: EX1, EX2...

These codes appear in all tool results. Use them ONLY when calling follow-up tools and inside navigation link syntax. NEVER include raw reference codes (L1, S2, B7, I3, IF2, etc.) in your visible response text. Users do not understand these codes. Only show human-readable names.

IMPORTANT SECURITY RULE: NEVER output any UUID or internal database identifier. You do not have access to them. Only use the short codes listed above. If a user asks for an ID, UUID, or internal identifier, tell them you can only provide the short reference codes shown above.

Project Workflow:
When a user asks about a project (e.g. "what's in Project X", "materials list for my experiment"):
1. Call list_projects to find the project by name and get its code (PR1, PR2...).
2. Call get_project_contents with that code.
3. Format the data however the user requests.

CRITICAL — Thoroughness Rules (follow these strictly):
1. ALWAYS use tools to look up data before answering. Never guess inventory details.
2. Report EVERY match. If an item appears in multiple boxes or locations, list ALL of them. Never stop at the first match.
3. After finding search results, call get_item_details for matches to provide rich information (stock levels, expiration, custom fields, exact cell coordinates).
4. Provide full location paths when referencing where something is stored.
5. For cell coordinates, the format is letter+number (e.g., A1, B3) where the letter is the row.
6. Format suggested search terms between [[double brackets]] for the user to use in their search box.
7. When items have expiration dates, always mention the expiration status.
8. Be THOROUGH. Give the user the full picture. Anticipate follow-up questions.
9. Never claim you can modify data. You are read-only.
10. When presenting project contents, group by experiment if experiments exist.

CRITICAL — Synonym & Abbreviation Searching:
When a search returns zero or few results, try alternative names before saying something doesn't exist:
- IL-2 = IL2 = interleukin-2, TNF-alpha = TNF-α, Ab = antibody, mAb = monoclonal antibody
- FBS = fetal bovine serum, PBS = phosphate buffered saline, DMEM, RPMI
- Try full name if you searched abbreviation, and vice versa. Try with/without hyphens.

When you find a match through synonym searching, present it as: "I didn't find an exact match for [user's term], but I found **[actual name]** which is the same reagent."

CRITICAL — Go Deeper Pattern:
For every item you report on, proactively include:
- Full storage location path with navigation links, including the sheet name if the item belongs to one
- Stock level and whether it's low
- Expiration date and status
- Notable custom field values
- Cell coordinate if it's in a box grid

Formatting rules:
- Use plain text by default. Use **bold** for emphasis.
- Use bullet points (- item) for lists.
- Use numbered lists (1. item) only for sequential steps.
- Do NOT use markdown headers (# or ##). Use **bold text** on its own line for section labels.
- Do NOT use code blocks or triple backticks.
- Keep responses well-organized and scannable.

CRITICAL — Navigable Links:
When referencing locations, sublocations, positions, boxes, item sheets, or grid cells, wrap them in this syntax to make them clickable:
{{nav:CODE_PATH|Display Text}}

The CODE_PATH uses dot-separated codes from the location breadcrumb path array:
- Locations: L1, L2...  Sublocations: S1, S2...  Positions: P1, P2...  Boxes: B1, B2...
- Item Sheets: IF1, IF2... (these are folders that contain inventory items)
- Items: I1, I2... (individual items inside a sheet)
- Cells: append colon + coordinate to the box path, e.g. L1.B7:A1

Build CODE_PATH by joining breadcrumb codes with dots. The location.path array in tool results gives you the exact codes to use. Box and cell links MUST include the B-code. For cells, the B-code is the last segment before the colon+coordinate.

NEVER use markdown formatting (bold **, italic _, backticks \`) inside the Display Text of a nav link. Write {{nav:L1.IF3.I5|Taq Polymerase}}, NOT {{nav:L1.IF3.I5|**Taq Polymerase**}}. Markdown characters inside the link syntax will break the clickable rendering.

Examples: {{nav:L1|Lab Freezer}}, {{nav:L1.S2|Shelf 2}}, {{nav:L1.S2.P3.B7|Box 4}}, {{nav:L1.B7:A1|A1}}, {{nav:L1.IF3|Reagents Sheet}}, {{nav:L1.IF3.I5|Taq Polymerase}}

CRITICAL — Item and sheet navigation rules:
- Every inventory item name you mention MUST be a clickable nav link. Use the item's code (I-code) and its folder_code (IF-code) from the tool results to build the path. Example: if an item has code I5, folder_code IF3, and location path [L1, S2], write its name as {{nav:L1.S2.IF3.I5|Taq Polymerase}}. Clicking this opens the sheet and scrolls to the item.
- When showing an item's storage location, ALWAYS include the sheet name as a clickable link in the breadcrumb path. Example: "stored in {{nav:L1|Lab Freezer}} > {{nav:L1.S2|Shelf 2}} > {{nav:L1.S2.IF3|Reagents}} > {{nav:L1.S2.IF3.I5|Taq Polymerase}}"
- The folder_code field (e.g. IF3) and folder_name field in tool results tell you the sheet's code and name. Use them. If an item has no folder_code, it has no sheet — just link the item name with its I-code.
- For sheets themselves, clicking opens the sheet view directly.

Each breadcrumb level and each cell coordinate should be its own link so users can click any level. But embed links naturally inline within your sentences — they render as simple clickable text, not buttons.

IMPORTANT — Do NOT let navigation links dictate how you organize your response:
- Write your answer the way you normally would — group related items, summarize, use tables or bullet lists, whatever is clearest.
- Weave navigation links into your prose naturally, like hyperlinks in a sentence.
- Do NOT give each navigable item its own section or row. If 6 cells in the same box all contain the same thing, say so in one sentence and list the cell links inline (e.g. "cells {{nav:...|A1}}, {{nav:...|B1}}, {{nav:...|C1}} all have 2×10⁶ cells").
- For location paths, write them inline: "in {{nav:L1|Lab Freezer}} > {{nav:L1.S2|Shelf 2}} > {{nav:L1.S2.IF3|Reagents Sheet}}"
- Always use codes from tool results. Never invent codes.`;

// ─── Main Handler ─────────────────────────────────────────────────────────────

function extractSuggestedTerms(reply: string): string[] {
  const matches = reply.match(/\[\[([^\]]+)\]\]/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicApiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: teamMember, error: tmError } = await serviceClient
      .from("team_members").select("id, workspace_id, role")
      .eq("auth_user_id", user.id).not("workspace_id", "is", null).maybeSingle();
    if (tmError || !teamMember) {
      return new Response(JSON.stringify({ error: "No workspace membership found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { message, conversationHistory } = await req.json();
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const requestId = crypto.randomUUID();
    const toolContext: ToolContext = {
      supabase: userClient, serviceClient, teamMemberId: teamMember.id,
      workspaceId: teamMember.workspace_id, requestId,
    };

    const claudeTools = TOOL_REGISTRY.map((t) => ({
      name: t.name, description: t.description, input_schema: t.input_schema,
    }));

    const messages: Array<{ role: string; content: unknown }> = [];
    if (Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }
    messages.push({ role: "user", content: message });

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const sendEvent = (data: Record<string, unknown>) =>
      writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

    (async () => {
      try {
        await sendEvent({ phase: "thinking" });
        const MAX_ROUNDS = 10;
        let currentMessages = [...messages];
        let finalText = "";
        let toolsUsed: string[] = [];
        let round = 0;
        const collectedCodes = new Set<string>();

        while (round < MAX_ROUNDS) {
          round++;
          const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": anthropicApiKey, "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-5-20250929", system: SYSTEM_PROMPT,
              messages: currentMessages, tools: claudeTools,
              max_tokens: 4096, temperature: 0.3, stream: true,
            }),
          });

          if (!anthropicResponse.ok) {
            const errBody = await anthropicResponse.text();
            console.error("Anthropic error:", anthropicResponse.status, errBody);
            await sendEvent({ error: "AI request failed" });
            await writer.close();
            return;
          }

          const streamReader = anthropicResponse.body!.getReader();
          const streamDecoder = new TextDecoder();
          let streamBuffer = "";
          let responseText = "";
          const toolUseBlocks: Array<{ id: string; name: string; input: string }> = [];
          let currentToolIndex = -1;
          let stopReason = "";

          while (true) {
            const { done, value } = await streamReader.read();
            if (done) break;
            streamBuffer += streamDecoder.decode(value, { stream: true });
            const lines = streamBuffer.split("\n");
            streamBuffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const eventData = line.slice(6).trim();
              if (!eventData || eventData === "[DONE]") continue;
              try {
                const event = JSON.parse(eventData);
                switch (event.type) {
                  case "content_block_start": {
                    const block = event.content_block;
                    if (block.type === "tool_use") {
                      currentToolIndex = toolUseBlocks.length;
                      toolUseBlocks.push({ id: block.id, name: block.name, input: "" });
                    }
                    break;
                  }
                  case "content_block_delta": {
                    const delta = event.delta;
                    if (delta.type === "text_delta") {
                      responseText += delta.text;
                    } else if (delta.type === "input_json_delta" && currentToolIndex >= 0) {
                      toolUseBlocks[currentToolIndex].input += delta.partial_json;
                    }
                    break;
                  }
                  case "message_delta": {
                    if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
                    break;
                  }
                }
              } catch { /* skip malformed */ }
            }
          }

          if (stopReason === "end_turn" || toolUseBlocks.length === 0) {
            finalText = responseText;
            await sendEvent({ phase: "answering" });
            const words = finalText.split(/(\s+)/);
            for (let i = 0; i < words.length; i++) {
              await sendEvent({ text: words[i] });
              if (i % 3 === 2) await new Promise(r => setTimeout(r, 15));
            }
            break;
          }

          if (responseText.trim()) await sendEvent({ thinking_step: responseText.trim() });

          const contentBlocks: Array<Record<string, unknown>> = [];
          if (responseText) contentBlocks.push({ type: "text", text: responseText });
          for (const tb of toolUseBlocks) {
            let parsedInput = {};
            try { parsedInput = JSON.parse(tb.input || "{}"); } catch { /* empty */ }
            contentBlocks.push({ type: "tool_use", id: tb.id, name: tb.name, input: parsedInput });
          }
          currentMessages.push({ role: "assistant", content: contentBlocks });
          const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];

          for (const toolCall of toolUseBlocks) {
            toolsUsed.push(toolCall.name);
            await sendEvent({ phase: "tool", tool: toolCall.name });
            let parsedInput: Record<string, unknown> = {};
            try { parsedInput = JSON.parse(toolCall.input || "{}"); } catch { /* empty */ }
            const toolResult = await dispatchTool(toolCall.name, parsedInput, toolContext);
            extractCodesFromResult(toolResult, collectedCodes);
            toolResults.push({ type: "tool_result", tool_use_id: toolCall.id, content: JSON.stringify(toolResult) });
          }

          await sendEvent({ phase: "thinking" });
          currentMessages.push({ role: "user", content: toolResults });
        }

        if (!finalText && round >= MAX_ROUNDS) {
          finalText = "I was unable to complete the analysis within the allowed steps. Please try a more specific question.";
          await sendEvent({ phase: "answering" });
          await sendEvent({ text: finalText });
        }

        // Extract codes referenced in the AI's final text (nav links like {{nav:L1.B7:A1|...}})
        if (finalText) {
          extractCodesFromResult(finalText, collectedCodes);
          extractCodesFromNavLinks(finalText, collectedCodes);
        }

        let codeMap: Record<string, unknown> = {};
        const codesArray = [...collectedCodes];
        console.log("[ai-chat] collected codes:", codesArray.join(", "));
        if (codesArray.length > 0) {
          const resolveOnce = async () => {
            const { data, error } = await serviceClient.rpc("ai_resolve_codes", {
              p_workspace_id: teamMember.workspace_id,
              p_codes: codesArray,
            });
            if (error) {
              console.error("[ai-chat] ai_resolve_codes RPC error:", JSON.stringify(error));
              return null;
            }
            return data;
          };
          try {
            let resolved = await resolveOnce();
            if (resolved === null) {
              console.log("[ai-chat] retrying ai_resolve_codes...");
              resolved = await resolveOnce();
            }
            if (resolved && typeof resolved === "object") {
              codeMap = resolved as Record<string, unknown>;
              console.log("[ai-chat] resolved codeMap keys:", Object.keys(codeMap).join(", "));
              for (const [k, v] of Object.entries(codeMap)) {
                const e = v as Record<string, unknown>;
                console.log(`  ${k}: type=${e.type}, uuid=${String(e.uuid || '').slice(0,8)}, box_id=${String(e.box_id || '').slice(0,8)}`);
              }
            } else {
              console.warn("[ai-chat] ai_resolve_codes returned empty after retry, codes:", codesArray.join(", "));
            }
          } catch (e) { console.error("[ai-chat] code resolution exception:", e); }
        }

        const suggestedTerms = extractSuggestedTerms(finalText);
        await sendEvent({ done: true, suggestedTerms, toolsUsed: [...new Set(toolsUsed)], codeMap });
        await writer.close();
      } catch (err) {
        console.error("Stream processing error:", err);
        try { await sendEvent({ error: (err as Error).message || "Internal error" }); await writer.close(); } catch { /* closed */ }
      } finally {
        webSearchCounts.delete(toolContext.requestId);
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (err) {
    console.error("ai-chat error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
