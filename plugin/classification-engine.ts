/**
 * Classification Engine - Configuration-driven classifier
 */

import type {
  ClassificationRulesConfig,
  Category,
  ClassificationRuleSet,
} from "./classification-loader.js";

// ============================================================================
// Types
// ============================================================================

export type Confidence = "low" | "medium" | "high";

export type ClassificationResult = {
  categoryId: string;
  categoryName: string;
  confidence: Confidence;
  signals: string[];
  reason: string;
  models: string[];
  fallbackModel?: string;
};

// ============================================================================
// Classification Engine
// ============================================================================

/**
 * Classify content based on dynamic rules from config
 */
export function classifyContent(
  content: string,
  metadata: Record<string, unknown> | undefined,
  config: ClassificationRulesConfig
): ClassificationResult {
  const text = (content ?? "").toLowerCase();
  const contentLength = content?.length ?? 0;

  // Get enabled categories sorted by priority (desc)
  const enabledCategories = config.categories
    .filter((cat) => cat.enabled !== false)
    .sort((a, b) => b.priority - a.priority);

  // Try to match each category
  const matches: Array<{
    category: Category;
    signals: string[];
    signalWeight: number;
  }> = [];

  for (const category of enabledCategories) {
    const { signals, signalWeight } = matchCategory(
      content,
      text,
      contentLength,
      metadata,
      category
    );

    if (signals.length > 0) {
      matches.push({ category, signals, signalWeight });
    }
  }

  // Resolve conflicts
  const conflictStrategy = config.globalSettings?.conflictResolution ?? "priority";
  let selectedMatch:
    | {
        category: Category;
        signals: string[];
        signalWeight: number;
      }
    | undefined;

  if (matches.length > 0) {
    if (conflictStrategy === "first_match") {
      selectedMatch = matches[0];
    } else if (conflictStrategy === "highest_confidence") {
      selectedMatch = matches.sort((a, b) => b.signalWeight - a.signalWeight)[0];
    } else {
      // priority (default) - already sorted
      selectedMatch = matches[0];
    }
  }

  // If no match, use fallback
  if (!selectedMatch) {
    const fallbackId = config.defaultFallback ?? "fallback";
    const fallbackCat = config.categories.find((c) => c.id === fallbackId);

    if (!fallbackCat) {
      throw new Error(
        `Fallback category '${fallbackId}' not found in configuration`
      );
    }

    return {
      categoryId: fallbackCat.id,
      categoryName: fallbackCat.name,
      confidence: "low",
      signals: ["no_match_fallback"],
      reason: `No category matched; using fallback category '${fallbackCat.name}'.`,
      models: fallbackCat.models,
      fallbackModel: fallbackCat.fallbackModel,
    };
  }

  // Calculate confidence
  const confidence = calculateConfidence(
    selectedMatch.signals.length,
    selectedMatch.signalWeight,
    selectedMatch.category.confidence
  );

  // Check if confidence is too low - force fallback
  const minConfidenceThreshold = config.globalSettings?.defaultConfidence ?? "low";
  if (shouldForceFallback(confidence, minConfidenceThreshold)) {
    const fallbackId = config.defaultFallback ?? "fallback";
    const fallbackCat = config.categories.find((c) => c.id === fallbackId);

    if (fallbackCat) {
      return {
        categoryId: fallbackCat.id,
        categoryName: fallbackCat.name,
        confidence: "low",
        signals: [...selectedMatch.signals, "low_confidence_fallback"],
        reason: `Matched '${selectedMatch.category.name}' but confidence too low; using fallback.`,
        models: fallbackCat.models,
        fallbackModel: fallbackCat.fallbackModel,
      };
    }
  }

  return {
    categoryId: selectedMatch.category.id,
    categoryName: selectedMatch.category.name,
    confidence,
    signals: selectedMatch.signals,
    reason: `Matched category '${selectedMatch.category.name}' with ${confidence} confidence (${selectedMatch.signals.length} signals).`,
    models: selectedMatch.category.models,
    fallbackModel: selectedMatch.category.fallbackModel,
  };
}

// ============================================================================
// Matching Logic
// ============================================================================

function matchCategory(
  content: string,
  text: string,
  contentLength: number,
  metadata: Record<string, unknown> | undefined,
  category: Category
): { signals: string[]; signalWeight: number } {
  const signals: string[] = [];
  let signalWeight = 0;

  const rules = category.rules;
  const weights = category.confidence?.weights ?? {};
  const keywordWeight = weights.positiveKeyword ?? 1.0;
  const metadataWeight = weights.metadata ?? 2.0;
  const regexWeight = weights.regex ?? 1.5;

  // Check length constraints
  if (rules.minLength !== undefined && contentLength < rules.minLength) {
    return { signals: [], signalWeight: 0 };
  }
  if (rules.maxLength !== undefined && contentLength > rules.maxLength) {
    return { signals: [], signalWeight: 0 };
  }

  // Check negative keywords first (early exit)
  if (rules.negativeKeywords && rules.negativeKeywords.length > 0) {
    for (const keyword of rules.negativeKeywords) {
      if (content.includes(keyword) || text.includes(keyword.toLowerCase())) {
        return { signals: [], signalWeight: 0 }; // Excluded
      }
    }
  }

  // Check metadata conditions
  if (rules.metadataConditions) {
    const cond = rules.metadataConditions;

    if (cond.hasImage !== undefined) {
      const hasImage =
        metadata?.hasImage === true ||
        (metadata?.mediaType as string)?.toLowerCase().includes("image");

      if (cond.hasImage && hasImage) {
        signals.push("metadata:hasImage");
        signalWeight += metadataWeight;
      } else if (!cond.hasImage && hasImage) {
        return { signals: [], signalWeight: 0 }; // Excluded
      }
    }

    if (cond.hasCodeBlock !== undefined) {
      const hasCodeBlock = content.includes("```");

      if (cond.hasCodeBlock && hasCodeBlock) {
        signals.push("metadata:hasCodeBlock");
        signalWeight += metadataWeight;
      } else if (!cond.hasCodeBlock && hasCodeBlock) {
        return { signals: [], signalWeight: 0 }; // Excluded
      }
    }
  }

  // Check positive keywords
  if (rules.positiveKeywords && rules.positiveKeywords.length > 0) {
    for (const keyword of rules.positiveKeywords) {
      if (content.includes(keyword) || text.includes(keyword.toLowerCase())) {
        signals.push(`keyword:${keyword}`);
        signalWeight += keywordWeight;
        break; // Count once per category
      }
    }
  }

  // Check regex patterns
  if (rules.regex && rules.regex.length > 0) {
    for (const regexRule of rules.regex) {
      try {
        const pattern = new RegExp(regexRule.pattern, regexRule.flags ?? "i");
        if (pattern.test(content)) {
          signals.push(`regex:${regexRule.pattern}`);
          signalWeight += regexWeight;
          break; // Count once per category
        }
      } catch {
        // Ignore invalid regex
      }
    }
  }

  // Special case: if no positive rules defined, treat as match (for fallback categories)
  if (
    (!rules.positiveKeywords || rules.positiveKeywords.length === 0) &&
    (!rules.regex || rules.regex.length === 0) &&
    signals.length === 0
  ) {
    signals.push("default_match");
  }

  return { signals, signalWeight };
}

// ============================================================================
// Confidence Calculation
// ============================================================================

function calculateConfidence(
  signalCount: number,
  signalWeight: number,
  categoryConf: Category["confidence"]
): Confidence {
  const minSignals = categoryConf?.minSignals ?? 1;
  const highSignals = categoryConf?.highSignals ?? 2;

  if (signalCount >= highSignals) {
    return "high";
  } else if (signalCount >= minSignals) {
    return "medium";
  } else {
    return "low";
  }
}

function shouldForceFallback(
  confidence: Confidence,
  minThreshold: "low" | "medium" | "high"
): boolean {
  const confidenceRank = (c: string) =>
    c === "high" ? 3 : c === "medium" ? 2 : 1;

  return confidenceRank(confidence) < confidenceRank(minThreshold);
}
