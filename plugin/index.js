"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = register;
var fs = require("node:fs/promises");
var path = require("node:path");
var crypto = require("node:crypto");
var os = require("node:os");
var node_child_process_1 = require("node:child_process");
var node_util_1 = require("node:util");
// NOTE: Gateway runs plugins in Node; console.log() becomes gateway log output.
// Configuration-driven classification
// Legacy classification engine removed: we fully converge on the weighted keyword-library engine.
// (Files remain in repo for reference/compat but are no longer loaded at runtime.)
// NEW: keyword library + weighted routing (for user-custom keyword add/remove)
var keyword_library_ts_1 = require("./keyword-library.ts");
var weighted_routing_engine_ts_1 = require("./weighted-routing-engine.ts");
// Runtime path resolution helpers
function getOpenClawHome() {
    var _a;
    return (_a = process.env.OPENCLAW_HOME) !== null && _a !== void 0 ? _a : path.join(os.homedir(), ".openclaw");
}
function getWorkspaceDir() {
    var _a;
    return (_a = process.env.OPENCLAW_WORKSPACE) !== null && _a !== void 0 ? _a : path.join(getOpenClawHome(), "workspace");
}
function getDefaultLogDir() {
    return path.join(getOpenClawHome(), "logs");
}
function getDefaultToolsDir() {
    return path.join(getWorkspaceDir(), "tools", "soft-router-suggest");
}
var DEFAULTS = {
    enabled: true,
    get logDir() { return getDefaultLogDir(); },
    logFile: "soft-router-suggest.jsonl",
    previewChars: 200,
    maxBytes: 5 * 1024 * 1024,
    rotateCount: 3,
    availabilityEnabled: false,
    availabilityMode: "static",
    availabilityTtlMs: 60000,
    availabilityCmdTimeoutMs: 500,
    availabilityAsyncEnabled: false,
    availabilityMaxStaleMs: 3600000,
    echoEnabled: false,
    echoWhen: "on_expired",
    echoMaxChars: 280,
    ruleEngineEnabled: false,
    switchingEnabled: false,
    switchingMinConfidence: "medium",
    switchingAllowChat: false,
    get modelTagsPath() { return path.join(getDefaultToolsDir(), "model-tags.json"); },
    get modelPriorityPath() { return path.join(getDefaultToolsDir(), "model-priority.json"); },
    get keywordLibraryPath() { return path.join(getDefaultToolsDir(), "keyword-library.json"); },
    get keywordOverridesPath() { return path.join(getDefaultToolsDir(), "keyword-overrides.user.json"); },
    get routingRulesCompiledPath() { return path.join(getDefaultToolsDir(), "routing-rules.compiled.json"); },
    keywordCustomEnabled: true,
    catalogTtlMs: 600000,
    catalogCmdTimeoutMs: 20000,
    setupPromptEnabled: true,
    setupPromptMaxModels: 3,
    taskModeEnabled: true,
    taskModePrimaryKind: "coding",
    taskModeKinds: ["coding"],
    taskModeMinConfidence: "medium",
    taskModeReturnToPrimary: true,
    taskModeAllowAutoDowngrade: false,
    freeSwitchWhenTaskModeOff: true,
};
function clampInt(value, min, max, fallback) {
    var n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n))
        return fallback;
    return Math.max(min, Math.min(max, Math.trunc(n)));
}
function getRawConfig(api) {
    var _a, _b, _c, _d;
    var a = api;
    // Primary: validated pluginConfig from openclaw.json -> plugins.entries.<id>.config
    if ((a === null || a === void 0 ? void 0 : a.pluginConfig) && typeof a.pluginConfig === "object" && !Array.isArray(a.pluginConfig)) {
        var raw = a.pluginConfig;
        var keys = Object.keys(raw).sort();
        return { source: "pluginConfig", cfg: raw, keys: keys };
    }
    // Fallback: try to read from the global config tree directly.
    var entryCfg = (_d = (_c = (_b = (_a = a === null || a === void 0 ? void 0 : a.config) === null || _a === void 0 ? void 0 : _a.plugins) === null || _b === void 0 ? void 0 : _b.entries) === null || _c === void 0 ? void 0 : _c[a === null || a === void 0 ? void 0 : a.id]) === null || _d === void 0 ? void 0 : _d.config;
    if (entryCfg && typeof entryCfg === "object" && !Array.isArray(entryCfg)) {
        var raw = entryCfg;
        var keys = Object.keys(raw).sort();
        return { source: "config.plugins.entries", cfg: raw, keys: keys };
    }
    return { source: "none", cfg: {}, keys: [] };
}
function resolveConfig(api) {
    var cfg = getRawConfig(api).cfg;
    var enabled = typeof cfg.enabled === "boolean" ? cfg.enabled : DEFAULTS.enabled;
    var logDir = typeof cfg.logDir === "string" && cfg.logDir.trim() ? cfg.logDir : DEFAULTS.logDir;
    var logFile = typeof cfg.logFile === "string" && cfg.logFile.trim() ? cfg.logFile : DEFAULTS.logFile;
    var previewChars = clampInt(cfg.previewChars, 0, 2000, DEFAULTS.previewChars);
    var maxBytes = clampInt(cfg.maxBytes, 0, 1000000000, DEFAULTS.maxBytes);
    var rotateCount = clampInt(cfg.rotateCount, 0, 20, DEFAULTS.rotateCount);
    var availabilityEnabled = typeof cfg.availabilityEnabled === "boolean"
        ? cfg.availabilityEnabled
        : DEFAULTS.availabilityEnabled;
    var availabilityMode = cfg.availabilityMode === "cli" ? "cli" : DEFAULTS.availabilityMode;
    var availabilityTtlMs = clampInt(cfg.availabilityTtlMs, 1000, 3600000, DEFAULTS.availabilityTtlMs);
    var availabilityCmdTimeoutMs = clampInt(cfg.availabilityCmdTimeoutMs, 50, 20000, DEFAULTS.availabilityCmdTimeoutMs);
    var availabilityAsyncEnabled = typeof cfg.availabilityAsyncEnabled === "boolean"
        ? cfg.availabilityAsyncEnabled
        : DEFAULTS.availabilityAsyncEnabled;
    var availabilityMaxStaleMs = clampInt(cfg.availabilityMaxStaleMs, 0, 86400000, DEFAULTS.availabilityMaxStaleMs);
    var echoEnabled = typeof cfg.echoEnabled === "boolean" ? cfg.echoEnabled : DEFAULTS.echoEnabled;
    var echoWhen = cfg.echoWhen === "always" || cfg.echoWhen === "never" ? cfg.echoWhen : DEFAULTS.echoWhen;
    var echoMaxChars = clampInt(cfg.echoMaxChars, 40, 2000, DEFAULTS.echoMaxChars);
    var ruleEngineEnabled = typeof cfg.ruleEngineEnabled === "boolean" ? cfg.ruleEngineEnabled : DEFAULTS.ruleEngineEnabled;
    var switchingEnabled = typeof cfg.switchingEnabled === "boolean" ? cfg.switchingEnabled : DEFAULTS.switchingEnabled;
    var switchingMinConfidence = cfg.switchingMinConfidence === "low" ||
        cfg.switchingMinConfidence === "medium" ||
        cfg.switchingMinConfidence === "high"
        ? cfg.switchingMinConfidence
        : DEFAULTS.switchingMinConfidence;
    var switchingAllowChat = typeof cfg.switchingAllowChat === "boolean" ? cfg.switchingAllowChat : DEFAULTS.switchingAllowChat;
    var modelTagsPath = typeof cfg.modelTagsPath === "string" && cfg.modelTagsPath.trim()
        ? cfg.modelTagsPath
        : DEFAULTS.modelTagsPath;
    var modelPriorityPath = typeof cfg.modelPriorityPath === "string" && cfg.modelPriorityPath.trim()
        ? cfg.modelPriorityPath
        : DEFAULTS.modelPriorityPath;
    var keywordLibraryPath = typeof cfg.keywordLibraryPath === "string" && cfg.keywordLibraryPath.trim()
        ? cfg.keywordLibraryPath
        : DEFAULTS.keywordLibraryPath;
    var keywordOverridesPath = typeof cfg.keywordOverridesPath === "string" && cfg.keywordOverridesPath.trim()
        ? cfg.keywordOverridesPath
        : DEFAULTS.keywordOverridesPath;
    var routingRulesCompiledPath = typeof cfg.routingRulesCompiledPath === "string" && cfg.routingRulesCompiledPath.trim()
        ? cfg.routingRulesCompiledPath
        : DEFAULTS.routingRulesCompiledPath;
    var keywordCustomEnabled = typeof cfg.keywordCustomEnabled === "boolean" ? cfg.keywordCustomEnabled : DEFAULTS.keywordCustomEnabled;
    var catalogTtlMs = clampInt(cfg.catalogTtlMs, 10000, 86400000, DEFAULTS.catalogTtlMs);
    var catalogCmdTimeoutMs = clampInt(cfg.catalogCmdTimeoutMs, 1000, 60000, DEFAULTS.catalogCmdTimeoutMs);
    var setupPromptEnabled = typeof cfg.setupPromptEnabled === "boolean"
        ? cfg.setupPromptEnabled
        : DEFAULTS.setupPromptEnabled;
    var setupPromptMaxModels = clampInt(cfg.setupPromptMaxModels, 1, 20, DEFAULTS.setupPromptMaxModels);
    var taskModeEnabled = typeof cfg.taskModeEnabled === "boolean" ? cfg.taskModeEnabled : DEFAULTS.taskModeEnabled;
    var taskModePrimaryKind = typeof cfg.taskModePrimaryKind === "string" && cfg.taskModePrimaryKind.trim()
        ? cfg.taskModePrimaryKind.trim()
        : DEFAULTS.taskModePrimaryKind;
    var taskModeKinds = Array.isArray(cfg.taskModeKinds)
        ? Array.from(new Set(cfg.taskModeKinds
            .map(function (value) { return String(value !== null && value !== void 0 ? value : "").trim(); })
            .filter(function (value) { return value.length > 0; })))
        : DEFAULTS.taskModeKinds;
    var taskModeMinConfidence = cfg.taskModeMinConfidence === "low" ||
        cfg.taskModeMinConfidence === "medium" ||
        cfg.taskModeMinConfidence === "high"
        ? cfg.taskModeMinConfidence
        : DEFAULTS.taskModeMinConfidence;
    var taskModeReturnToPrimary = typeof cfg.taskModeReturnToPrimary === "boolean"
        ? cfg.taskModeReturnToPrimary
        : DEFAULTS.taskModeReturnToPrimary;
    var taskModeAllowAutoDowngrade = typeof cfg.taskModeAllowAutoDowngrade === "boolean"
        ? cfg.taskModeAllowAutoDowngrade
        : DEFAULTS.taskModeAllowAutoDowngrade;
    var freeSwitchWhenTaskModeOff = typeof cfg.freeSwitchWhenTaskModeOff === "boolean"
        ? cfg.freeSwitchWhenTaskModeOff
        : DEFAULTS.freeSwitchWhenTaskModeOff;
    return {
        enabled: enabled,
        logDir: logDir,
        logFile: logFile,
        previewChars: previewChars,
        maxBytes: maxBytes,
        rotateCount: rotateCount,
        availabilityEnabled: availabilityEnabled,
        availabilityMode: availabilityMode,
        availabilityTtlMs: availabilityTtlMs,
        availabilityCmdTimeoutMs: availabilityCmdTimeoutMs,
        availabilityAsyncEnabled: availabilityAsyncEnabled,
        availabilityMaxStaleMs: availabilityMaxStaleMs,
        echoEnabled: echoEnabled,
        echoWhen: echoWhen,
        echoMaxChars: echoMaxChars,
        ruleEngineEnabled: ruleEngineEnabled,
        switchingEnabled: switchingEnabled,
        switchingMinConfidence: switchingMinConfidence,
        switchingAllowChat: switchingAllowChat,
        modelTagsPath: modelTagsPath,
        modelPriorityPath: modelPriorityPath,
        keywordLibraryPath: keywordLibraryPath,
        keywordOverridesPath: keywordOverridesPath,
        routingRulesCompiledPath: routingRulesCompiledPath,
        keywordCustomEnabled: keywordCustomEnabled,
        catalogTtlMs: catalogTtlMs,
        catalogCmdTimeoutMs: catalogCmdTimeoutMs,
        setupPromptEnabled: setupPromptEnabled,
        setupPromptMaxModels: setupPromptMaxModels,
        taskModeEnabled: taskModeEnabled,
        taskModePrimaryKind: taskModePrimaryKind,
        taskModeKinds: taskModeKinds,
        taskModeMinConfidence: taskModeMinConfidence,
        taskModeReturnToPrimary: taskModeReturnToPrimary,
        taskModeAllowAutoDowngrade: taskModeAllowAutoDowngrade,
        freeSwitchWhenTaskModeOff: freeSwitchWhenTaskModeOff,
    };
}
var rotating = false;
function maybeRotate(logPath, maxBytes, rotateCount) {
    return __awaiter(this, void 0, void 0, function () {
        var stat, i, src, dst, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (maxBytes <= 0 || rotateCount <= 0)
                        return [2 /*return*/];
                    if (rotating)
                        return [2 /*return*/];
                    rotating = true;
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, , 12, 13]);
                    return [4 /*yield*/, fs.stat(logPath).catch(function () { return null; })];
                case 2:
                    stat = _c.sent();
                    if (!stat || stat.size <= maxBytes)
                        return [2 /*return*/];
                    i = rotateCount - 1;
                    _c.label = 3;
                case 3:
                    if (!(i >= 1)) return [3 /*break*/, 8];
                    src = "".concat(logPath, ".").concat(i);
                    dst = "".concat(logPath, ".").concat(i + 1);
                    _c.label = 4;
                case 4:
                    _c.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, fs.rename(src, dst)];
                case 5:
                    _c.sent();
                    return [3 /*break*/, 7];
                case 6:
                    _a = _c.sent();
                    return [3 /*break*/, 7];
                case 7:
                    i--;
                    return [3 /*break*/, 3];
                case 8:
                    _c.trys.push([8, 10, , 11]);
                    return [4 /*yield*/, fs.rename(logPath, "".concat(logPath, ".1"))];
                case 9:
                    _c.sent();
                    return [3 /*break*/, 11];
                case 10:
                    _b = _c.sent();
                    return [3 /*break*/, 11];
                case 11: return [3 /*break*/, 13];
                case 12:
                    rotating = false;
                    return [7 /*endfinally*/];
                case 13: return [2 /*return*/];
            }
        });
    });
}
function nowIso() {
    return new Date().toISOString();
}
var execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
function providerFromModel(model) {
    var m = (model !== null && model !== void 0 ? model : "").trim();
    var idx = m.indexOf("/");
    return idx > 0 ? m.slice(0, idx) : m;
}
/**
 * Embedded runner + OpenAI-compatible gateways (like our local-proxy) expect the HTTP `model` field
 * to be a *providerless* model id (e.g. "gpt-5.2"), not an OpenClaw catalog key like
 * "local-proxy/gpt-5.2".
 *
 * When we return modelOverride from before_agent_start, OpenClaw may pass it through to the provider.
 * To avoid 502 loops ("unknown provider for model local-proxy/...") we normalize here.
 *
 * Note: this intentionally reduces cross-provider switching for embedded runs; it's a safety fix.
 */
function normalizeModelOverrideForProvider(modelKey) {
    var m = String(modelKey !== null && modelKey !== void 0 ? modelKey : "").trim();
    var idx = m.indexOf("/");
    if (idx > 0) {
        return { override: m.slice(idx + 1), normalizedFrom: m };
    }
    return { override: m };
}
var authCache = null;
var authProbeInFlight = null;
// Echo support: keep the last suggestion per conversation so we can annotate outgoing replies.
var lastSuggestionByConversation = new Map();
var catalogCache = null;
var catalogRefreshInFlight = null;
var lastSetupPromptAtMs = 0;
// Classification config cache
// legacy classification config removed
function inferTagsFromCatalog(entry) {
    var _a, _b, _c, _d;
    var tags = [];
    var key = ((_a = entry.key) !== null && _a !== void 0 ? _a : "").toLowerCase();
    var name = ((_b = entry.name) !== null && _b !== void 0 ? _b : "").toLowerCase();
    var input = ((_c = entry.input) !== null && _c !== void 0 ? _c : "").toLowerCase();
    var ctx = (_d = entry.contextWindow) !== null && _d !== void 0 ? _d : null;
    if (input.includes("image"))
        tags.push("vision", "multimodal");
    if (key.includes("codex") || name.includes("codex") || key.includes("coder"))
        tags.push("coding");
    if (key.includes("flash") || name.includes("flash") || key.includes("mini"))
        tags.push("fast");
    if (ctx && ctx >= 200000)
        tags.push("long_context");
    if (key.includes("thinking") || name.includes("thinking"))
        tags.push("reasoning");
    // Defaults
    if (!tags.includes("coding") && !tags.includes("vision"))
        tags.push("chat", "general");
    return Array.from(new Set(tags));
}
function loadJsonFile(p) {
    return __awaiter(this, void 0, void 0, function () {
        var raw, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fs.readFile(p, "utf8")];
                case 1:
                    raw = _b.sent();
                    return [2 /*return*/, JSON.parse(raw)];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function resolveOpenClawMjs() {
    return __awaiter(this, void 0, void 0, function () {
        var env, candidates, _i, candidates_1, p, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    env = process.env;
                    candidates = [
                        env.OPENCLAW_MJS,
                        env.OPENCLAW_HOME ? path.join(env.OPENCLAW_HOME, "openclaw.mjs") : undefined,
                        path.join(process.cwd(), "openclaw.mjs"),
                        "D:/openclaw/openclaw.mjs", // legacy fallback
                    ].filter(function (v) { return Boolean(v && v.trim()); });
                    _i = 0, candidates_1 = candidates;
                    _b.label = 1;
                case 1:
                    if (!(_i < candidates_1.length)) return [3 /*break*/, 6];
                    p = candidates_1[_i];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, fs.stat(p)];
                case 3:
                    _b.sent();
                    return [2 /*return*/, { mjsPath: p, cwd: path.dirname(p) }];
                case 4:
                    _a = _b.sent();
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: throw new Error("openclaw.mjs not found. Tried: ".concat(candidates.join(" | "), ". ") +
                    "Set OPENCLAW_MJS or OPENCLAW_HOME to make path portable.");
            }
        });
    });
}
function fetchModelCatalogCli(api, timeoutMs) {
    return __awaiter(this, void 0, void 0, function () {
        var execFileAsync, now, stdout, parsed, models, _a, _b, mjsPath, cwd, stdout, parsed, models;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
                    now = Date.now();
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 6]);
                    return [4 /*yield*/, execFileAsync("openclaw", ["models", "list", "--json"], { timeout: timeoutMs, windowsHide: true })];
                case 2:
                    stdout = (_c.sent()).stdout;
                    parsed = JSON.parse(String(stdout !== null && stdout !== void 0 ? stdout : "{}"));
                    models = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.models) ? parsed.models : [];
                    return [2 /*return*/, { fetchedAtMs: now, models: models }];
                case 3:
                    _a = _c.sent();
                    return [4 /*yield*/, resolveOpenClawMjs()];
                case 4:
                    _b = _c.sent(), mjsPath = _b.mjsPath, cwd = _b.cwd;
                    return [4 /*yield*/, execFileAsync("node", [mjsPath, "models", "list", "--json"], { timeout: timeoutMs, windowsHide: true, cwd: cwd })];
                case 5:
                    stdout = (_c.sent()).stdout;
                    parsed = JSON.parse(String(stdout !== null && stdout !== void 0 ? stdout : "{}"));
                    models = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.models) ? parsed.models : [];
                    return [2 /*return*/, { fetchedAtMs: now, models: models }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function getModelCatalog(api, cfg) {
    return __awaiter(this, void 0, void 0, function () {
        var now, refresh;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = Date.now();
                    if (catalogCache && catalogCache.expiresAtMs > now)
                        return [2 /*return*/, catalogCache.value];
                    if (!catalogRefreshInFlight) return [3 /*break*/, 2];
                    if (catalogCache)
                        return [2 /*return*/, catalogCache.value];
                    return [4 /*yield*/, catalogRefreshInFlight];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    refresh = (function () { return __awaiter(_this, void 0, void 0, function () {
                        var value;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, , 2, 3]);
                                    return [4 /*yield*/, fetchModelCatalogCli(api, cfg.catalogCmdTimeoutMs)];
                                case 1:
                                    value = _a.sent();
                                    catalogCache = { value: value, expiresAtMs: now + cfg.catalogTtlMs };
                                    return [2 /*return*/, value];
                                case 2:
                                    catalogRefreshInFlight = null;
                                    return [7 /*endfinally*/];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); })();
                    catalogRefreshInFlight = refresh;
                    if (catalogCache)
                        return [2 /*return*/, catalogCache.value];
                    return [4 /*yield*/, refresh];
                case 3: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function buildProviderAuthMapFromSnapshot(snapshot) {
    var _a;
    var out = {};
    if (!snapshot)
        return out;
    var providers = (_a = snapshot.providers) !== null && _a !== void 0 ? _a : {};
    for (var _i = 0, _b = Object.entries(providers); _i < _b.length; _i++) {
        var _c = _b[_i], providerId = _c[0], v = _c[1];
        var auth = v === null || v === void 0 ? void 0 : v.auth;
        if (auth === "ok" || auth === "expired" || auth === "unknown") {
            out[String(providerId)] = auth;
        }
        else {
            out[String(providerId)] = "unknown";
        }
    }
    return out;
}
function pickByPriority(params) {
    var _a, _b, _c, _d, _e, _f;
    var kind = params.kind, catalog = params.catalog, priorityFile = params.priorityFile, classificationConfig = params.classificationConfig, providerAuth = params.providerAuth;
    var present = new Set(((_a = catalog.models) !== null && _a !== void 0 ? _a : [])
        .filter(function (m) { return !m.missing && m.available !== false; })
        .map(function (m) { return m.key; }));
    var listFromPriorityFile = (_e = (_c = (_b = priorityFile === null || priorityFile === void 0 ? void 0 : priorityFile.kinds) === null || _b === void 0 ? void 0 : _b[kind]) !== null && _c !== void 0 ? _c : (_d = priorityFile === null || priorityFile === void 0 ? void 0 : priorityFile.kinds) === null || _d === void 0 ? void 0 : _d["default"]) !== null && _e !== void 0 ? _e : [];
    var listFromClassificationConfig = (function () {
        var _a, _b;
        var categories = (_a = classificationConfig === null || classificationConfig === void 0 ? void 0 : classificationConfig.categories) !== null && _a !== void 0 ? _a : [];
        var cat = categories.find(function (c) { return (c === null || c === void 0 ? void 0 : c.id) === kind && (c === null || c === void 0 ? void 0 : c.enabled) !== false; });
        if (cat && Array.isArray(cat.models)) {
            return cat.models;
        }
        var fallbackId = (_b = classificationConfig === null || classificationConfig === void 0 ? void 0 : classificationConfig.defaultFallback) !== null && _b !== void 0 ? _b : "fallback";
        var fb = categories.find(function (c) { return (c === null || c === void 0 ? void 0 : c.id) === fallbackId && (c === null || c === void 0 ? void 0 : c.enabled) !== false; });
        return Array.isArray(fb === null || fb === void 0 ? void 0 : fb.models) ? fb.models : [];
    })();
    var list = listFromClassificationConfig.length > 0 ? listFromClassificationConfig : listFromPriorityFile;
    for (var _i = 0, list_1 = list; _i < list_1.length; _i++) {
        var modelId = list_1[_i];
        if (!present.has(modelId))
            continue;
        var provider = String(modelId).split("/")[0];
        var auth = (_f = providerAuth[provider]) !== null && _f !== void 0 ? _f : "unknown";
        if (auth === "expired")
            continue; // user-confirmed behavior
        return { picked: modelId, note: "priority_pick kind=".concat(kind, " picked=").concat(modelId, " auth=").concat(auth) };
    }
    return { picked: undefined, note: "priority_pick kind=".concat(kind, " no-match") };
}
function listMissingManualTags(params) {
    var _a, _b, _c;
    var known = new Set(Object.keys((_b = (_a = params.tagsFile) === null || _a === void 0 ? void 0 : _a.models) !== null && _b !== void 0 ? _b : {}));
    var out = [];
    for (var _i = 0, _d = (_c = params.catalog.models) !== null && _c !== void 0 ? _c : []; _i < _d.length; _i++) {
        var m = _d[_i];
        if (!m.key)
            continue;
        if (m.missing)
            continue;
        if (known.has(m.key))
            continue;
        out.push({ key: m.key, inferred: inferTagsFromCatalog(m) });
    }
    return out;
}
function runOpenClawModelsStatusJson(timeoutMs) {
    return __awaiter(this, void 0, void 0, function () {
        var start, stdout, _a, _b, mjsPath, cwd, stdout;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    start = Date.now();
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 6]);
                    return [4 /*yield*/, execFileAsync("openclaw", ["models", "status", "--json"], { timeout: timeoutMs, windowsHide: true, maxBuffer: 2 * 1024 * 1024 })];
                case 2:
                    stdout = (_c.sent()).stdout;
                    return [2 /*return*/, { stdout: String(stdout !== null && stdout !== void 0 ? stdout : ""), elapsedMs: Date.now() - start }];
                case 3:
                    _a = _c.sent();
                    return [4 /*yield*/, resolveOpenClawMjs()];
                case 4:
                    _b = _c.sent(), mjsPath = _b.mjsPath, cwd = _b.cwd;
                    return [4 /*yield*/, execFileAsync("node", [mjsPath, "models", "status", "--json"], {
                            timeout: timeoutMs,
                            windowsHide: true,
                            maxBuffer: 2 * 1024 * 1024,
                            cwd: cwd,
                        })];
                case 5:
                    stdout = (_c.sent()).stdout;
                    return [2 /*return*/, { stdout: String(stdout !== null && stdout !== void 0 ? stdout : ""), elapsedMs: Date.now() - start }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function probeAuthStatusCli(timeoutMs) {
    return __awaiter(this, void 0, void 0, function () {
        var checkedAt, stdout, parsed, providers, oauthProviders, _i, oauthProviders_1, entry, pid, rem, auth, rawProviders, _a, _b, _c, pid, v, rem, auth, _d, parsed_1, entry, pid, rem, auth;
        var _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    checkedAt = nowIso();
                    return [4 /*yield*/, runOpenClawModelsStatusJson(timeoutMs)];
                case 1:
                    stdout = (_h.sent()).stdout;
                    parsed = JSON.parse(String(stdout !== null && stdout !== void 0 ? stdout : "{}"));
                    providers = {};
                    oauthProviders = (_f = (_e = parsed === null || parsed === void 0 ? void 0 : parsed.auth) === null || _e === void 0 ? void 0 : _e.oauth) === null || _f === void 0 ? void 0 : _f.providers;
                    if (Array.isArray(oauthProviders)) {
                        for (_i = 0, oauthProviders_1 = oauthProviders; _i < oauthProviders_1.length; _i++) {
                            entry = oauthProviders_1[_i];
                            pid = entry === null || entry === void 0 ? void 0 : entry.provider;
                            if (!pid)
                                continue;
                            rem = typeof (entry === null || entry === void 0 ? void 0 : entry.remainingMs) === "number" ? entry.remainingMs : undefined;
                            auth = typeof rem === "number" ? (rem > 0 ? "ok" : "expired") : "unknown";
                            providers[String(pid)] = { auth: auth, remainingMs: rem };
                        }
                        return [2 /*return*/, { providers: providers, checkedAt: checkedAt }];
                    }
                    rawProviders = parsed === null || parsed === void 0 ? void 0 : parsed.providers;
                    if (rawProviders && typeof rawProviders === "object" && !Array.isArray(rawProviders)) {
                        for (_a = 0, _b = Object.entries(rawProviders); _a < _b.length; _a++) {
                            _c = _b[_a], pid = _c[0], v = _c[1];
                            rem = typeof (v === null || v === void 0 ? void 0 : v.remainingMs) === "number" ? v.remainingMs : undefined;
                            auth = typeof rem === "number" ? (rem > 0 ? "ok" : "expired") : "unknown";
                            providers[String(pid)] = { auth: auth, remainingMs: rem };
                        }
                        return [2 /*return*/, { providers: providers, checkedAt: checkedAt }];
                    }
                    if (Array.isArray(parsed)) {
                        for (_d = 0, parsed_1 = parsed; _d < parsed_1.length; _d++) {
                            entry = parsed_1[_d];
                            pid = (_g = entry === null || entry === void 0 ? void 0 : entry.provider) !== null && _g !== void 0 ? _g : entry === null || entry === void 0 ? void 0 : entry.id;
                            if (!pid)
                                continue;
                            rem = typeof (entry === null || entry === void 0 ? void 0 : entry.remainingMs) === "number" ? entry.remainingMs : undefined;
                            auth = typeof rem === "number" ? (rem > 0 ? "ok" : "expired") : "unknown";
                            providers[String(pid)] = { auth: auth, remainingMs: rem };
                        }
                    }
                    return [2 /*return*/, { providers: providers, checkedAt: checkedAt }];
            }
        });
    });
}
function runAuthProbeAndUpdateCache(params) {
    return __awaiter(this, void 0, void 0, function () {
        var snap;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, probeAuthStatusCli(params.timeoutMs)];
                case 1:
                    snap = _a.sent();
                    authCache = {
                        value: snap,
                        expiresAtMs: Date.now() + params.ttlMs,
                        lastOkAtMs: Date.now(),
                    };
                    return [2 /*return*/, snap];
            }
        });
    });
}
function getAuthSnapshot(params) {
    return __awaiter(this, void 0, void 0, function () {
        var now, cache, cacheValid, cacheAgeMs, ensureRefreshScheduled, ageOk, snap, _a, snap;
        var _this = this;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    now = Date.now();
                    cache = authCache;
                    cacheValid = Boolean(cache && cache.expiresAtMs > now);
                    cacheAgeMs = ((_b = cache === null || cache === void 0 ? void 0 : cache.value) === null || _b === void 0 ? void 0 : _b.checkedAt) ? now - Date.parse(cache.value.checkedAt) : undefined;
                    ensureRefreshScheduled = function () {
                        if (authProbeInFlight) {
                            // observability: already refreshing
                            (function () { return __awaiter(_this, void 0, void 0, function () {
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _b.trys.push([0, 2, , 3]);
                                            return [4 /*yield*/, appendJsonl(params.api, {
                                                    ts: nowIso(),
                                                    type: "soft_router_suggest",
                                                    event: "availability_refresh_skip",
                                                    reason: "in_flight",
                                                })];
                                        case 1:
                                            _b.sent();
                                            return [3 /*break*/, 3];
                                        case 2:
                                            _a = _b.sent();
                                            return [3 /*break*/, 3];
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); })();
                            return;
                        }
                        (function () { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, appendJsonl(params.api, {
                                                ts: nowIso(),
                                                type: "soft_router_suggest",
                                                event: "availability_refresh_scheduled",
                                                ttlMs: params.ttlMs,
                                            })];
                                    case 1:
                                        _b.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        _a = _b.sent();
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); })();
                        authProbeInFlight = (function () { return __awaiter(_this, void 0, void 0, function () {
                            var startMs, _a, snap, _b, err_1, _c;
                            var _d, _e;
                            return __generator(this, function (_f) {
                                switch (_f.label) {
                                    case 0:
                                        startMs = Date.now();
                                        _f.label = 1;
                                    case 1:
                                        _f.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, appendJsonl(params.api, {
                                                ts: nowIso(),
                                                type: "soft_router_suggest",
                                                event: "availability_refresh_start",
                                            })];
                                    case 2:
                                        _f.sent();
                                        return [3 /*break*/, 4];
                                    case 3:
                                        _a = _f.sent();
                                        return [3 /*break*/, 4];
                                    case 4:
                                        _f.trys.push([4, 10, 15, 16]);
                                        return [4 /*yield*/, runAuthProbeAndUpdateCache({
                                                api: params.api,
                                                ttlMs: params.ttlMs,
                                                timeoutMs: params.timeoutMs,
                                            })];
                                    case 5:
                                        snap = _f.sent();
                                        _f.label = 6;
                                    case 6:
                                        _f.trys.push([6, 8, , 9]);
                                        return [4 /*yield*/, appendJsonl(params.api, {
                                                ts: nowIso(),
                                                type: "soft_router_suggest",
                                                event: "availability_refresh_ok",
                                                elapsedMs: Date.now() - startMs,
                                                providers: Object.keys((_d = snap.providers) !== null && _d !== void 0 ? _d : {}).length,
                                            })];
                                    case 7:
                                        _f.sent();
                                        return [3 /*break*/, 9];
                                    case 8:
                                        _b = _f.sent();
                                        return [3 /*break*/, 9];
                                    case 9: return [2 /*return*/, snap];
                                    case 10:
                                        err_1 = _f.sent();
                                        _f.label = 11;
                                    case 11:
                                        _f.trys.push([11, 13, , 14]);
                                        return [4 /*yield*/, appendJsonl(params.api, {
                                                ts: nowIso(),
                                                type: "soft_router_suggest",
                                                event: "availability_probe_error",
                                                message: err_1 instanceof Error ? err_1.message : String(err_1),
                                                code: err_1 === null || err_1 === void 0 ? void 0 : err_1.code,
                                                killed: err_1 === null || err_1 === void 0 ? void 0 : err_1.killed,
                                                signal: err_1 === null || err_1 === void 0 ? void 0 : err_1.signal,
                                                stderr: typeof (err_1 === null || err_1 === void 0 ? void 0 : err_1.stderr) === "string" ? err_1.stderr.slice(0, 500) : undefined,
                                            })];
                                    case 12:
                                        _f.sent();
                                        return [3 /*break*/, 14];
                                    case 13:
                                        _c = _f.sent();
                                        return [3 /*break*/, 14];
                                    case 14: return [2 /*return*/, (_e = authCache === null || authCache === void 0 ? void 0 : authCache.value) !== null && _e !== void 0 ? _e : { providers: {}, checkedAt: nowIso() }];
                                    case 15:
                                        authProbeInFlight = null;
                                        return [7 /*endfinally*/];
                                    case 16: return [2 /*return*/];
                                }
                            });
                        }); })();
                    };
                    if (cacheValid) {
                        return [2 /*return*/, { snapshot: cache.value, source: "cache", stale: false, cacheAgeMs: cacheAgeMs }];
                    }
                    if (params.asyncEnabled) {
                        // Non-blocking: schedule refresh and immediately return cached/unknown snapshot.
                        ensureRefreshScheduled();
                        // If cache exists and is not too stale, return it with stale=true.
                        if (cache) {
                            ageOk = params.maxStaleMs <= 0 ? false : now - cache.expiresAtMs <= params.maxStaleMs;
                            if (ageOk) {
                                return [2 /*return*/, { snapshot: cache.value, source: "cache", stale: true, cacheAgeMs: cacheAgeMs }];
                            }
                        }
                        return [2 /*return*/, { snapshot: { providers: {}, checkedAt: nowIso() }, source: "cache", stale: true }];
                    }
                    // Blocking mode (legacy): wait for probe.
                    ensureRefreshScheduled();
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, authProbeInFlight];
                case 2:
                    snap = _d.sent();
                    return [2 /*return*/, { snapshot: snap, source: "probe", stale: false }];
                case 3:
                    _a = _d.sent();
                    snap = (_c = authCache === null || authCache === void 0 ? void 0 : authCache.value) !== null && _c !== void 0 ? _c : { providers: {}, checkedAt: nowIso() };
                    return [2 /*return*/, { snapshot: snap, source: "cache", stale: true, cacheAgeMs: cacheAgeMs }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Legacy classification config loader removed (fully converged to keyword-library routing).
/**
 * Classification (async)
 *
 * Fully converged routing:
 * - Weighted keyword library only (keyword-library.json + optional keyword-overrides.user.json)
 */
function classifyDynamic(api, content, metadata) {
    return __awaiter(this, void 0, void 0, function () {
        var cfgAny, _a, compiled, warnings, decision, model, signals, err_2, err_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 5, , 6]);
                    cfgAny = resolveConfig(api);
                    if (!cfgAny.keywordCustomEnabled) return [3 /*break*/, 4];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, keyword_library_ts_1.loadAndCompileRoutingRules)({
                            libraryPath: cfgAny.keywordLibraryPath,
                            overridesPath: cfgAny.keywordOverridesPath,
                        })];
                case 2:
                    _a = _b.sent(), compiled = _a.compiled, warnings = _a.warnings;
                    decision = (0, weighted_routing_engine_ts_1.routeByWeightedRules)({
                        rules: compiled,
                        content: content,
                        metadata: metadata,
                        maxExplainTerms: 10,
                    });
                    model = "local-proxy/gpt-5.2";
                    signals = __spreadArray(__spreadArray([
                        "weighted_keyword_library"
                    ], decision.signals, true), (warnings.length ? ["keyword_library_warnings"] : []), true);
                    return [2 /*return*/, {
                            kind: decision.kind,
                            model: model,
                            reason: decision.reason + (warnings.length ? " (warnings=".concat(warnings.length, ")") : ""),
                            signals: signals,
                            confidence: decision.confidence,
                        }];
                case 3:
                    err_2 = _b.sent();
                    // Fully converged: do not fall back to legacy classifier.
                    return [2 /*return*/, {
                            kind: "fallback",
                            model: "local-proxy/gpt-5.2",
                            reason: "Keyword-library classification error: ".concat(err_2 instanceof Error ? err_2.message : String(err_2)),
                            signals: ["error_fallback", "weighted_keyword_library"],
                            confidence: "low",
                        }];
                case 4: 
                // Fully converged: keyword routing is required; if disabled, we still do not load legacy rules.
                return [2 /*return*/, {
                        kind: "fallback",
                        model: "local-proxy/gpt-5.2",
                        reason: "Keyword-library routing disabled (keywordCustomEnabled=false); using fallback.",
                        signals: ["fallback:keyword_routing_disabled"],
                        confidence: "low",
                    }];
                case 5:
                    err_3 = _b.sent();
                    return [2 /*return*/, {
                            kind: "fallback",
                            model: "local-proxy/gpt-5.2",
                            reason: "Classification error: ".concat(err_3 instanceof Error ? err_3.message : String(err_3)),
                            signals: ["error_fallback"],
                            confidence: "low",
                        }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function pickFallbackModel(kind) {
    // Keep it simple and reliable: always use gpt-5.2 as the hard fallback.
    return "local-proxy/gpt-5.2";
}
function computeAvailability(params) {
    return __awaiter(this, void 0, void 0, function () {
        var checkedAt, provider, _a, snapshot, source, stale, cacheAgeMs, providerInfo, auth, status_1, note_1, note, status;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    checkedAt = nowIso();
                    provider = providerFromModel(params.suggestion.model);
                    if (!(params.cfg.availabilityMode === "cli")) return [3 /*break*/, 2];
                    return [4 /*yield*/, getAuthSnapshot({
                            api: params.api,
                            ttlMs: params.cfg.availabilityTtlMs,
                            timeoutMs: params.cfg.availabilityCmdTimeoutMs,
                            asyncEnabled: params.cfg.availabilityAsyncEnabled,
                            maxStaleMs: params.cfg.availabilityMaxStaleMs,
                        })];
                case 1:
                    _a = _c.sent(), snapshot = _a.snapshot, source = _a.source, stale = _a.stale, cacheAgeMs = _a.cacheAgeMs;
                    providerInfo = snapshot.providers[provider];
                    auth = (_b = providerInfo === null || providerInfo === void 0 ? void 0 : providerInfo.auth) !== null && _b !== void 0 ? _b : "unknown";
                    status_1 = auth === "expired" ? "degraded" : auth === "ok" ? "ok" : "unknown";
                    note_1 = auth === "expired"
                        ? "Auth appears expired for provider \"".concat(provider, "\"; suggested model may fail. Consider fallback.")
                        : undefined;
                    return [2 /*return*/, {
                            status: status_1,
                            auth: auth,
                            source: source,
                            checkedAt: checkedAt,
                            ttlMs: params.cfg.availabilityTtlMs,
                            stale: stale,
                            cacheAgeMs: cacheAgeMs,
                            note: note_1,
                        }];
                case 2:
                    status = "unknown";
                    if (provider === "openai-codex") {
                        status = "ok";
                    }
                    if (provider === "qwen-portal") {
                        note = "Provider \"".concat(provider, "\" may require valid auth; availability not probed (static mode).");
                    }
                    return [2 /*return*/, {
                            status: status,
                            auth: "unknown",
                            source: "static",
                            checkedAt: checkedAt,
                            ttlMs: params.cfg.availabilityTtlMs,
                            note: note,
                        }];
            }
        });
    });
}
function preview(text, n) {
    var t = (text !== null && text !== void 0 ? text : "").replace(/\r\n/g, "\n");
    if (t.length <= n)
        return t;
    return t.slice(0, n) + "... (+".concat(t.length - n, " chars)");
}
function appendJsonl(api, obj) {
    return __awaiter(this, void 0, void 0, function () {
        var cfg, logDir, logPath, _a, cur, tailBuf, lines, lastLine, prev, sameSession, samePicked, t1, t2, close_1, _b;
        var _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    cfg = resolveConfig(api);
                    if (!cfg.enabled)
                        return [2 /*return*/];
                    logDir = cfg.logDir;
                    logPath = path.join(logDir, cfg.logFile);
                    return [4 /*yield*/, fs.mkdir(logDir, { recursive: true })];
                case 1:
                    _j.sent();
                    _j.label = 2;
                case 2:
                    _j.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, maybeRotate(logPath, cfg.maxBytes, cfg.rotateCount)];
                case 3:
                    _j.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _a = _j.sent();
                    return [3 /*break*/, 5];
                case 5:
                    _j.trys.push([5, 8, , 9]);
                    cur = obj;
                    if (!((cur === null || cur === void 0 ? void 0 : cur.type) === "soft_router_suggest" && (cur === null || cur === void 0 ? void 0 : cur.event) === "model_override")) return [3 /*break*/, 7];
                    return [4 /*yield*/, fs.readFile(logPath, "utf8").catch(function () { return ""; })];
                case 6:
                    tailBuf = _j.sent();
                    if (tailBuf) {
                        lines = tailBuf.trimEnd().split(/\r?\n/);
                        lastLine = lines.length ? lines[lines.length - 1] : "";
                        if (lastLine) {
                            prev = JSON.parse(lastLine);
                            if ((prev === null || prev === void 0 ? void 0 : prev.type) === "soft_router_suggest" && (prev === null || prev === void 0 ? void 0 : prev.event) === "model_override") {
                                sameSession = String((_c = prev === null || prev === void 0 ? void 0 : prev.sessionKey) !== null && _c !== void 0 ? _c : "") === String((_d = cur === null || cur === void 0 ? void 0 : cur.sessionKey) !== null && _d !== void 0 ? _d : "");
                                samePicked = String((_e = prev === null || prev === void 0 ? void 0 : prev.picked) !== null && _e !== void 0 ? _e : "") === String((_f = cur === null || cur === void 0 ? void 0 : cur.picked) !== null && _f !== void 0 ? _f : "");
                                t1 = Date.parse(String((_g = prev === null || prev === void 0 ? void 0 : prev.ts) !== null && _g !== void 0 ? _g : ""));
                                t2 = Date.parse(String((_h = cur === null || cur === void 0 ? void 0 : cur.ts) !== null && _h !== void 0 ? _h : ""));
                                close_1 = Number.isFinite(t1) && Number.isFinite(t2) ? Math.abs(t2 - t1) < 1500 : false;
                                if (sameSession && samePicked && close_1)
                                    return [2 /*return*/];
                            }
                        }
                    }
                    _j.label = 7;
                case 7: return [3 /*break*/, 9];
                case 8:
                    _b = _j.sent();
                    return [3 /*break*/, 9];
                case 9: return [4 /*yield*/, fs.appendFile(logPath, JSON.stringify(obj) + "\n", "utf8")];
                case 10:
                    _j.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Dedup map (in-memory, per process).
var recentOverrides = new Map();
var routeDecisionBySession = new Map();
var taskSessionStateBySession = new Map();
var ROUTE_DECISION_TTL_MS = 90000;
var RUNTIME_ROUTING_TTL_MS = 5000;
var LONG_TASK_KINDS = new Set(["strategy", "coding", "vision"]);
var runtimeRoutingCache = null;
function shouldLogModelOverride(cfg, sessionKey, pickedModel) {
    return __awaiter(this, void 0, void 0, function () {
        var memKey, now, last, baseDir, dedupDir, secondBucket, hash, marker, e_1, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    memKey = "".concat(sessionKey, ":").concat(pickedModel);
                    now = Date.now();
                    last = recentOverrides.get(memKey);
                    if (last && now - last < 1000)
                        return [2 /*return*/, false];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 7, , 8]);
                    baseDir = cfg.logDir && cfg.logDir.trim() ? cfg.logDir : os.tmpdir();
                    dedupDir = path.join(baseDir, ".dedup");
                    return [4 /*yield*/, fs.mkdir(dedupDir, { recursive: true })];
                case 2:
                    _b.sent();
                    secondBucket = Math.floor(now / 1000);
                    hash = crypto.createHash("sha1").update(memKey).digest("hex");
                    marker = path.join(dedupDir, "soft-router-model-override-".concat(hash, "-").concat(secondBucket, ".lock"));
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, fs.writeFile(marker, String(now), { encoding: "utf8", flag: "wx" })];
                case 4:
                    _b.sent();
                    return [3 /*break*/, 6];
                case 5:
                    e_1 = _b.sent();
                    if (String(e_1 === null || e_1 === void 0 ? void 0 : e_1.code) === "EEXIST")
                        return [2 /*return*/, false];
                    return [3 /*break*/, 6];
                case 6: return [3 /*break*/, 8];
                case 7:
                    _a = _b.sent();
                    return [3 /*break*/, 8];
                case 8:
                    recentOverrides.set(memKey, now);
                    return [2 /*return*/, true];
            }
        });
    });
}
function getRuntimeRoutingPath() {
    return path.join(getDefaultToolsDir(), "runtime-routing.json");
}
function getDefaultRuntimeRoutingConfig(cfg) {
    var _a;
    var taskKinds = Array.from(new Set(__spreadArray([cfg.taskModePrimaryKind], ((_a = cfg.taskModeKinds) !== null && _a !== void 0 ? _a : []), true).filter(function (value) { return String(value !== null && value !== void 0 ? value : "").trim(); })));
    return {
        taskModeEnabled: cfg.taskModeEnabled,
        taskModePrimaryKind: cfg.taskModePrimaryKind,
        taskModeKinds: taskKinds.length > 0 ? taskKinds : [DEFAULTS.taskModePrimaryKind],
        taskModeMinConfidence: cfg.taskModeMinConfidence,
        taskModeReturnToPrimary: cfg.taskModeReturnToPrimary,
        taskModeAllowAutoDowngrade: cfg.taskModeAllowAutoDowngrade,
        freeSwitchWhenTaskModeOff: cfg.freeSwitchWhenTaskModeOff,
    };
}
function getRuntimeRoutingConfig(api) {
    return __awaiter(this, void 0, void 0, function () {
        var now, cfg, defaults, runtimePath, raw, taskModePrimaryKind, taskModeKinds, value;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = Date.now();
                    if (runtimeRoutingCache && runtimeRoutingCache.expiresAtMs > now) {
                        return [2 /*return*/, runtimeRoutingCache.value];
                    }
                    cfg = resolveConfig(api);
                    defaults = getDefaultRuntimeRoutingConfig(cfg);
                    runtimePath = getRuntimeRoutingPath();
                    return [4 /*yield*/, loadJsonFile(runtimePath)];
                case 1:
                    raw = _a.sent();
                    taskModePrimaryKind = typeof (raw === null || raw === void 0 ? void 0 : raw.taskModePrimaryKind) === "string" && raw.taskModePrimaryKind.trim()
                        ? raw.taskModePrimaryKind.trim()
                        : defaults.taskModePrimaryKind;
                    taskModeKinds = Array.isArray(raw === null || raw === void 0 ? void 0 : raw.taskModeKinds)
                        ? Array.from(new Set(raw.taskModeKinds
                            .map(function (value) { return String(value !== null && value !== void 0 ? value : "").trim(); })
                            .filter(function (value) { return value.length > 0; })))
                        : defaults.taskModeKinds;
                    value = {
                        taskModeEnabled: typeof (raw === null || raw === void 0 ? void 0 : raw.taskModeEnabled) === "boolean" ? raw.taskModeEnabled : defaults.taskModeEnabled,
                        taskModePrimaryKind: taskModePrimaryKind,
                        taskModeKinds: taskModeKinds.length > 0
                            ? Array.from(new Set(__spreadArray([taskModePrimaryKind], taskModeKinds, true)))
                            : defaults.taskModeKinds,
                        taskModeMinConfidence: (raw === null || raw === void 0 ? void 0 : raw.taskModeMinConfidence) === "low" ||
                            (raw === null || raw === void 0 ? void 0 : raw.taskModeMinConfidence) === "medium" ||
                            (raw === null || raw === void 0 ? void 0 : raw.taskModeMinConfidence) === "high"
                            ? raw.taskModeMinConfidence
                            : defaults.taskModeMinConfidence,
                        taskModeReturnToPrimary: typeof (raw === null || raw === void 0 ? void 0 : raw.taskModeReturnToPrimary) === "boolean"
                            ? raw.taskModeReturnToPrimary
                            : defaults.taskModeReturnToPrimary,
                        taskModeAllowAutoDowngrade: typeof (raw === null || raw === void 0 ? void 0 : raw.taskModeAllowAutoDowngrade) === "boolean"
                            ? raw.taskModeAllowAutoDowngrade
                            : defaults.taskModeAllowAutoDowngrade,
                        freeSwitchWhenTaskModeOff: typeof (raw === null || raw === void 0 ? void 0 : raw.freeSwitchWhenTaskModeOff) === "boolean"
                            ? raw.freeSwitchWhenTaskModeOff
                            : defaults.freeSwitchWhenTaskModeOff,
                    };
                    runtimeRoutingCache = { value: value, expiresAtMs: now + RUNTIME_ROUTING_TTL_MS };
                    return [2 /*return*/, value];
            }
        });
    });
}
function pruneExpiredRouteDecisions(now) {
    if (now === void 0) { now = Date.now(); }
    for (var _i = 0, _a = routeDecisionBySession.entries(); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (!value || value.expiresAtMs <= now) {
            routeDecisionBySession.delete(key);
        }
    }
}
function confidenceRank(c) {
    return c === "high" ? 3 : c === "medium" ? 2 : 1;
}
function resolveRouteSessionKeyFromMessageContext(ctx, event) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var ctxAny = ctx;
    var metadata = ((_a = event.metadata) !== null && _a !== void 0 ? _a : {});
    var candidates = [
        ctxAny === null || ctxAny === void 0 ? void 0 : ctxAny.sessionKey,
        metadata.sessionKey,
        metadata.session_key,
        metadata.threadId,
        metadata.thread_id,
        metadata.conversationId,
        metadata.conversation_id,
        ctx.conversationId,
        metadata.chatId,
        metadata.chat_id,
    ];
    for (var _i = 0, candidates_2 = candidates; _i < candidates_2.length; _i++) {
        var value = candidates_2[_i];
        var text = String(value !== null && value !== void 0 ? value : "").trim();
        if (text)
            return text;
    }
    var provider = String((_c = (_b = metadata.provider) !== null && _b !== void 0 ? _b : ctx.channelId) !== null && _c !== void 0 ? _c : "unknown").trim() || "unknown";
    var accountId = String((_f = (_e = (_d = ctx.accountId) !== null && _d !== void 0 ? _d : metadata.accountId) !== null && _e !== void 0 ? _e : metadata.account_id) !== null && _f !== void 0 ? _f : "unknown").trim() || "unknown";
    var from = String((_h = (_g = event.from) !== null && _g !== void 0 ? _g : metadata.from) !== null && _h !== void 0 ? _h : "unknown").trim() || "unknown";
    return "fallback:".concat(provider, ":").concat(accountId, ":").concat(from);
}
function shouldPreventAutomaticDowngrade(candidateModel, allowAutoDowngrade) {
    if (allowAutoDowngrade)
        return false;
    var normalized = normalizeModelOverrideForProvider(candidateModel).override.toLowerCase();
    return normalized.includes("gpt-5.2");
}
function isLongTaskKind(kind) {
    return LONG_TASK_KINDS.has(String(kind !== null && kind !== void 0 ? kind : "").trim().toLowerCase());
}
function isTaskModeKind(kind, runtimeCfg) {
    var normalized = String(kind !== null && kind !== void 0 ? kind : "").trim().toLowerCase();
    return runtimeCfg.taskModeKinds.some(function (value) { return value.toLowerCase() === normalized; });
}
function getTaskPrimaryModelForSession(runtimeCfg, decision, existing) {
    if ((existing === null || existing === void 0 ? void 0 : existing.primaryKind) && (existing === null || existing === void 0 ? void 0 : existing.primaryModel)) {
        return { primaryKind: existing.primaryKind, primaryModel: existing.primaryModel };
    }
    if (isTaskModeKind(decision.kind, runtimeCfg) && decision.candidateModel) {
        return { primaryKind: decision.kind, primaryModel: decision.candidateModel };
    }
    return {
        primaryKind: runtimeCfg.taskModePrimaryKind,
        primaryModel: decision.candidateModel,
    };
}
function register(api) {
    var _this = this;
    // Immediate marker: proves the plugin was loaded and register() ran.
    // (Does not rely on any hooks being fired.)
    (function () { return __awaiter(_this, void 0, void 0, function () {
        var raw, _a;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: "plugin_register",
                            pluginId: api.id,
                            version: (_b = api.version) !== null && _b !== void 0 ? _b : "unknown",
                        })];
                case 1:
                    _d.sent();
                    raw = getRawConfig(api);
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: "config_snapshot",
                            pluginId: api.id,
                            version: (_c = api.version) !== null && _c !== void 0 ? _c : "unknown",
                            configSource: raw.source,
                            configKeys: raw.keys,
                            hasPluginConfig: Boolean(api.pluginConfig),
                            note: "For safety this logs keys only (no values).",
                        })];
                case 2:
                    _d.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _a = _d.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); })();
    // Startup marker (hook-based; may depend on the gateway calling this hook)
    api.on("gateway_start", function () { return __awaiter(_this, void 0, void 0, function () {
        var _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: "gateway_start",
                            pluginId: api.id,
                            version: (_b = api.version) !== null && _b !== void 0 ? _b : "unknown",
                        })];
                case 1:
                    _c.sent();
                    return [3 /*break*/, 3];
                case 2:
                    _a = _c.sent();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    api.on("before_agent_start", function (event, ctx) { return __awaiter(_this, void 0, void 0, function () {
        var cfg, promptText, sessionKey, promptHash, agentId, runtimeCfg, decision, targetModel, targetKind, logEvent, logNote, existingTaskState, primary, nextTaskState, qualifiesAsTask, hasTemporaryModel, okToLog, norm, _a;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 25, , 26]);
                    cfg = resolveConfig(api);
                    if (!cfg.enabled || !cfg.ruleEngineEnabled || !cfg.switchingEnabled)
                        return [2 /*return*/];
                    pruneExpiredRouteDecisions();
                    promptText = String((_b = event.prompt) !== null && _b !== void 0 ? _b : "");
                    sessionKey = String((_c = ctx === null || ctx === void 0 ? void 0 : ctx.sessionKey) !== null && _c !== void 0 ? _c : "unknown");
                    promptHash = crypto.createHash("sha1").update(promptText).digest("hex").slice(0, 16);
                    agentId = ctx === null || ctx === void 0 ? void 0 : ctx.agentId;
                    return [4 /*yield*/, getRuntimeRoutingConfig(api)];
                case 1:
                    runtimeCfg = _e.sent();
                    decision = routeDecisionBySession.get(sessionKey);
                    if (!!decision) return [3 /*break*/, 3];
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: "route_cache_miss",
                            pid: process.pid,
                            dryRun: true,
                            sessionKey: sessionKey,
                            agentId: agentId,
                            promptHash: promptHash,
                        })];
                case 2:
                    _e.sent();
                    return [2 /*return*/];
                case 3:
                    if (!(decision.expiresAtMs <= Date.now())) return [3 /*break*/, 5];
                    routeDecisionBySession.delete(sessionKey);
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: "route_cache_expired",
                            pid: process.pid,
                            dryRun: true,
                            sessionKey: sessionKey,
                            agentId: agentId,
                            promptHash: promptHash,
                            messageHash: decision.messageHash,
                        })];
                case 4:
                    _e.sent();
                    return [2 /*return*/];
                case 5: return [4 /*yield*/, appendJsonl(api, {
                        ts: nowIso(),
                        type: "soft_router_suggest",
                        event: "route_cache_hit",
                        pid: process.pid,
                        dryRun: true,
                        sessionKey: sessionKey,
                        agentId: agentId,
                        promptHash: promptHash,
                        kind: decision.kind,
                        confidence: decision.confidence,
                        candidateModel: decision.candidateModel,
                        messageHash: decision.messageHash,
                    })];
                case 6:
                    _e.sent();
                    targetModel = decision.candidateModel;
                    targetKind = decision.kind;
                    logEvent = "route_override_applied";
                    logNote = decision.reason;
                    existingTaskState = taskSessionStateBySession.get(sessionKey);
                    if (!runtimeCfg.taskModeEnabled) return [3 /*break*/, 15];
                    primary = getTaskPrimaryModelForSession(runtimeCfg, decision, existingTaskState);
                    nextTaskState = existingTaskState !== null && existingTaskState !== void 0 ? existingTaskState : {
                        sessionKey: sessionKey,
                        primaryKind: primary.primaryKind,
                        primaryModel: primary.primaryModel,
                        lastTaskAt: Date.now(),
                        lastRouteAt: Date.now(),
                    };
                    if (!!existingTaskState) return [3 /*break*/, 8];
                    taskSessionStateBySession.set(sessionKey, nextTaskState);
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: "task_mode_primary_set",
                            dryRun: true,
                            sessionKey: sessionKey,
                            agentId: agentId,
                            primaryKind: nextTaskState.primaryKind,
                            primaryModel: nextTaskState.primaryModel,
                            sourceKind: decision.kind,
                            sourceModel: decision.candidateModel,
                        })];
                case 7:
                    _e.sent();
                    _e.label = 8;
                case 8:
                    qualifiesAsTask = isTaskModeKind(decision.kind, runtimeCfg) &&
                        confidenceRank(decision.confidence) >= confidenceRank(runtimeCfg.taskModeMinConfidence);
                    if (!qualifiesAsTask) return [3 /*break*/, 11];
                    nextTaskState = __assign(__assign({}, nextTaskState), { primaryKind: nextTaskState.primaryKind || decision.kind, primaryModel: nextTaskState.primaryModel || decision.candidateModel, temporaryKind: decision.kind !== nextTaskState.primaryKind ? decision.kind : undefined, temporaryModel: decision.kind !== nextTaskState.primaryKind ? decision.candidateModel : undefined, lastTaskAt: Date.now(), lastRouteAt: Date.now() });
                    if (!shouldPreventAutomaticDowngrade(decision.candidateModel, runtimeCfg.taskModeAllowAutoDowngrade)) return [3 /*break*/, 10];
                    routeDecisionBySession.delete(sessionKey);
                    taskSessionStateBySession.set(sessionKey, nextTaskState);
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: "task_mode_downgrade_blocked",
                            pid: process.pid,
                            dryRun: true,
                            sessionKey: sessionKey,
                            agentId: agentId,
                            promptHash: promptHash,
                            kind: decision.kind,
                            confidence: decision.confidence,
                            candidateModel: decision.candidateModel,
                            primaryModel: nextTaskState.primaryModel,
                        })];
                case 9:
                    _e.sent();
                    return [2 /*return*/];
                case 10:
                    if (nextTaskState.temporaryModel && nextTaskState.temporaryModel !== nextTaskState.primaryModel) {
                        targetModel = nextTaskState.temporaryModel;
                        targetKind = (_d = nextTaskState.temporaryKind) !== null && _d !== void 0 ? _d : decision.kind;
                        logEvent = "task_mode_temp_override_applied";
                        logNote = "task mode temporary override from ".concat(nextTaskState.primaryKind, " to ").concat(targetKind);
                    }
                    else {
                        targetModel = nextTaskState.primaryModel;
                        targetKind = nextTaskState.primaryKind;
                        logEvent = "route_override_applied";
                        logNote = decision.reason;
                    }
                    taskSessionStateBySession.set(sessionKey, nextTaskState);
                    return [3 /*break*/, 14];
                case 11:
                    hasTemporaryModel = Boolean(existingTaskState === null || existingTaskState === void 0 ? void 0 : existingTaskState.temporaryModel);
                    if (!(runtimeCfg.taskModeReturnToPrimary && (existingTaskState === null || existingTaskState === void 0 ? void 0 : existingTaskState.primaryModel))) return [3 /*break*/, 12];
                    targetModel = existingTaskState.primaryModel;
                    targetKind = existingTaskState.primaryKind;
                    logEvent = hasTemporaryModel ? "task_mode_return_to_primary" : "route_override_applied";
                    logNote = hasTemporaryModel
                        ? "task mode return to primary ".concat(existingTaskState.primaryKind)
                        : "task mode keep primary ".concat(existingTaskState.primaryKind);
                    taskSessionStateBySession.set(sessionKey, __assign(__assign({}, existingTaskState), { temporaryKind: undefined, temporaryModel: undefined, lastRouteAt: Date.now() }));
                    return [3 /*break*/, 14];
                case 12:
                    if (!!runtimeCfg.freeSwitchWhenTaskModeOff) return [3 /*break*/, 14];
                    routeDecisionBySession.delete(sessionKey);
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: "route_override_skipped_non_long_task",
                            pid: process.pid,
                            dryRun: true,
                            sessionKey: sessionKey,
                            agentId: agentId,
                            promptHash: promptHash,
                            kind: decision.kind,
                            confidence: decision.confidence,
                            candidateModel: decision.candidateModel,
                        })];
                case 13:
                    _e.sent();
                    return [2 /*return*/];
                case 14: return [3 /*break*/, 21];
                case 15:
                    if (!!isLongTaskKind(decision.kind)) return [3 /*break*/, 17];
                    routeDecisionBySession.delete(sessionKey);
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: "route_override_skipped_non_long_task",
                            pid: process.pid,
                            dryRun: true,
                            sessionKey: sessionKey,
                            agentId: agentId,
                            promptHash: promptHash,
                            kind: decision.kind,
                            confidence: decision.confidence,
                            candidateModel: decision.candidateModel,
                        })];
                case 16:
                    _e.sent();
                    return [2 /*return*/];
                case 17:
                    if (!(confidenceRank(decision.confidence) < confidenceRank("medium"))) return [3 /*break*/, 19];
                    routeDecisionBySession.delete(sessionKey);
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: "route_override_skipped_low_confidence",
                            pid: process.pid,
                            dryRun: true,
                            sessionKey: sessionKey,
                            agentId: agentId,
                            promptHash: promptHash,
                            kind: decision.kind,
                            confidence: decision.confidence,
                            candidateModel: decision.candidateModel,
                            minConfidence: "medium",
                        })];
                case 18:
                    _e.sent();
                    return [2 /*return*/];
                case 19:
                    if (!shouldPreventAutomaticDowngrade(decision.candidateModel, false)) return [3 /*break*/, 21];
                    routeDecisionBySession.delete(sessionKey);
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: "route_override_skipped_downgrade_guard",
                            pid: process.pid,
                            dryRun: true,
                            sessionKey: sessionKey,
                            agentId: agentId,
                            promptHash: promptHash,
                            kind: decision.kind,
                            confidence: decision.confidence,
                            candidateModel: decision.candidateModel,
                        })];
                case 20:
                    _e.sent();
                    return [2 /*return*/];
                case 21: return [4 /*yield*/, shouldLogModelOverride({ logDir: cfg.logDir }, sessionKey, targetModel)];
                case 22:
                    okToLog = _e.sent();
                    norm = normalizeModelOverrideForProvider(targetModel);
                    if (!okToLog) return [3 /*break*/, 24];
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: logEvent,
                            pid: process.pid,
                            dryRun: false,
                            sessionKey: sessionKey,
                            agentId: agentId,
                            promptHash: promptHash,
                            messageHash: decision.messageHash,
                            kind: targetKind,
                            confidence: decision.confidence,
                            picked: targetModel,
                            normalizedPicked: norm.override,
                            note: logNote,
                        })];
                case 23:
                    _e.sent();
                    _e.label = 24;
                case 24:
                    routeDecisionBySession.delete(sessionKey);
                    try {
                        if (norm.normalizedFrom) {
                            console.log("[soft-router-suggest] route_override_normalized from=".concat(norm.normalizedFrom, " to=").concat(norm.override, " sessionKey=").concat(sessionKey));
                        }
                        console.log("[soft-router-suggest] route_override sessionKey=".concat(sessionKey, " agentId=").concat(String(agentId !== null && agentId !== void 0 ? agentId : ""), " kind=").concat(targetKind, " confidence=").concat(decision.confidence, " picked=").concat(targetModel, " promptHash=").concat(promptHash));
                    }
                    catch (_f) {
                        // ignore
                    }
                    return [2 /*return*/, { modelOverride: norm.override }];
                case 25:
                    _a = _e.sent();
                    return [2 /*return*/];
                case 26: return [2 /*return*/];
            }
        });
    }); });
    api.on("message_received", function (event, ctx) { return __awaiter(_this, void 0, void 0, function () {
        var suggestion, cfg, tagsFile, priorityFile, catalog, providerAuth, picked, currentSignals, missingTags, now, _a, contentPreview, _b, fallbackModel, _c, routeSessionKey, runtimeCfg, messageMetadata, rawMessageId, messageId, messageHash, now, err_4, _d;
        var _e, _f, _g, _h, _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    _l.trys.push([0, 18, , 23]);
                    pruneExpiredRouteDecisions();
                    return [4 /*yield*/, classifyDynamic(api, event.content, event.metadata)];
                case 1:
                    suggestion = _l.sent();
                    cfg = resolveConfig(api);
                    if (!cfg.ruleEngineEnabled) return [3 /*break*/, 9];
                    _l.label = 2;
                case 2:
                    _l.trys.push([2, 8, , 9]);
                    return [4 /*yield*/, loadJsonFile(cfg.modelTagsPath)];
                case 3:
                    tagsFile = _l.sent();
                    return [4 /*yield*/, loadJsonFile(cfg.modelPriorityPath)];
                case 4:
                    priorityFile = _l.sent();
                    return [4 /*yield*/, getModelCatalog(api, cfg)];
                case 5:
                    catalog = _l.sent();
                    providerAuth = buildProviderAuthMapFromSnapshot((_e = authCache === null || authCache === void 0 ? void 0 : authCache.value) !== null && _e !== void 0 ? _e : null);
                    picked = pickByPriority({
                        kind: suggestion.kind,
                        catalog: catalog,
                        priorityFile: priorityFile,
                        classificationConfig: null,
                        providerAuth: providerAuth,
                    });
                    if (picked.picked && picked.picked !== suggestion.model) {
                        suggestion.model = picked.picked;
                        suggestion.reason = "Rule-engine (priority) pick. ".concat(picked.note);
                    }
                    else {
                        suggestion.reason = "Rule-engine (priority) no override. ".concat(picked.note);
                    }
                    currentSignals = Array.isArray(suggestion.signals) ? suggestion.signals : [];
                    suggestion.signals = Array.from(new Set(__spreadArray(__spreadArray([], currentSignals, true), ["rule_engine_priority"], false)));
                    if (!cfg.setupPromptEnabled) return [3 /*break*/, 7];
                    missingTags = listMissingManualTags({ catalog: catalog, tagsFile: tagsFile });
                    if (!(missingTags.length > 0)) return [3 /*break*/, 7];
                    now = Date.now();
                    if (!(now - lastSetupPromptAtMs > 60000)) return [3 /*break*/, 7];
                    lastSetupPromptAtMs = now;
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: "model_tags_missing",
                            count: missingTags.length,
                            sample: missingTags.slice(0, cfg.setupPromptMaxModels),
                            note: "Some models in catalog have no manual tags; add tags via ops.ps1 tags-set to improve rule-engine recommendations.",
                        })];
                case 6:
                    _l.sent();
                    _l.label = 7;
                case 7: return [3 /*break*/, 9];
                case 8:
                    _a = _l.sent();
                    return [3 /*break*/, 9];
                case 9:
                    contentPreview = cfg.previewChars > 0 ? preview(event.content, cfg.previewChars) : undefined;
                    if (!cfg.availabilityEnabled) return [3 /*break*/, 13];
                    _l.label = 10;
                case 10:
                    _l.trys.push([10, 12, , 13]);
                    _b = suggestion;
                    return [4 /*yield*/, computeAvailability({ api: api, suggestion: suggestion, cfg: cfg })];
                case 11:
                    _b.availability = _l.sent();
                    // If auth looks expired for the suggested provider, emit a clear fallback suggestion.
                    if (suggestion.availability.auth === "expired") {
                        fallbackModel = pickFallbackModel(suggestion.kind);
                        if (fallbackModel && fallbackModel !== suggestion.model) {
                            suggestion.fallback = {
                                model: fallbackModel,
                                reason: "Suggested provider auth appears expired; this is a safer fallback suggestion (still dry-run).",
                            };
                        }
                    }
                    return [3 /*break*/, 13];
                case 12:
                    _c = _l.sent();
                    return [3 /*break*/, 13];
                case 13:
                    // Store last suggestion for this conversation (after availability/fallback filled).
                    if (ctx.conversationId) {
                        lastSuggestionByConversation.set(ctx.conversationId, suggestion);
                    }
                    routeSessionKey = resolveRouteSessionKeyFromMessageContext(ctx, event);
                    return [4 /*yield*/, getRuntimeRoutingConfig(api)];
                case 14:
                    runtimeCfg = _l.sent();
                    messageMetadata = ((_f = event.metadata) !== null && _f !== void 0 ? _f : {});
                    rawMessageId = (_h = (_g = messageMetadata.messageId) !== null && _g !== void 0 ? _g : messageMetadata.message_id) !== null && _h !== void 0 ? _h : messageMetadata.id;
                    messageId = typeof rawMessageId === "string" ? rawMessageId : undefined;
                    messageHash = crypto
                        .createHash("sha1")
                        .update(String((_j = event.content) !== null && _j !== void 0 ? _j : ""))
                        .digest("hex")
                        .slice(0, 16);
                    if (!routeSessionKey) return [3 /*break*/, 16];
                    now = Date.now();
                    routeDecisionBySession.set(routeSessionKey, {
                        sessionKey: routeSessionKey,
                        conversationId: ctx.conversationId,
                        channelId: ctx.channelId,
                        messageId: messageId,
                        messageHash: messageHash,
                        contentPreview: preview(event.content, 120),
                        kind: suggestion.kind,
                        confidence: suggestion.confidence,
                        candidateModel: suggestion.model,
                        reason: suggestion.reason,
                        signals: Array.isArray(suggestion.signals) ? suggestion.signals : [],
                        createdAtMs: now,
                        expiresAtMs: now + ROUTE_DECISION_TTL_MS,
                        source: "message_received",
                    });
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: "route_decision_cached",
                            dryRun: true,
                            sessionKey: routeSessionKey,
                            channelId: ctx.channelId,
                            accountId: ctx.accountId,
                            conversationId: ctx.conversationId,
                            messageId: messageId,
                            messageHash: messageHash,
                            kind: suggestion.kind,
                            confidence: suggestion.confidence,
                            candidateModel: suggestion.model,
                            expiresInMs: ROUTE_DECISION_TTL_MS,
                            taskModeEnabled: runtimeCfg.taskModeEnabled,
                            taskModePrimaryKind: runtimeCfg.taskModePrimaryKind,
                            taskModeKinds: runtimeCfg.taskModeKinds,
                            taskModeMinConfidence: runtimeCfg.taskModeMinConfidence,
                        })];
                case 15:
                    _l.sent();
                    _l.label = 16;
                case 16: return [4 /*yield*/, appendJsonl(api, {
                        ts: nowIso(),
                        type: "soft_router_suggest",
                        event: "message_received",
                        dryRun: true,
                        channelId: ctx.channelId,
                        accountId: ctx.accountId,
                        conversationId: ctx.conversationId,
                        from: event.from,
                        contentPreview: contentPreview,
                        contentLength: ((_k = event.content) !== null && _k !== void 0 ? _k : "").length,
                        suggestion: suggestion,
                    })];
                case 17:
                    _l.sent();
                    return [3 /*break*/, 23];
                case 18:
                    err_4 = _l.sent();
                    _l.label = 19;
                case 19:
                    _l.trys.push([19, 21, , 22]);
                    return [4 /*yield*/, appendJsonl(api, {
                            ts: nowIso(),
                            type: "soft_router_suggest",
                            event: "error",
                            dryRun: true,
                            message: err_4 instanceof Error ? err_4.message : String(err_4),
                        })];
                case 20:
                    _l.sent();
                    return [3 /*break*/, 22];
                case 21:
                    _d = _l.sent();
                    return [3 /*break*/, 22];
                case 22: return [3 /*break*/, 23];
                case 23: return [2 /*return*/];
            }
        });
    }); });
    api.on("message_sending", function (event, ctx) { return __awaiter(_this, void 0, void 0, function () {
        var cfg, suggestion, auth, parts, now, tagsFile, catalog, known_1, missing, _loop_1, _i, missing_1, m, _a, footer, _b;
        var _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    _j.trys.push([0, 7, , 8]);
                    cfg = resolveConfig(api);
                    if (!cfg.enabled || !cfg.echoEnabled)
                        return [2 /*return*/];
                    if (cfg.echoWhen === "never")
                        return [2 /*return*/];
                    if (!ctx.conversationId)
                        return [2 /*return*/];
                    suggestion = lastSuggestionByConversation.get(ctx.conversationId);
                    if (!suggestion)
                        return [2 /*return*/];
                    auth = (_c = suggestion.availability) === null || _c === void 0 ? void 0 : _c.auth;
                    if (cfg.echoWhen === "on_expired" && auth !== "expired")
                        return [2 /*return*/];
                    parts = [];
                    parts.push("\n\n---\n");
                    parts.push("[router] kind=".concat(suggestion.kind, " confidence=").concat(suggestion.confidence, " suggested=").concat(suggestion.model));
                    if (suggestion.availability) {
                        parts.push("availability=".concat(suggestion.availability.status, "/").concat((_d = suggestion.availability.auth) !== null && _d !== void 0 ? _d : "unknown", " source=").concat(suggestion.availability.source, " stale=").concat((_e = suggestion.availability.stale) !== null && _e !== void 0 ? _e : false));
                    }
                    if ((_f = suggestion.fallback) === null || _f === void 0 ? void 0 : _f.model) {
                        parts.push("fallback=".concat(suggestion.fallback.model));
                    }
                    if (suggestion.reason) {
                        parts.push("reason=".concat(suggestion.reason));
                    }
                    if (!(cfg.setupPromptEnabled && cfg.ruleEngineEnabled)) return [3 /*break*/, 6];
                    _j.label = 1;
                case 1:
                    _j.trys.push([1, 5, , 6]);
                    now = Date.now();
                    if (!(now - lastSetupPromptAtMs > 10 * 60000)) return [3 /*break*/, 4];
                    return [4 /*yield*/, loadJsonFile(cfg.modelTagsPath)];
                case 2:
                    tagsFile = _j.sent();
                    return [4 /*yield*/, getModelCatalog(api, cfg)];
                case 3:
                    catalog = _j.sent();
                    known_1 = new Set(Object.keys((_g = tagsFile === null || tagsFile === void 0 ? void 0 : tagsFile.models) !== null && _g !== void 0 ? _g : {}));
                    missing = catalog.models
                        .map(function (m) { return m.key; })
                        .filter(function (k) { return k && !known_1.has(k); })
                        .slice(0, cfg.setupPromptMaxModels);
                    if (missing.length > 0) {
                        lastSetupPromptAtMs = now;
                        parts.push("setup: detected models without tags 鈫?add via ops.ps1 tags-set");
                        _loop_1 = function (m) {
                            var entry = catalog.models.find(function (x) { return x.key === m; });
                            var inferred = entry ? inferTagsFromCatalog(entry) : [];
                            parts.push("- ".concat(m, "  tags? (suggest: ").concat(inferred.slice(0, 6).join(","), ")  cmd: ops.ps1 tags-set \"").concat(m, "\" \"").concat(inferred.join(","), "\""));
                        };
                        for (_i = 0, missing_1 = missing; _i < missing_1.length; _i++) {
                            m = missing_1[_i];
                            _loop_1(m);
                        }
                    }
                    _j.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    _a = _j.sent();
                    return [3 /*break*/, 6];
                case 6:
                    footer = parts.join("\n");
                    if (footer.length > cfg.echoMaxChars) {
                        footer = footer.slice(0, cfg.echoMaxChars) + "…";
                    }
                    // Avoid double-echo.
                    if (typeof event.content === "string" && event.content.includes("[router]")) {
                        return [2 /*return*/];
                    }
                    return [2 /*return*/, { content: String((_h = event.content) !== null && _h !== void 0 ? _h : "") + footer }];
                case 7:
                    _b = _j.sent();
                    return [2 /*return*/];
                case 8: return [2 /*return*/];
            }
        });
    }); });
}
