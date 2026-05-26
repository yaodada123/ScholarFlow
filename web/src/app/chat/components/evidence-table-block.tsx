import { ExternalLink } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import type { ToolCallRuntime } from "~/core/messages";
import { useStore } from "~/core/store";
import { parseJSON } from "~/core/utils";
import { cn } from "~/lib/utils";

type EvidenceRow = {
  id: string;
  sourceType: "resource" | "academic" | "web";
  title: string;
  uri: string;
  excerpt: string;
  toolName: string;
};

type RawEvidenceItem = {
  type?: string;
  id?: string;
  title?: string;
  url?: string;
  content?: string;
};

function sourceTypeForTool(toolName: string, itemType?: string): EvidenceRow["sourceType"] {
  if (toolName === "retrieve_resources" || itemType === "resource") return "resource";
  if (toolName === "academic_search") return "academic";
  return "web";
}

function normalizeEvidenceItem(toolCall: ToolCallRuntime, item: RawEvidenceItem, index: number): EvidenceRow | null {
  const title = item.title?.trim();
  const uri = (item.url ?? item.id ?? "").trim();
  const excerpt = item.content?.trim() ?? "";
  if (!title && !uri && !excerpt) return null;

  return {
    id: uri || `${toolCall.id}-${index}`,
    sourceType: sourceTypeForTool(toolCall.name, item.type),
    title: title || uri || `Evidence ${index + 1}`,
    uri,
    excerpt,
    toolName: toolCall.name,
  };
}

export function extractEvidenceRows(toolCalls: ToolCallRuntime[]): EvidenceRow[] {
  const rows: EvidenceRow[] = [];
  const seen = new Set<string>();

  for (const toolCall of toolCalls) {
    if (!toolCall.result) continue;
    if (!["retrieve_resources", "academic_search", "web_search"].includes(toolCall.name)) continue;

    const parsed = parseJSON<RawEvidenceItem[]>(toolCall.result, []);
    if (!Array.isArray(parsed)) continue;

    parsed.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const row = normalizeEvidenceItem(toolCall, item, index);
      if (!row) return;
      const key = row.uri || row.title.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(row);
    });
  }

  return rows;
}

export function EvidenceTableBlock({
  className,
  researchId,
}: {
  className?: string;
  researchId: string;
}) {
  const activityIds = useStore((state) => state.researchActivityIds.get(researchId) ?? []);
  const toolCalls = useStore((state) =>
    activityIds.flatMap((activityId) => state.messages.get(activityId)?.toolCalls ?? []),
  );
  const rows = useMemo(() => extractEvidenceRows(toolCalls), [toolCalls]);

  if (!rows.length) {
    return (
      <div className={cn("text-muted-foreground py-10 text-center text-sm", className)}>
        Evidence will appear here after resource retrieval or academic search finishes.
      </div>
    );
  }

  return (
    <div className={cn("py-4", className)}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Evidence table</h3>
        <p className="text-muted-foreground text-sm">
          Sources gathered during this research run, grouped from local resources, academic search, and web search.
        </p>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={row.sourceType === "resource" ? "secondary" : "outline"}>{row.sourceType}</Badge>
                  <Badge variant="outline">{row.toolName}</Badge>
                </div>
                <h4 className="mt-2 font-medium">{row.title}</h4>
              </div>
              {row.uri && row.uri.startsWith("http") && (
                <a
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  href={row.uri}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${row.title}`}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            {row.uri && !row.uri.startsWith("http") && (
              <div className="text-muted-foreground mt-2 truncate text-xs">{row.uri}</div>
            )}
            {row.excerpt && (
              <p className="text-muted-foreground mt-3 line-clamp-4 text-sm whitespace-pre-wrap">
                {row.excerpt}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
