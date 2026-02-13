import http from 'node:http';
import { execFile } from 'node:child_process';

const PORT = Number(process.env.ROUTER_SIDECAR_PORT || 18888);
const HOST = process.env.ROUTER_SIDECAR_HOST || '127.0.0.1';

// Router model chain implemented as isolated OpenClaw agents.
// Order matches user policy.
const ROUTER_AGENTS = [
  { agentId: 'router-flash', label: 'google-antigravity/gemini-3-flash' },
  { agentId: 'router-gpt4o', label: 'github-copilot/gpt-4o' },
  { agentId: 'router-pro', label: 'google-antigravity/gemini-3-pro-high' },
  { agentId: 'router-mini', label: 'github-copilot/gpt-5-mini' },
];

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function safeJsonParse(s) {
  const raw = String(s ?? '');
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    // Try to recover JSON from noisy outputs like:
    // ```json\n{...}\n```
    // or prefix/suffix logs.
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first >= 0 && last > first) {
      const mid = raw.slice(first, last + 1);
      try {
        return { ok: true, value: JSON.parse(mid) };
      } catch {
        // ignore
      }
    }

    // try last JSON object in output
    const lastBrace = raw.lastIndexOf('{');
    if (lastBrace >= 0) {
      const tail = raw.slice(lastBrace);
      const tailLast = tail.lastIndexOf('}');
      const tailCut = tailLast >= 0 ? tail.slice(0, tailLast + 1) : tail;
      try {
        return { ok: true, value: JSON.parse(tailCut) };
      } catch {
        // ignore
      }
    }
    return { ok: false, error: 'JSON_PARSE_FAILED' };
  }
}

function compactRoutingRequestForPrompt(routingRequest) {
  const userContent = String(routingRequest?.user?.content ?? '');
  const contentPreview = userContent.length > 1500 ? userContent.slice(0, 1500) + '…' : userContent;

  const allowedModels = Array.isArray(routingRequest?.catalog?.allowedModels) ? routingRequest.catalog.allowedModels : [];
  const allowedModelsPreview = allowedModels.slice(0, 60);

  return {
    version: routingRequest?.version ?? 1,
    ts: routingRequest?.ts,
    user: {
      languageHint: routingRequest?.user?.languageHint,
      contentPreview,
    },
    signals: routingRequest?.signals,
    features: routingRequest?.features,
    policy: {
      minConfidence: routingRequest?.policy?.minConfidence,
      switchingAllowChat: routingRequest?.policy?.switchingAllowChat,
      fallbackMode: routingRequest?.policy?.fallbackMode,
      routerTimeoutMs: routingRequest?.policy?.routerTimeoutMs,
    },
    catalog: {
      allowedModelsCount: allowedModels.length,
      allowedModelsPreview,
      // NOTE: Never include providerAuth/secrets in router prompts.
    },
  };
}

function buildRouterPrompt(routingRequest) {
  // Keep prompt compact but strict.
  // IMPORTANT: We do NOT pass providerAuth or full catalogs into the router agent.
  const compact = compactRoutingRequestForPrompt(routingRequest);
  return [
    'SYSTEM (MUST FOLLOW):',
    '- You are a Router LLM. Your job is to choose the best execution model.',
    '- The keyword-category features are weak signals for reference only. Do NOT treat them as deterministic rules.',
    '- You MUST make an independent judgment based on the user request and other signals.',
    '- You MUST select selected_model from catalog.allowedModelsPreview when possible.',
    '- If unsure, pick from fallback_models and set confidence=low/medium accordingly.',
    '- If you disagree with the features, explain why in why_not and lower confidence accordingly.',
    '- Output MUST be valid JSON only (no markdown, no extra text).',
    '- Do NOT wrap the JSON in code fences (no ```json ... ```).',
    '',
    '中文约束（必须遵守）:',
    '- features（关键词命中/分类统计）只是参考弱信号，不是决定性规则。你必须独立判断。',
    '- 尽量从 catalog.allowedModelsPreview 里选择 selected_model；不确定时用 fallback_models 并降低置信度。',
    '- 若结论与 features 不一致，必须解释原因并下调置信度。',
    '- 只输出 JSON，不要输出多余文字。',
    '- 不要用代码块包裹（不要输出 ```json ... ```）。',
    '',
    'routing_request (COMPACT) JSON:',
    JSON.stringify(compact),
    '',
    'Return router_response JSON with fields:',
    '{"version":1,"selected_kind":"...","selected_model":"provider/model","confidence":"low|medium|high","reason":"...","why_not":["..."],"fallback_models":["..."]}',
  ].join('\n');
}

const agentSkipUntilMs = new Map();

function isCooldownLike(text) {
  const t = String(text || '').toLowerCase();
  return (
    t.includes('no available auth profile') ||
    t.includes('cooldown') ||
    t.includes('rate limit') ||
    t.includes('rate_limit') ||
    t.includes('429')
  );
}

async function callOpenClawRouterAgent({ agentId, prompt, timeoutMs }) {
  return new Promise((resolve) => {
    const sessionId = `router-sidecar:${agentId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
    const args = [
      'agent',
      '--local',
      '--agent',
      agentId,
      '--session-id',
      sessionId,
      '--thinking',
      'off',
      '--message',
      prompt,
      '--timeout',
      String(Math.max(1, Math.ceil(timeoutMs / 1000))),
      '--json',
    ];

    // Avoid openclaw.cmd quoting/newline issues by invoking the repo entry with node directly.
    // This supports multi-line --message safely.
    const openclawCli = process.env.OPENCLAW_CLI || 'openclaw';
    execFile(openclawCli, args, { timeout: timeoutMs + 600, windowsHide: true, maxBuffer: 2 * 1024 * 1024, // no cwd: rely on PATH for openclaw CLI }, (err, stdout, stderr) => {
      if (err) {
        const detail = String(err.message || err);
        const stderrS = String(stderr || '');
        const stdoutS = String(stdout || '');
        // On agent invocation failure, briefly skip this agent to avoid burning the entire time budget repeatedly.
        const cooldownMs = (isCooldownLike(detail) || isCooldownLike(stderrS) || isCooldownLike(stdoutS)) ? 60_000 : 15_000;
        agentSkipUntilMs.set(agentId, Date.now() + cooldownMs);
        resolve({ ok: false, error: 'OPENCLAW_AGENT_FAILED', detail, stderr: stderrS, stdout: stdoutS, exitCode: err.code, signal: err.signal, killed: Boolean(err.killed) });
        return;
      }
      const parsed = safeJsonParse(String(stdout || ''));
      if (!parsed.ok) {
        resolve({ ok: false, error: parsed.error, detail: 'Could not parse openclaw agent JSON output' });
        return;
      }
      // Expected shape: { payloads: [{text: "..."}], meta: {...} }
      const payloads = parsed.value?.payloads;
      const text = Array.isArray(payloads) && payloads[0] && typeof payloads[0].text === 'string' ? payloads[0].text : '';
      const routerResp = safeJsonParse(text);
      if (!routerResp.ok) {
        resolve({ ok: false, error: 'ROUTER_RESPONSE_NOT_JSON', detail: text.slice(0, 500) });
        return;
      }
      resolve({ ok: true, router: routerResp.value });
    });
  });
}

function validateRouterResponse({ routingRequest, router }) {
  const required = ['selected_kind', 'selected_model', 'confidence', 'reason', 'why_not'];
  for (const k of required) {
    if (!(k in router)) return { ok: false, error: `MISSING_${k}` };
  }
  const allowedModels = routingRequest?.catalog?.allowedModels;
  if (Array.isArray(allowedModels) && !allowedModels.includes(router.selected_model)) {
    return { ok: false, error: 'MODEL_NOT_ALLOWED' };
  }
  if (!['low', 'medium', 'high'].includes(String(router.confidence))) {
    return { ok: false, error: 'BAD_CONFIDENCE' };
  }
  if (!Array.isArray(router.why_not) || router.why_not.length < 1) {
    return { ok: false, error: 'WHY_NOT_REQUIRED' };
  }
  return { ok: true };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { ok: true, name: 'openclaw-router-sidecar', port: PORT });
    }

    if (req.method === 'POST' && req.url === '/route') {
      const attempts = [];
      try {
        const raw = await readBody(req);
        const parsed = safeJsonParse(raw);
        if (!parsed.ok) return json(res, 400, { ok: false, error: 'BAD_JSON' });

        const routingRequest = parsed.value;
        const timeoutMs = Number(routingRequest?.policy?.routerTimeoutMs || 2000);
        const prompt = buildRouterPrompt(routingRequest);

        const t0 = Date.now();
        for (let i = 0; i < ROUTER_AGENTS.length; i++) {
          const a = ROUTER_AGENTS[i];
          const elapsed = Date.now() - t0;
          const remaining = Math.max(0, timeoutMs - elapsed - 300);

          const skipUntil = Number(agentSkipUntilMs.get(a.agentId) || 0);
          if (skipUntil && Date.now() < skipUntil) {
            attempts.push({ agentId: a.agentId, label: a.label, ok: false, error: 'AGENT_COOLDOWN_SKIP', remainingMs: remaining, skipUntilMs: skipUntil });
            continue;
          }

          if (remaining < 1500) {
            attempts.push({ agentId: a.agentId, label: a.label, ok: false, error: 'TIME_BUDGET_EXHAUSTED', remaining });
            break;
          }

          // Give each attempt a fair slice, but ensure gpt-4o gets a real chance.
          // Goal: with routerTimeoutMs≈20s, allocate ~2.5s flash, ~12-15s gpt-4o, ~2.5s pro, ~8s mini (best-effort).
          let targetMs;
          if (a.agentId === 'router-gpt4o') targetMs = 15000;
          else if (a.agentId === 'router-mini') targetMs = 8000;
          else targetMs = 2500; // flash/pro

          const headroom = 600;
          const maxThis = Math.max(0, remaining - headroom);
          const perAttemptTimeoutMs = Math.max(1200, Math.min(targetMs, maxThis));

          const r = await callOpenClawRouterAgent({ agentId: a.agentId, prompt, timeoutMs: perAttemptTimeoutMs });
          attempts.push({
            agentId: a.agentId,
            label: a.label,
            ok: r.ok,
            error: r.ok ? undefined : r.error,
            detail: r.ok ? undefined : r.detail,
            stderr: r.ok ? undefined : String(r.stderr || '').slice(0, 500),
            stdout: r.ok ? undefined : String(r.stdout || '').slice(0, 500),
            exitCode: r.ok ? undefined : r.exitCode,
            signal: r.ok ? undefined : r.signal,
            killed: r.ok ? undefined : r.killed,
            perAttemptTimeoutMs,
          });
          if (!r.ok) continue;

          const v = validateRouterResponse({ routingRequest, router: r.router });
          if (!v.ok) {
            attempts.push({ agentId: a.agentId, label: a.label, ok: false, error: v.error });
            continue;
          }

          return json(res, 200, { ok: true, router: r.router, attempts });
        }

        return json(res, 200, { ok: false, error: 'ALL_ROUTER_MODELS_FAILED', attempts });
      } catch (e) {
        const detail = String(e?.message || e);
        const stack = typeof e?.stack === 'string' ? String(e.stack).slice(0, 2000) : undefined;
        // Return 200 so the plugin can parse and treat as ok=false (fail-open).
        return json(res, 200, { ok: false, error: 'INTERNAL', detail, stack, attempts });
      }
    }

    return json(res, 404, { ok: false, error: 'NOT_FOUND' });
  } catch (e) {
    // Extremely defensive: never crash, always return JSON.
    const detail = String(e?.message || e);
    const stack = typeof e?.stack === 'string' ? String(e.stack).slice(0, 2000) : undefined;
    return json(res, 200, { ok: false, error: 'INTERNAL_TOP', detail, stack });
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[router-sidecar] listening on http://${HOST}:${PORT}`);
});
