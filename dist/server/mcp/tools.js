const MAX_MCP_TOOLS = 24;
export function parseMcpSettings(settings) {
    if (!settings || typeof settings !== "object")
        return [];
    const servers = settings.servers;
    if (!servers || typeof servers !== "object" || Array.isArray(servers))
        return [];
    const out = [];
    for (const [name, rawServer] of Object.entries(servers)) {
        const parsed = parseServerConfig(name, rawServer);
        if (parsed)
            out.push(parsed);
    }
    return out;
}
export function resolveEnabledMcpTools(params) {
    const servers = parseMcpSettings(params.settings);
    const tools = [];
    for (const server of servers) {
        if (server.add_to_agents?.length && !server.add_to_agents.includes(params.agent))
            continue;
        const metadataTools = readMetadataTools(server);
        const enabled = new Set(server.enabled_tools ?? metadataTools.map((tool) => tool.name));
        for (const tool of metadataTools) {
            if (!enabled.has(tool.name))
                continue;
            tools.push({
                ...tool,
                serverName: server.name,
                toolName: tool.name,
                openAiName: toOpenAiToolName(server.name, tool.name),
                config: server,
            });
            if (tools.length >= MAX_MCP_TOOLS)
                return tools;
        }
    }
    return tools;
}
export function mcpToolsToOpenAiTools(tools) {
    return tools.map((tool) => ({
        type: "function",
        function: {
            name: tool.openAiName,
            description: [`MCP server: ${tool.serverName}. Tool: ${tool.toolName}.`, tool.description].filter(Boolean).join(" "),
            parameters: normalizeParameters(tool.inputSchema),
        },
    }));
}
export function formatMcpToolsForPrompt(tools) {
    if (!tools.length)
        return "";
    return [
        "Available MCP tools for this researcher turn:",
        ...tools.map((tool) => `- ${tool.openAiName}: ${tool.description || tool.toolName} (server=${tool.serverName}, tool=${tool.toolName})`),
        "Use MCP tools only when they can provide evidence or context relevant to the research question.",
    ].join("\n");
}
function parseServerConfig(name, raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return null;
    const value = raw;
    const transport = value.transport;
    const enabled_tools = readStringArray(value.enabled_tools);
    const add_to_agents = readStringArray(value.add_to_agents);
    if (transport === "stdio" && typeof value.command === "string") {
        const config = {
            name,
            transport,
            command: value.command,
            ...(enabled_tools ? { enabled_tools } : {}),
            ...(add_to_agents ? { add_to_agents } : {}),
        };
        const args = readStringArray(value.args);
        const env = readStringRecord(value.env);
        const tools = readMetadataTools(value);
        if (args)
            config.args = args;
        if (env)
            config.env = env;
        if (tools.length)
            config.tools = tools;
        return config;
    }
    if ((transport === "sse" || transport === "streamable_http") && typeof value.url === "string") {
        const config = {
            name,
            transport,
            url: value.url,
            ...(enabled_tools ? { enabled_tools } : {}),
            ...(add_to_agents ? { add_to_agents } : {}),
        };
        const headers = readStringRecord(value.headers);
        const tools = readMetadataTools(value);
        if (headers)
            config.headers = headers;
        if (tools.length)
            config.tools = tools;
        return config;
    }
    return null;
}
function readMetadataTools(server) {
    const rawTools = server.tools;
    if (!Array.isArray(rawTools))
        return [];
    const out = [];
    for (const rawTool of rawTools) {
        if (!rawTool || typeof rawTool !== "object" || Array.isArray(rawTool))
            continue;
        const value = rawTool;
        if (typeof value.name !== "string")
            continue;
        out.push({
            name: value.name,
            description: typeof value.description === "string" ? value.description : "",
            inputSchema: normalizeParameters(value.inputSchema),
        });
    }
    return out;
}
function normalizeParameters(schema) {
    if (!schema || typeof schema !== "object" || Array.isArray(schema))
        return { type: "object", properties: {} };
    const value = schema;
    return { type: "object", ...value };
}
function toOpenAiToolName(serverName, toolName) {
    const normalized = `mcp_${serverName}_${toolName}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    return normalized.slice(0, 64);
}
function readStringArray(value) {
    if (!Array.isArray(value))
        return undefined;
    const strings = value.filter((item) => typeof item === "string" && item.trim().length > 0);
    return strings.length ? strings : undefined;
}
function readStringRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;
    const entries = Object.entries(value).filter((entry) => typeof entry[1] === "string");
    return entries.length ? Object.fromEntries(entries) : undefined;
}
