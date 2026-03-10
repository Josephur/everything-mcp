import { EverythingResponse, SearchParams } from "./types.js";

const EVERYTHING_HOST = process.env.EVERYTHING_HOST || "localhost";
const EVERYTHING_PORT = process.env.EVERYTHING_PORT || "54321";
const PROJECT_PATH = process.env.PROJECT_PATH || "";
export const MAX_RESULTS = Math.max(1, Number(process.env.EVERYTHING_MAX_RESULTS) || 255);

const FILETIME_EPOCH_DIFF = 11644473600000n; // ms between 1601-01-01 and 1970-01-01
const FILETIME_TICKS_PER_MS = 10000n;

function filetimeToISO(filetime: string): string {
  const ft = BigInt(filetime);
  const ms = ft / FILETIME_TICKS_PER_MS - FILETIME_EPOCH_DIFF;
  return new Date(Number(ms)).toISOString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function formatSize(sizeStr: string): string {
  const size = Number(sizeStr);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export async function searchEverything(params: SearchParams): Promise<string> {
  const url = new URL(`http://${EVERYTHING_HOST}:${EVERYTHING_PORT}/`);

  // Use project_path from params, fall back to env var
  const projectPath = params.project_path || PROJECT_PATH;

  // Auto-scope to project path unless global search is explicitly requested
  let query = params.query;
  let globalWarning = "";
  if (projectPath && !params.global) {
    // Only add path scope if the query doesn't already contain a path: filter
    if (!/\bpath:/i.test(query)) {
      query = `path:"${projectPath}" ${query}`;
    }
  } else if (params.global) {
    globalWarning = `⚠️ GLOBAL SEARCH: Results may include files outside the project folder (${projectPath || "no project path set"}). You MUST ask the user for permission before accessing files or disk contents outside the project folder.\n\n`;
  }

  url.searchParams.set("search", query);
  url.searchParams.set("json", "1");
  url.searchParams.set("count", String(params.count));
  url.searchParams.set("offset", String(params.offset));
  url.searchParams.set("path_column", "1");
  url.searchParams.set("size_column", "1");
  url.searchParams.set("date_modified_column", "1");
  url.searchParams.set("sort", params.sort);
  url.searchParams.set("ascending", params.ascending ? "1" : "0");
  if (params.regex) url.searchParams.set("regex", "1");
  if (params.case_sensitive) url.searchParams.set("case", "1");
  if (params.whole_word) url.searchParams.set("wholeword", "1");
  // Enable path matching if explicitly requested or if we auto-scoped with path:
  if (params.match_path || (projectPath && !params.global && !/\bpath:/i.test(params.query))) {
    url.searchParams.set("path", "1");
  }

  let response: Response;
  const startTime = performance.now();
  try {
    response = await fetch(url.toString());
  } catch (error) {
    throw new Error(
      `Cannot connect to Everything HTTP server at ${EVERYTHING_HOST}:${EVERYTHING_PORT}. ` +
      `Make sure Everything is running and the HTTP server plugin is enabled ` +
      `(Tools > Options > HTTP Server > Enable HTTP Server).`
    );
  }

  if (!response.ok) {
    throw new Error(`Everything HTTP server returned ${response.status}: ${response.statusText}`);
  }

  const data: EverythingResponse = await response.json();
  const elapsed = performance.now() - startTime;
  const end = Math.min(params.offset + params.count, data.totalResults);

  const lines: string[] = [];
  lines.push(`Found ${data.totalResults} results (showing ${params.offset + 1}-${end}) in ${formatDuration(elapsed)}`);
  lines.push("");

  for (const r of data.results) {
    const fullPath = `${r.path}\\${r.name}`;
    const parts: string[] = [fullPath];

    if (r.type === "folder") {
      parts.push("[folder]");
    } else if (r.size !== undefined) {
      parts.push(formatSize(r.size));
    }

    if (r.date_modified) {
      parts.push(filetimeToISO(r.date_modified));
    }

    lines.push(parts.join("  "));
  }

  return globalWarning + lines.join("\n");
}
