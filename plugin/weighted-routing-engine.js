"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeByWeightedRules = routeByWeightedRules;
function normalizeContent(s) {
    var raw = String(s !== null && s !== void 0 ? s : "");
    return { raw: raw, lower: raw.toLowerCase() };
}
function hasImage(metadata) {
    var _a;
    return (metadata === null || metadata === void 0 ? void 0 : metadata.hasImage) === true || String((_a = metadata === null || metadata === void 0 ? void 0 : metadata.mediaType) !== null && _a !== void 0 ? _a : "").toLowerCase().includes("image");
}
function hasCodeBlock(content) {
    return String(content !== null && content !== void 0 ? content : "").includes("```");
}
function contentContains(content, term) {
    if (!term)
        return false;
    // We keep matching simple: contains on both raw and lowercased.
    // This preserves CN/EN behavior with minimal surprises.
    return content.raw.includes(term) || content.lower.includes(term.toLowerCase());
}
function topN(arr, n) {
    return arr.length <= n ? arr : arr.slice(0, n);
}
function computeConfidence(score, thresholds) {
    if (score >= thresholds.highScore)
        return "high";
    if (score >= thresholds.minScore)
        return "medium";
    return "low";
}
function isStrongGroup(group) {
    // Convention: strong groups use weight >= 3 OR set name ends with '.strong'
    return group.weight >= 3 || group.sourceSet.endsWith(".strong");
}
function scoreKind(kind, content, metadata) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    var score = 0;
    var strongHits = 0;
    var hits = 0;
    var matched = {
        positive: [],
        negative: [],
        metadata: [],
        regex: [],
    };
    var signals = [];
    // Metadata signals
    for (var _i = 0, _m = (_a = kind.metadata) !== null && _a !== void 0 ? _a : []; _i < _m.length; _i++) {
        var m = _m[_i];
        var val = m.field === "hasImage" ? hasImage(metadata) : m.field === "hasCodeBlock" ? hasCodeBlock(content.raw) : false;
        if (val === m.equals) {
            if (m.exclude)
                return { eligible: false, score: 0, strongHits: 0, hits: 0, matched: matched, signals: [] };
            score += m.weight;
            hits += 1;
            matched.metadata.push({ field: m.field, weight: m.weight });
            signals.push("meta:".concat(m.field, "(").concat(m.weight, ")"));
        }
    }
    // Regex signals
    for (var _o = 0, _p = (_b = kind.regex) !== null && _b !== void 0 ? _b : []; _o < _p.length; _o++) {
        var r = _p[_o];
        if (!r.pattern)
            continue;
        try {
            var re = new RegExp(r.pattern, (_c = r.flags) !== null && _c !== void 0 ? _c : "i");
            if (re.test(content.raw)) {
                score += r.weight;
                hits += 1;
                matched.regex.push({ pattern: r.pattern, weight: r.weight });
                signals.push("re:".concat(r.pattern, "(").concat(r.weight, ")"));
            }
        }
        catch (_q) {
            // ignore invalid regex
        }
    }
    // Positive keyword groups
    for (var _r = 0, _s = (_d = kind.positive) !== null && _d !== void 0 ? _d : []; _r < _s.length; _r++) {
        var group = _s[_r];
        for (var _t = 0, _u = (_e = group.keywords) !== null && _e !== void 0 ? _e : []; _t < _u.length; _t++) {
            var term = _u[_t];
            if (!term)
                continue;
            if (contentContains(content, term)) {
                if (group.exclude)
                    return { eligible: false, score: 0, strongHits: 0, hits: 0, matched: matched, signals: [] };
                score += group.weight;
                hits += 1;
                if (isStrongGroup(group))
                    strongHits += 1;
                matched.positive.push({ set: group.sourceSet, term: term, weight: group.weight });
                // avoid flooding signals: keep a compact record
                signals.push("+".concat(group.weight, ":").concat(group.sourceSet));
                // Do NOT break: allow multiple terms to accumulate.
            }
        }
    }
    // Negative keyword groups (penalty by default)
    for (var _v = 0, _w = (_f = kind.negative) !== null && _f !== void 0 ? _f : []; _v < _w.length; _v++) {
        var group = _w[_v];
        for (var _x = 0, _y = (_g = group.keywords) !== null && _g !== void 0 ? _g : []; _x < _y.length; _x++) {
            var term = _y[_x];
            if (!term)
                continue;
            if (contentContains(content, term)) {
                if (group.exclude)
                    return { eligible: false, score: 0, strongHits: 0, hits: 0, matched: matched, signals: [] };
                score += group.weight; // negative weight
                hits += 1;
                matched.negative.push({ set: group.sourceSet, term: term, weight: group.weight });
                signals.push("".concat(group.weight, ":").concat(group.sourceSet));
            }
        }
    }
    // Threshold gating
    var minStrongHits = (_j = (_h = kind.thresholds) === null || _h === void 0 ? void 0 : _h.minStrongHits) !== null && _j !== void 0 ? _j : 0;
    var minScore = (_l = (_k = kind.thresholds) === null || _k === void 0 ? void 0 : _k.minScore) !== null && _l !== void 0 ? _l : 2;
    if (strongHits < minStrongHits)
        return { eligible: false, score: score, strongHits: strongHits, hits: hits, matched: matched, signals: signals };
    if (score < minScore)
        return { eligible: false, score: score, strongHits: strongHits, hits: hits, matched: matched, signals: signals };
    return { eligible: true, score: score, strongHits: strongHits, hits: hits, matched: matched, signals: signals };
}
function routeByWeightedRules(params) {
    var _a, _b, _c, _d, _e, _f, _g;
    var maxExplainTerms = (_a = params.maxExplainTerms) !== null && _a !== void 0 ? _a : 10;
    var contentN = normalizeContent(params.content);
    var enabledKinds = ((_b = params.rules.kinds) !== null && _b !== void 0 ? _b : []).filter(function (k) { return k.enabled !== false; });
    var best = null;
    for (var _i = 0, enabledKinds_1 = enabledKinds; _i < enabledKinds_1.length; _i++) {
        var k = enabledKinds_1[_i];
        var scored = scoreKind(k, contentN, params.metadata);
        if (!scored.eligible)
            continue;
        if (!best) {
            best = { kind: k, scored: scored };
            continue;
        }
        if (scored.score > best.scored.score) {
            best = { kind: k, scored: scored };
            continue;
        }
        if (scored.score === best.scored.score && ((_c = k.priority) !== null && _c !== void 0 ? _c : 0) > ((_d = best.kind.priority) !== null && _d !== void 0 ? _d : 0)) {
            best = { kind: k, scored: scored };
        }
    }
    if (!best) {
        return {
            kind: (_e = params.rules.defaultFallbackKind) !== null && _e !== void 0 ? _e : "chat",
            confidence: "low",
            score: 0,
            strongHits: 0,
            hits: 0,
            reason: "No kind met thresholds; using fallback.",
            signals: ["fallback:no_match"],
            matched: { positive: [], negative: [], metadata: [], regex: [] },
        };
    }
    var t = best.kind.thresholds;
    var thresholds = {
        minScore: (_f = t === null || t === void 0 ? void 0 : t.minScore) !== null && _f !== void 0 ? _f : 2,
        highScore: (_g = t === null || t === void 0 ? void 0 : t.highScore) !== null && _g !== void 0 ? _g : 6,
    };
    var conf = computeConfidence(best.scored.score, thresholds);
    var mp = topN(best.scored.matched.positive, maxExplainTerms);
    var mn = topN(best.scored.matched.negative, maxExplainTerms);
    var reason = "Weighted match: kind='".concat(best.kind.id, "' score=").concat(best.scored.score, " strongHits=").concat(best.scored.strongHits, " hits=").concat(best.scored.hits, " confidence=").concat(conf);
    return {
        kind: best.kind.id,
        confidence: conf,
        score: best.scored.score,
        strongHits: best.scored.strongHits,
        hits: best.scored.hits,
        reason: reason,
        signals: topN(best.scored.signals, 30),
        matched: {
            positive: mp,
            negative: mn,
            metadata: best.scored.matched.metadata,
            regex: best.scored.matched.regex,
        },
    };
}
