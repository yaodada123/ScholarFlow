export type ChatEvent = {
  type: string;
  data: Record<string, unknown>;
};

export type ToolCall = {
  type: "tool_call";
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type ToolCallChunk = {
  type: "tool_call_chunk";
  index: number;
  id: string;
  name: string;
  args: string;
};
