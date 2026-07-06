function contentPreview(content) {
    if (typeof content !== "string")
        return {};
    return {
        content_length: content.length,
        content_preview: content.slice(0, 240),
    };
}
function summarizeToolResult(content) {
    if (typeof content !== "string")
        return { content };
    return {
        content_length: content.length,
        content_preview: content.slice(0, 500),
    };
}
export function recordChatEventAsTrace(params) {
    const { trace, currentSpanId, event } = params;
    const data = event.data;
    const agent = typeof data.agent === "string" ? data.agent : undefined;
    if (event.type === "tool_calls" && Array.isArray(data.tool_calls)) {
        for (const toolCall of data.tool_calls) {
            if (!toolCall || typeof toolCall !== "object")
                continue;
            const tc = toolCall;
            trace?.toolCallStarted({
                ...(currentSpanId ? { spanId: currentSpanId } : {}),
                toolCallId: tc.id,
                toolName: tc.name,
                input: tc.args,
                ...(agent ? { agent } : {}),
            });
        }
        return;
    }
    if (event.type === "tool_call_result") {
        const toolCallId = typeof data.tool_call_id === "string" ? data.tool_call_id : undefined;
        if (toolCallId) {
            trace?.toolCallEnded({
                ...(currentSpanId ? { spanId: currentSpanId } : {}),
                toolCallId,
                output: summarizeToolResult(data.content),
                ...(agent ? { agent } : {}),
            });
        }
        return;
    }
    if (event.type === "message_chunk") {
        trace?.message({
            ...(currentSpanId ? { spanId: currentSpanId } : {}),
            ...(agent ? { agent } : {}),
            metadata: {
                id: data.id,
                role: data.role,
                finish_reason: data.finish_reason,
                ...contentPreview(data.content),
                ...(typeof data.reasoning_content === "string"
                    ? { reasoning_content_length: data.reasoning_content.length }
                    : {}),
            },
        });
        return;
    }
    if (event.type === "interrupt") {
        trace?.interrupt({
            ...(currentSpanId ? { spanId: currentSpanId } : {}),
            ...(agent ? { agent } : {}),
            metadata: { id: data.id, options: data.options },
        });
    }
}
export function emitGraphEvent(params) {
    recordChatEventAsTrace({
        ...(params.trace ? { trace: params.trace } : {}),
        ...(params.currentSpanId ? { currentSpanId: params.currentSpanId } : {}),
        event: params.event,
    });
    params.config?.writer?.(params.event);
}
