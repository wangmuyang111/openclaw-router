export type KeywordLibrary = {
    version: number;
    updatedAt?: string;
    notes?: string;
    defaultFallbackKind?: string;
    normalization?: {
        lowercase?: boolean;
        trim?: boolean;
        collapseWhitespace?: boolean;
    };
    keywordSets: Record<string, string[]>;
    kinds: Record<string, {
        id: string;
        name?: string;
        priority: number;
        enabled?: boolean;
        signals: {
            positive: Array<{
                set: string;
                weight: number;
                match?: "contains";
                exclude?: boolean;
            }>;
            negative: Array<{
                set: string;
                weight: number;
                match?: "contains";
                exclude?: boolean;
            }>;
            metadata: Array<{
                field: "hasImage" | "hasCodeBlock";
                equals: boolean;
                weight: number;
                exclude?: boolean;
            }>;
            regex: Array<{
                pattern: string;
                flags?: string;
                weight: number;
            }>;
        };
        thresholds: {
            minScore?: number;
            highScore?: number;
            minStrongHits?: number;
        };
        models: {
            strategy: "priority_list";
            list: string[];
        };
    }>;
};
export type KeywordOverrides = {
    version: number;
    updatedAt?: string;
    notes?: string;
    sets?: Record<string, {
        add?: string[];
        remove?: string[];
    }>;
    kinds?: Record<string, {
        enabled?: boolean;
    }>;
};
export type CompiledRoutingRules = {
    version: number;
    compiledAt: string;
    defaultFallbackKind: string;
    kinds: CompiledKindRule[];
};
export type CompiledKindRule = {
    id: string;
    name?: string;
    priority: number;
    enabled: boolean;
    positive: Array<{
        keywords: string[];
        weight: number;
        match: "contains";
        exclude: boolean;
        sourceSet: string;
    }>;
    negative: Array<{
        keywords: string[];
        weight: number;
        match: "contains";
        exclude: boolean;
        sourceSet: string;
    }>;
    metadata: Array<{
        field: "hasImage" | "hasCodeBlock";
        equals: boolean;
        weight: number;
        exclude: boolean;
    }>;
    regex: Array<{
        pattern: string;
        flags: string;
        weight: number;
    }>;
    thresholds: {
        minScore: number;
        highScore: number;
        minStrongHits: number;
    };
    models: {
        strategy: "priority_list";
        list: string[];
    };
};
export declare function defaultKeywordLibraryPath(): string;
export declare function defaultKeywordOverridesPath(): string;
export declare function loadAndCompileRoutingRules(params?: {
    libraryPath?: string;
    overridesPath?: string;
}): Promise<{
    compiled: CompiledRoutingRules;
    warnings: string[];
}>;
export declare function parsePasteLines(input: string): string[];
//# sourceMappingURL=keyword-library.d.ts.map