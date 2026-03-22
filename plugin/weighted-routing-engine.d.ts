import type { CompiledRoutingRules } from "./keyword-library.ts";
export type RoutingConfidence = "low" | "medium" | "high";
export type RoutingDecision = {
    kind: string;
    confidence: RoutingConfidence;
    score: number;
    strongHits: number;
    hits: number;
    reason: string;
    signals: string[];
    matched: {
        positive: Array<{
            set: string;
            term: string;
            weight: number;
        }>;
        negative: Array<{
            set: string;
            term: string;
            weight: number;
        }>;
        metadata: Array<{
            field: string;
            weight: number;
        }>;
        regex: Array<{
            pattern: string;
            weight: number;
        }>;
    };
};
export declare function routeByWeightedRules(params: {
    rules: CompiledRoutingRules;
    content: string;
    metadata?: Record<string, unknown>;
    maxExplainTerms?: number;
}): RoutingDecision;
//# sourceMappingURL=weighted-routing-engine.d.ts.map