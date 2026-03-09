#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { searchEverything } from "./everything.js";
import { SearchParams } from "./types.js";

const server = new Server(
  {
    name: "everything-search",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "everything_search",
        description: `Search for files and folders instantly using Everything (voidtools) indexed search.

Everything search syntax:
- Simple text: matches filename (e.g. "readme" finds all files with "readme" in the name)
- Wildcards: * and ? (e.g. "*.py" finds all Python files)
- Boolean: space = AND, | = OR, ! = NOT (e.g. "foo bar" finds files matching both)
- Quotes: "exact phrase" for literal matching
- ext: filter by extension (e.g. "ext:ts;js" for TypeScript and JavaScript files)
- path: match full path (e.g. "path:src ext:ts" for .ts files under any src folder)
- size: filter by size (e.g. "size:>10mb", "size:1kb..100kb")
- dm: date modified (e.g. "dm:today", "dm:lastweek", "dm:2024-01")
- dc: date created (e.g. "dc:thismonth")
- content: search file contents (e.g. "content:TODO ext:py" — requires content indexing enabled)
- parent: match parent folder (e.g. "parent:node_modules package.json")
- Regex: enable regex parameter for regex patterns

Examples:
- Find Python files: "ext:py"
- Find large files: "size:>100mb"
- Find recent downloads: "path:Downloads dm:thisweek"
- Find TypeScript in a project: "ext:ts path:my-project"
- Find by content: "content:import\\ React ext:tsx"`,
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Everything search query",
            },
            count: {
              type: "number",
              description: "Max results to return (default 50, max 1000)",
              default: 50,
            },
            offset: {
              type: "number",
              description: "Result offset for pagination (default 0)",
              default: 0,
            },
            sort: {
              type: "string",
              enum: ["name", "path", "size", "date_modified"],
              description: "Sort field (default: name)",
              default: "name",
            },
            ascending: {
              type: "boolean",
              description: "Sort ascending (default: true)",
              default: true,
            },
            regex: {
              type: "boolean",
              description: "Enable regex search mode (default: false)",
              default: false,
            },
            case_sensitive: {
              type: "boolean",
              description: "Case-sensitive matching (default: false)",
              default: false,
            },
            whole_word: {
              type: "boolean",
              description: "Match whole words only (default: false)",
              default: false,
            },
            match_path: {
              type: "boolean",
              description: "Match against full path instead of filename only (default: false)",
              default: false,
            },
            global: {
              type: "boolean",
              description: "Search the entire system instead of only the project folder. Default: false (searches are scoped to the project path). Set to true ONLY after confirming with the user that they want to search outside the project folder.",
              default: false,
            },
            project_path: {
              type: "string",
              description: "The project's working directory path. Used to auto-scope searches to the project folder. Should be set to the current working directory.",
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "everything_search") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const args = request.params.arguments as Record<string, unknown>;
  const params: SearchParams = {
    query: args.query as string,
    count: Math.min(Number(args.count ?? 50), 1000),
    offset: Number(args.offset ?? 0),
    sort: (args.sort as string) ?? "name",
    ascending: (args.ascending as boolean) ?? true,
    regex: (args.regex as boolean) ?? false,
    case_sensitive: (args.case_sensitive as boolean) ?? false,
    whole_word: (args.whole_word as boolean) ?? false,
    match_path: (args.match_path as boolean) ?? false,
    global: (args.global as boolean) ?? false,
    project_path: (args.project_path as string) ?? "",
  };

  try {
    const result = await searchEverything(params);
    return {
      content: [{ type: "text", text: result }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Everything MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
