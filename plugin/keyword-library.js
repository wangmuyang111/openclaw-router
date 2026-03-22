"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultKeywordLibraryPath = defaultKeywordLibraryPath;
exports.defaultKeywordOverridesPath = defaultKeywordOverridesPath;
exports.loadAndCompileRoutingRules = loadAndCompileRoutingRules;
exports.parsePasteLines = parsePasteLines;
var fs = require("node:fs/promises");
var path = require("node:path");
var os = require("node:os");
function getOpenClawHome() {
    var _a;
    return (_a = process.env.OPENCLAW_HOME) !== null && _a !== void 0 ? _a : path.join(os.homedir(), ".openclaw");
}
function getWorkspaceDir() {
    var _a;
    return (_a = process.env.OPENCLAW_WORKSPACE) !== null && _a !== void 0 ? _a : path.join(getOpenClawHome(), "workspace");
}
function getDefaultToolsDir() {
    return path.join(getWorkspaceDir(), "tools", "soft-router-suggest");
}
function defaultKeywordLibraryPath() {
    return path.join(getDefaultToolsDir(), "keyword-library.json");
}
function defaultKeywordOverridesPath() {
    return path.join(getDefaultToolsDir(), "keyword-overrides.user.json");
}
function readJsonFile(p) {
    return __awaiter(this, void 0, void 0, function () {
        var raw;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fs.readFile(p, "utf8")];
                case 1:
                    raw = _a.sent();
                    return [2 /*return*/, JSON.parse(raw)];
            }
        });
    });
}
function normalizeTokens(list) {
    var seen = new Set();
    var out = [];
    for (var _i = 0, _a = list !== null && list !== void 0 ? list : []; _i < _a.length; _i++) {
        var raw = _a[_i];
        var t = String(raw !== null && raw !== void 0 ? raw : "").trim();
        if (!t)
            continue;
        if (seen.has(t))
            continue;
        seen.add(t);
        out.push(t);
    }
    return out;
}
function applySetOverlay(base, add, remove) {
    var rm = new Set((remove !== null && remove !== void 0 ? remove : []).map(function (x) { return String(x).trim(); }).filter(Boolean));
    var out = [];
    for (var _i = 0, _a = base !== null && base !== void 0 ? base : []; _i < _a.length; _i++) {
        var x = _a[_i];
        var t = String(x).trim();
        if (!t)
            continue;
        if (rm.has(t))
            continue;
        out.push(t);
    }
    for (var _b = 0, _c = add !== null && add !== void 0 ? add : []; _b < _c.length; _b++) {
        var x = _c[_b];
        var t = String(x).trim();
        if (!t)
            continue;
        out.push(t);
    }
    return normalizeTokens(out);
}
function loadAndCompileRoutingRules(params) {
    return __awaiter(this, void 0, void 0, function () {
        var warnings, libraryPath, overridesPath, lib, ov, _a, finalSets, _i, _b, _c, setId, baseList, overlay, _d, _e, setId, defaultFallbackKind, compiledKinds, _loop_1, _f, _g, _h, kindId, k, compiled;
        var _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9;
        return __generator(this, function (_10) {
            switch (_10.label) {
                case 0:
                    warnings = [];
                    libraryPath = (_j = params === null || params === void 0 ? void 0 : params.libraryPath) !== null && _j !== void 0 ? _j : defaultKeywordLibraryPath();
                    overridesPath = (_k = params === null || params === void 0 ? void 0 : params.overridesPath) !== null && _k !== void 0 ? _k : defaultKeywordOverridesPath();
                    return [4 /*yield*/, readJsonFile(libraryPath)];
                case 1:
                    lib = _10.sent();
                    ov = null;
                    _10.label = 2;
                case 2:
                    _10.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, readJsonFile(overridesPath)];
                case 3:
                    ov = _10.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _a = _10.sent();
                    ov = null;
                    return [3 /*break*/, 5];
                case 5:
                    finalSets = {};
                    for (_i = 0, _b = Object.entries((_l = lib.keywordSets) !== null && _l !== void 0 ? _l : {}); _i < _b.length; _i++) {
                        _c = _b[_i], setId = _c[0], baseList = _c[1];
                        overlay = (_m = ov === null || ov === void 0 ? void 0 : ov.sets) === null || _m === void 0 ? void 0 : _m[setId];
                        finalSets[setId] = applySetOverlay(baseList !== null && baseList !== void 0 ? baseList : [], overlay === null || overlay === void 0 ? void 0 : overlay.add, overlay === null || overlay === void 0 ? void 0 : overlay.remove);
                    }
                    // If overrides mention unknown sets, warn.
                    for (_d = 0, _e = Object.keys((_o = ov === null || ov === void 0 ? void 0 : ov.sets) !== null && _o !== void 0 ? _o : {}); _d < _e.length; _d++) {
                        setId = _e[_d];
                        if (!(setId in ((_p = lib.keywordSets) !== null && _p !== void 0 ? _p : {}))) {
                            warnings.push("overrides: unknown set '".concat(setId, "' (ignored)"));
                        }
                    }
                    defaultFallbackKind = String((_q = lib.defaultFallbackKind) !== null && _q !== void 0 ? _q : "chat");
                    compiledKinds = [];
                    _loop_1 = function (kindId, k) {
                        var enabledBase = k.enabled !== false;
                        var enabledOverride = (_t = (_s = ov === null || ov === void 0 ? void 0 : ov.kinds) === null || _s === void 0 ? void 0 : _s[kindId]) === null || _t === void 0 ? void 0 : _t.enabled;
                        var enabled = typeof enabledOverride === "boolean" ? enabledOverride : enabledBase;
                        var expand = function (arr, kind) {
                            var _a, _b;
                            var out = [];
                            for (var _i = 0, _c = arr !== null && arr !== void 0 ? arr : []; _i < _c.length; _i++) {
                                var s = _c[_i];
                                var setId = String((_a = s.set) !== null && _a !== void 0 ? _a : "");
                                if (!setId)
                                    continue;
                                var kw = finalSets[setId];
                                if (!kw) {
                                    warnings.push("kind '".concat(kindId, "': missing keyword set '").concat(setId, "'"));
                                    continue;
                                }
                                out.push({
                                    keywords: kw,
                                    weight: Number((_b = s.weight) !== null && _b !== void 0 ? _b : 0),
                                    match: "contains",
                                    exclude: Boolean(s.exclude),
                                    sourceSet: setId,
                                });
                            }
                            return out;
                        };
                        var thresholds = {
                            minScore: Number((_v = (_u = k.thresholds) === null || _u === void 0 ? void 0 : _u.minScore) !== null && _v !== void 0 ? _v : 2),
                            highScore: Number((_x = (_w = k.thresholds) === null || _w === void 0 ? void 0 : _w.highScore) !== null && _x !== void 0 ? _x : 6),
                            minStrongHits: Math.max(0, Math.trunc(Number((_z = (_y = k.thresholds) === null || _y === void 0 ? void 0 : _y.minStrongHits) !== null && _z !== void 0 ? _z : 0))),
                        };
                        compiledKinds.push({
                            id: String((_0 = k.id) !== null && _0 !== void 0 ? _0 : kindId),
                            name: (_1 = k.name) !== null && _1 !== void 0 ? _1 : kindId,
                            priority: Math.trunc(Number((_2 = k.priority) !== null && _2 !== void 0 ? _2 : 0)),
                            enabled: enabled,
                            positive: expand((_3 = k.signals) === null || _3 === void 0 ? void 0 : _3.positive, "positive"),
                            negative: expand((_4 = k.signals) === null || _4 === void 0 ? void 0 : _4.negative, "negative"),
                            metadata: ((_6 = (_5 = k.signals) === null || _5 === void 0 ? void 0 : _5.metadata) !== null && _6 !== void 0 ? _6 : []).map(function (m) {
                                var _a;
                                return ({
                                    field: m.field,
                                    equals: Boolean(m.equals),
                                    weight: Number((_a = m.weight) !== null && _a !== void 0 ? _a : 0),
                                    exclude: Boolean(m.exclude),
                                });
                            }),
                            regex: ((_8 = (_7 = k.signals) === null || _7 === void 0 ? void 0 : _7.regex) !== null && _8 !== void 0 ? _8 : []).map(function (r) {
                                var _a, _b, _c;
                                return ({
                                    pattern: String((_a = r.pattern) !== null && _a !== void 0 ? _a : ""),
                                    flags: String((_b = r.flags) !== null && _b !== void 0 ? _b : "i"),
                                    weight: Number((_c = r.weight) !== null && _c !== void 0 ? _c : 0),
                                });
                            }),
                            thresholds: thresholds,
                            models: { strategy: "priority_list", list: Array.isArray((_9 = k.models) === null || _9 === void 0 ? void 0 : _9.list) ? k.models.list : [] },
                        });
                    };
                    for (_f = 0, _g = Object.entries((_r = lib.kinds) !== null && _r !== void 0 ? _r : {}); _f < _g.length; _f++) {
                        _h = _g[_f], kindId = _h[0], k = _h[1];
                        _loop_1(kindId, k);
                    }
                    // Sort kinds by priority desc
                    compiledKinds.sort(function (a, b) { var _a, _b; return ((_a = b.priority) !== null && _a !== void 0 ? _a : 0) - ((_b = a.priority) !== null && _b !== void 0 ? _b : 0); });
                    compiled = {
                        version: 1,
                        compiledAt: new Date().toISOString(),
                        defaultFallbackKind: defaultFallbackKind,
                        kinds: compiledKinds,
                    };
                    return [2 /*return*/, { compiled: compiled, warnings: warnings }];
            }
        });
    });
}
function parsePasteLines(input) {
    // UI paste format: one term per line. Allow comments starting with '#'.
    // Also allow accidental comma-separated lines by splitting further.
    var lines = String(input !== null && input !== void 0 ? input : "")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map(function (l) { return l.trim(); })
        .filter(function (l) { return l && !l.startsWith("#"); });
    var out = [];
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var line = lines_1[_i];
        var parts = line
            .split(",")
            .map(function (x) { return x.trim(); })
            .filter(Boolean);
        if (parts.length === 0)
            continue;
        out.push.apply(out, parts);
    }
    return normalizeTokens(out);
}
