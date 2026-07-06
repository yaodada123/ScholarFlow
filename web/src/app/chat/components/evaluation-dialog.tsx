// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import {
  BookOpen,
  FileText,
  Image,
  Link2,
  Loader2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  WandSparkles,
} from "lucide-react";
import { DIFF_DELETE, DIFF_INSERT, diffLinesRaw } from "jest-diff";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Progress } from "~/components/ui/progress";
import {
  evaluateReport,
  improveReport,
  type EvaluationResult,
  type ImproveReportResult,
} from "~/core/api";
import { cn } from "~/lib/utils";

type DialogLineDiff = {
  type: "added" | "removed" | "unchanged";
  text: string;
};

type ImprovementDetails = {
  previousEvaluation: EvaluationResult;
  result: ImproveReportResult;
  diff: DialogLineDiff[];
};

interface EvaluationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportContent: string;
  query: string;
  reportStyle?: string;
  onReportImproved?: (
    result: ImproveReportResult,
    previousEvaluation: EvaluationResult,
  ) => void;
}

function GradeBadge({ grade }: { grade: string }) {
  const gradeColors: Record<string, string> = {
    "A+": "bg-emerald-500",
    A: "bg-emerald-500",
    "A-": "bg-emerald-400",
    "B+": "bg-blue-500",
    B: "bg-blue-500",
    "B-": "bg-blue-400",
    "C+": "bg-yellow-500",
    C: "bg-yellow-500",
    "C-": "bg-yellow-400",
    D: "bg-orange-500",
    F: "bg-red-500",
  };

  return (
    <div
      aria-label={`Report grade: ${grade}`}
      className={cn(
        "flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white",
        gradeColors[grade] ?? "bg-gray-500",
      )}
    >
      {grade}
    </div>
  );
}

function MetricItem({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="text-muted-foreground h-4 w-4" />
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="ml-auto font-medium">
        {value}
        {suffix}
      </span>
    </div>
  );
}

function buildLineDiff(
  previousContent: string,
  nextContent: string,
): DialogLineDiff[] {
  return diffLinesRaw(previousContent.split("\n"), nextContent.split("\n")).map(
    (part) => ({
      type:
        part[0] === DIFF_INSERT
          ? "added"
          : part[0] === DIFF_DELETE
            ? "removed"
            : "unchanged",
      text: part[1],
    }),
  );
}

function DiffLine({ line }: { line: DialogLineDiff }) {
  const sign =
    line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
  return (
    <div
      className={cn(
        "grid grid-cols-[1.25rem_1fr] gap-2 px-2 py-0.5 font-mono text-xs",
        line.type === "added" && "bg-emerald-500/10 text-emerald-700",
        line.type === "removed" && "bg-red-500/10 text-red-700",
        line.type === "unchanged" && "text-muted-foreground",
      )}
    >
      <span className="text-right select-none">{sign}</span>
      <span className="break-words whitespace-pre-wrap">
        {line.text || " "}
      </span>
    </div>
  );
}

export function EvaluationDialog({
  open,
  onOpenChange,
  reportContent,
  query,
  reportStyle,
  onReportImproved,
}: EvaluationDialogProps) {
  const t = useTranslations("chat.evaluation");
  const [loading, setLoading] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [improving, setImproving] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [improvementDetails, setImprovementDetails] =
    useState<ImprovementDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasRunInitialEvaluation = useRef(false);

  const runEvaluation = useCallback(
    async (useLlm: boolean) => {
      if (useLlm) {
        setDeepLoading(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const evalResult = await evaluateReport(
          reportContent,
          query,
          reportStyle,
          useLlm,
        );
        setResult(evalResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Evaluation failed");
      } finally {
        setLoading(false);
        setDeepLoading(false);
      }
    },
    [reportContent, query, reportStyle],
  );

  const runImprovement = useCallback(async () => {
    if (!result || !onReportImproved) return;

    setImproving(true);
    setError(null);

    try {
      const improved = await improveReport(
        reportContent,
        query,
        reportStyle,
        result,
      );
      const details = {
        previousEvaluation: result,
        result: improved,
        diff: buildLineDiff(reportContent, improved.content),
      };
      setResult(improved.evaluation);
      setImprovementDetails(details);
      onReportImproved(improved, result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Report improvement failed",
      );
    } finally {
      setImproving(false);
    }
  }, [onReportImproved, query, reportContent, reportStyle, result]);

  useEffect(() => {
    if (open && !hasRunInitialEvaluation.current) {
      hasRunInitialEvaluation.current = true;
      void runEvaluation(false);
    }
  }, [open, runEvaluation]);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setImprovementDetails(null);
      setError(null);
      hasRunInitialEvaluation.current = false;
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {loading && !result ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-muted-foreground mt-4 text-sm">
              {t("evaluating")}
            </p>
          </div>
        ) : error ? (
          <div className="py-4 text-center text-red-500">{error}</div>
        ) : result ? (
          <div className="space-y-6">
            {/* Grade and Score */}
            <div className="flex items-center gap-6">
              <GradeBadge grade={result.grade} />
              <div>
                <div className="text-3xl font-bold">{result.score}/10</div>
                <div className="text-muted-foreground text-sm">
                  {t("overallScore")}
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">{t("metrics")}</h4>
              <div className="bg-muted/50 space-y-2 rounded-lg p-3">
                <MetricItem
                  icon={FileText}
                  label={t("wordCount")}
                  value={result.metrics.word_count.toLocaleString()}
                />
                <MetricItem
                  icon={Link2}
                  label={t("citations")}
                  value={result.metrics.citation_count}
                />
                <MetricItem
                  icon={BookOpen}
                  label={t("sources")}
                  value={result.metrics.unique_sources}
                />
                <MetricItem
                  icon={Image}
                  label={t("images")}
                  value={result.metrics.image_count}
                />
                <div className="pt-2">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("sectionCoverage")}
                    </span>
                    <span className="font-medium">
                      {Math.round(result.metrics.section_coverage_score * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={result.metrics.section_coverage_score * 100}
                    className="h-2"
                  />
                </div>
              </div>
            </div>

            {/* LLM Evaluation Results */}
            {result.llm_evaluation && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">{t("detailedAnalysis")}</h4>

                {/* LLM Scores */}
                <div className="bg-muted/50 grid grid-cols-2 gap-2 rounded-lg p-3 text-sm">
                  {Object.entries(result.llm_evaluation.scores).map(
                    ([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t(`scores.${key}`)}
                        </span>
                        <span className="font-medium">{value}/10</span>
                      </div>
                    ),
                  )}
                </div>

                {/* Strengths */}
                {result.llm_evaluation.strengths.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                      <ThumbsUp className="h-4 w-4" />
                      {t("strengths")}
                    </div>
                    <ul className="space-y-1 text-sm">
                      {result.llm_evaluation.strengths
                        .slice(0, 3)
                        .map((s, i) => (
                          <li key={i} className="text-muted-foreground">
                            • {s}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {/* Weaknesses */}
                {result.llm_evaluation.weaknesses.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
                      <ThumbsDown className="h-4 w-4" />
                      {t("weaknesses")}
                    </div>
                    <ul className="space-y-1 text-sm">
                      {result.llm_evaluation.weaknesses
                        .slice(0, 3)
                        .map((w, i) => (
                          <li key={i} className="text-muted-foreground">
                            • {w}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {/* Suggestions */}
                {result.llm_evaluation.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                      <Sparkles className="h-4 w-4" />
                      {t("suggestions")}
                    </div>
                    <ul className="space-y-1 text-sm">
                      {result.llm_evaluation.suggestions
                        .slice(0, 4)
                        .map((suggestion, i) => (
                          <li key={i} className="text-muted-foreground">
                            • {suggestion}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {onReportImproved && (
              <Button
                className="w-full"
                onClick={runImprovement}
                disabled={improving || loading || deepLoading}
              >
                {improving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("improving")}
                  </>
                ) : (
                  <>
                    <WandSparkles className="mr-2 h-4 w-4" />
                    {t("improveReport")}
                  </>
                )}
              </Button>
            )}

            {improvementDetails && (
              <div className="bg-muted/30 space-y-3 rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium">{t("optimizationDetails")}</h4>
                  <span className="text-muted-foreground">
                    {t("scoreChange", {
                      before: improvementDetails.previousEvaluation.score,
                      after: improvementDetails.result.evaluation.score,
                    })}
                  </span>
                </div>

                {improvementDetails.result.improvement_plan?.length ? (
                  <div className="space-y-1">
                    <div className="font-medium">{t("improvementBasis")}</div>
                    <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                      {improvementDetails.result.improvement_plan.map(
                        (item) => (
                          <li key={item}>{item}</li>
                        ),
                      )}
                    </ul>
                  </div>
                ) : null}

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{t("lineDiff")}</div>
                    <div className="text-muted-foreground text-xs">
                      {t("diffSummary", {
                        added: improvementDetails.diff.filter(
                          (line) => line.type === "added",
                        ).length,
                        removed: improvementDetails.diff.filter(
                          (line) => line.type === "removed",
                        ).length,
                      })}
                    </div>
                  </div>
                  <div className="bg-background max-h-72 overflow-auto rounded-md border">
                    {improvementDetails.diff
                      .filter((line) => line.type !== "unchanged")
                      .map((line, index) => (
                        <DiffLine key={`${line.type}-${index}`} line={line} />
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Deep Evaluation Button */}
            {!result.llm_evaluation && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => runEvaluation(true)}
                disabled={deepLoading}
              >
                {deepLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("analyzing")}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t("deepEvaluation")}
                  </>
                )}
              </Button>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
