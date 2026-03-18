/**
 * Classification Rules - Configuration-driven types and loader
 * 
 * This module provides dynamic classification based on classification-rules.json
 * Supports adding/removing categories without code changes.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

// ============================================================================
// Types (based on classification-rules.schema.json)
// ============================================================================

export type ClassificationRuleSet = {
  positiveKeywords?: string[];
  negativeKeywords?: string[];
  minLength?: number;
  maxLength?: number;
  metadataConditions?: {
    hasImage?: boolean;
    hasCodeBlock?: boolean;
    customFields?: Record<string, unknown>;
  };
  regex?: Array<{
    pattern: string;
    flags?: string;
  }>;
};

export type CategoryConfidence = {
  minSignals?: number;
  highSignals?: number;
  weights?: {
    positiveKeyword?: number;
    metadata?: number;
    regex?: number;
  };
};

export type Category = {
  id: string;
  name: string;
  description?: string;
  priority: number;
  enabled: boolean;
  rules: ClassificationRuleSet;
  confidence: CategoryConfidence;
  models: string[];
  fallbackModel?: string;
};

export type GlobalSettings = {
  conflictResolution?: "priority" | "first_match" | "highest_confidence";
  defaultConfidence?: "low" | "medium" | "high";
  enableCache?: boolean;
  cacheTtlMs?: number;
};

export type ClassificationRulesConfig = {
  version: number;
  updatedAt?: string;
  notes?: string;
  defaultFallback?: string;
  categories: Category[];
  globalSettings?: GlobalSettings;
};

// ============================================================================
// Cache
// ============================================================================

let configCache: {
  value: ClassificationRulesConfig;
  loadedAtMs: number;
  filePath: string;
} | null = null;

function getOpenClawHome(): string {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function getWorkspaceDir(): string {
  return process.env.OPENCLAW_WORKSPACE ?? path.join(getOpenClawHome(), "workspace");
}

function getDefaultToolsDir(): string {
  return path.join(getWorkspaceDir(), "tools", "soft-router-suggest");
}

const DEFAULT_CONFIG_PATH = path.join(getDefaultToolsDir(), "classification-rules.json");

// ============================================================================
// Configuration Loader
// ============================================================================

/**
 * Load classification rules from JSON file with validation
 */
export async function loadClassificationRules(
  configPath?: string
): Promise<ClassificationRulesConfig> {
  const filePath = configPath ?? DEFAULT_CONFIG_PATH;

  // Check cache
  if (configCache && configCache.filePath === filePath) {
    return configCache.value;
  }

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as ClassificationRulesConfig;

    // Basic validation
    if (!parsed.version || typeof parsed.version !== "number") {
      throw new Error("Invalid config: missing or invalid 'version' field");
    }

    if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
      throw new Error("Invalid config: 'categories' must be a non-empty array");
    }

    // Validate each category
    for (const cat of parsed.categories) {
      if (!cat.id || typeof cat.id !== "string") {
        throw new Error(`Invalid category: missing or invalid 'id'`);
      }
      if (!Array.isArray(cat.models) || cat.models.length === 0) {
        throw new Error(`Category '${cat.id}': 'models' must be a non-empty array`);
      }
    }

    // Cache the config
    configCache = {
      value: parsed,
      loadedAtMs: Date.now(),
      filePath,
    };

    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to load classification rules from '${filePath}': ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Clear config cache (useful for hot-reload)
 */
export function clearConfigCache(): void {
  configCache = null;
}

/**
 * Get config cache info
 */
export function getConfigCacheInfo() {
  return configCache
    ? {
        loadedAtMs: configCache.loadedAtMs,
        filePath: configCache.filePath,
        categoriesCount: configCache.value.categories.length,
      }
    : null;
}
