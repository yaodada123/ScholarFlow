export type McpTransport = "stdio" | "sse" | "streamable_http";

export type McpStdioServerConfig = {
  name: string;
  transport: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  tools?: McpToolMetadata[];
  enabled_tools?: string[];
  add_to_agents?: string[];
};

export type McpHttpServerConfig = {
  name: string;
  transport: "sse" | "streamable_http";
  url: string;
  headers?: Record<string, string>;
  tools?: McpToolMetadata[];
  enabled_tools?: string[];
  add_to_agents?: string[];
};

export type McpServerConfig = McpStdioServerConfig | McpHttpServerConfig;

export type McpToolMetadata = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type McpServerMetadata = McpServerConfig & {
  tools: McpToolMetadata[];
};

export type McpResolvedTool = McpToolMetadata & {
  serverName: string;
  toolName: string;
  openAiName: string;
  config: McpServerConfig;
};

export type OpenAIChatTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export type McpToolCallResult = {
  content: string;
  isError?: boolean;
};
