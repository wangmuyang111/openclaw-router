import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";

const originalHome = process.env.OPENCLAW_HOME;
const originalWorkspace = process.env.OPENCLAW_WORKSPACE;

async function withTempOpenClawHome(fn: (ctx: { home: string; configPath: string }) => Promise<void>) {
  const home = await mkdtemp(path.join(os.tmpdir(), "openclaw-soft-router-"));
  const workspace = path.join(home, "workspace");
  await mkdir(workspace, { recursive: true });
  process.env.OPENCLAW_HOME = home;
  process.env.OPENCLAW_WORKSPACE = workspace;
  const configPath = path.join(home, "openclaw.json");
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        plugins: {
          entries: {
            "soft-router-suggest": {
              enabled: true,
              config: {
                ruleEngineEnabled: false,
                routerLlmEnabled: false,
                switchingEnabled: false,
              },
            },
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  try {
    await fn({ home, configPath });
  } finally {
    if (originalHome === undefined) {
      delete process.env.OPENCLAW_HOME;
    } else {
      process.env.OPENCLAW_HOME = originalHome;
    }
    if (originalWorkspace === undefined) {
      delete process.env.OPENCLAW_WORKSPACE;
    } else {
      process.env.OPENCLAW_WORKSPACE = originalWorkspace;
    }
  }
}

test("runRouterMode fast disables plugin", async () => {
  const { runRouterMode } = await import("./router-mode.js");

  await withTempOpenClawHome(async ({ configPath }) => {
    const exitCode = await runRouterMode("fast");
    assert.equal(exitCode, 0);

    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as { plugins: { entries: { "soft-router-suggest": { enabled: boolean; config?: unknown } } } };
    assert.equal(parsed.plugins.entries["soft-router-suggest"].enabled, false);
    assert.equal("config" in parsed.plugins.entries["soft-router-suggest"], false);
  });
});

test("runRouterMode rules enables rule mode without llm", async () => {
  const { runRouterMode } = await import("./router-mode.js");

  await withTempOpenClawHome(async ({ configPath }) => {
    const exitCode = await runRouterMode("rules");
    assert.equal(exitCode, 0);

    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as {
      plugins: {
        entries: {
          "soft-router-suggest": {
            enabled: boolean;
            config: {
              ruleEngineEnabled: boolean;
              routerLlmEnabled: boolean;
              switchingEnabled: boolean;
              openclawCliPath: string;
            };
          };
        };
      };
    };

    assert.equal(parsed.plugins.entries["soft-router-suggest"].enabled, true);
    assert.equal(parsed.plugins.entries["soft-router-suggest"].config.ruleEngineEnabled, true);
    assert.equal(parsed.plugins.entries["soft-router-suggest"].config.routerLlmEnabled, false);
    assert.equal(parsed.plugins.entries["soft-router-suggest"].config.switchingEnabled, true);
    assert.equal(parsed.plugins.entries["soft-router-suggest"].config.openclawCliPath, "openclaw");
  });
});

test("runRouterMode llm enables llm mode and endpoint", async () => {
  const { runRouterMode } = await import("./router-mode.js");

  await withTempOpenClawHome(async ({ configPath }) => {
    const exitCode = await runRouterMode("llm");
    assert.equal(exitCode, 0);

    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as {
      plugins: {
        entries: {
          "soft-router-suggest": {
            enabled: boolean;
            config: {
              ruleEngineEnabled: boolean;
              routerLlmEnabled: boolean;
              switchingEnabled: boolean;
              openclawCliPath: string;
              routerLlmEndpoint: string;
            };
          };
        };
      };
    };

    assert.equal(parsed.plugins.entries["soft-router-suggest"].enabled, true);
    assert.equal(parsed.plugins.entries["soft-router-suggest"].config.ruleEngineEnabled, true);
    assert.equal(parsed.plugins.entries["soft-router-suggest"].config.routerLlmEnabled, true);
    assert.equal(parsed.plugins.entries["soft-router-suggest"].config.switchingEnabled, true);
    assert.equal(parsed.plugins.entries["soft-router-suggest"].config.openclawCliPath, "openclaw");
    assert.equal(parsed.plugins.entries["soft-router-suggest"].config.routerLlmEndpoint, "http://127.0.0.1:18888/route");
  });
});

test("runRouterMode catalog-refresh creates refresh flag", async () => {
  const { runRouterMode } = await import("./router-mode.js");

  await withTempOpenClawHome(async ({ home }) => {
    const exitCode = await runRouterMode("catalog-refresh");
    assert.equal(exitCode, 0);

    const flagPath = path.join(home, "workspace", "tools", "soft-router-suggest", ".force-refresh-catalog");
    const raw = await readFile(flagPath, "utf8");
    assert.equal(raw, "");
  });
});
