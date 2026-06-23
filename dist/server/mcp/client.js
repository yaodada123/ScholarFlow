import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const CLIENT_INFO = { name: "scholarflow", version: "0.1.0" };
const MCP_REQUEST_TIMEOUT_MS = 20_000;
const MCP_CONNECT_TIMEOUT_MS = 15_000;
const MAX_RESULT_CHARS = 12_000;
function headersFromConfig(config) {
    if (config.transport === "stdio")
        return undefined;
    return config.headers && Object.keys(config.headers).length ? config.headers : undefined;
}
function createTransport(config) {
    if (config.transport === "stdio") {
        return new StdioClientTransport({
            command: config.command,
            stderr: "pipe",
            ...(config.args ? { args: config.args } : {}),
            ...(config.env ? { env: config.env } : {}),
        });
    }
    const headers = headersFromConfig(config);
    const requestInit = headers ? { headers } : undefined;
    if (config.transport === "sse") {
        return new SSEClientTransport(new URL(config.url), {
            ...(requestInit
                ? { requestInit, eventSourceInit: { fetch: (url, init) => fetch(url, { ...init, headers: { ...headers, ...init?.headers } }) } }
                : {}),
        });
    }
    return new StreamableHTTPClientTransport(new URL(config.url), {
        ...(requestInit ? { requestInit } : {}),
    });
}
async function withClient(config, fn) {
    const client = new Client(CLIENT_INFO, { capabilities: {} });
    const transport = createTransport(config);
    try {
        await client.connect(transport, { timeout: MCP_CONNECT_TIMEOUT_MS });
        return await fn(client);
    }
    finally {
        await client.close().catch(() => undefined);
    }
}
function asObjectSchema(schema) {
    if (!schema || typeof schema !== "object" || Array.isArray(schema))
        return { type: "object", properties: {} };
    return schema;
}
export async function listMcpServerTools(config) {
    return withClient(config, async (client) => {
        const listed = await client.listTools(undefined, { timeout: MCP_REQUEST_TIMEOUT_MS });
        return listed.tools.map((tool) => ({
            name: tool.name,
            description: tool.description ?? tool.title ?? "",
            inputSchema: asObjectSchema(tool.inputSchema),
        }));
    });
}
export async function callMcpTool(config, toolName, args) {
    return withClient(config, async (client) => {
        const result = await client.callTool({ name: toolName, arguments: args }, undefined, { timeout: MCP_REQUEST_TIMEOUT_MS, maxTotalTimeout: MCP_REQUEST_TIMEOUT_MS });
        return serializeToolResult(result);
    });
}
function serializeToolResult(result) {
    if (!result || typeof result !== "object")
        return { content: stringifyLimited(result) };
    const raw = result;
    const isError = raw.isError === true;
    if ("structuredContent" in raw && raw.structuredContent != null) {
        return { content: stringifyLimited(raw.structuredContent), ...(isError ? { isError } : {}) };
    }
    if (Array.isArray(raw.content)) {
        const parts = raw.content.map((item) => serializeContentItem(item)).filter(Boolean);
        return { content: limitText(parts.join("\n\n") || stringifyLimited(raw.content)), ...(isError ? { isError } : {}) };
    }
    if ("toolResult" in raw) {
        return { content: stringifyLimited(raw.toolResult), ...(isError ? { isError } : {}) };
    }
    return { content: stringifyLimited(raw), ...(isError ? { isError } : {}) };
}
function serializeContentItem(item) {
    if (!item || typeof item !== "object")
        return stringifyLimited(item);
    const raw = item;
    if (raw.type === "text" && typeof raw.text === "string")
        return limitText(raw.text);
    if (raw.type === "image")
        return `[image: ${typeof raw.mimeType === "string" ? raw.mimeType : "unknown mime"}]`;
    if (raw.type === "audio")
        return `[audio: ${typeof raw.mimeType === "string" ? raw.mimeType : "unknown mime"}]`;
    if (raw.type === "resource" && raw.resource && typeof raw.resource === "object") {
        const resource = raw.resource;
        const uri = typeof resource.uri === "string" ? resource.uri : "resource";
        if (typeof resource.text === "string")
            return `Resource ${uri}:\n${limitText(resource.text)}`;
        return `Resource ${uri}: ${stringifyLimited(resource)}`;
    }
    if (raw.type === "resource_link") {
        const title = typeof raw.title === "string" ? raw.title : typeof raw.name === "string" ? raw.name : "resource";
        const uri = typeof raw.uri === "string" ? raw.uri : "";
        return `Resource link: ${title}${uri ? ` (${uri})` : ""}`;
    }
    return stringifyLimited(raw);
}
function stringifyLimited(value) {
    if (typeof value === "string")
        return limitText(value);
    try {
        return limitText(JSON.stringify(value, null, 2));
    }
    catch {
        return String(value);
    }
}
function limitText(text) {
    if (text.length <= MAX_RESULT_CHARS)
        return text;
    return `${text.slice(0, MAX_RESULT_CHARS)}\n...[truncated]`;
}
