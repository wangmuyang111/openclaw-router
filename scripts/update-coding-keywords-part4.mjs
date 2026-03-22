import fs from "node:fs";

const targetPath = new URL("../coding关键词库.txt", import.meta.url);
const raw = fs.readFileSync(targetPath, "utf8");
const obj = JSON.parse(raw);

obj.part4_patch = {
  title: "第四部分：补充关键词补丁（在原库 + part2/part3 基础上仍建议增补的高信号词）",
  updatedAt: new Date().toISOString(),
  notes: [
    "定位：这是一组‘补丁’——补充近两年常见的新工具/新生态词、以及更强的错误码/报错片段。",
    "原则：仍然避免过泛词（例如：开发/实现/优化/配置/API/接口/函数等）。",
    "策略：优先放到新的 set 里，再按需要挂到 coding.kind 的 positive signals（权重 1~2）。",
    "注意：如果后续引入 regex match，可把 error-code 这一类做成更严格的规则（例如 TS\\d{4}）。"
  ],
  keywordSets: {
    // Modern JS/TS runtimes & tooling
    "coding.scenario.js_runtime_modern": [
      "bun",
      "bunx",
      "deno",
      "npx",
      "corepack",
      "node --inspect",
      "node:internal",
      "ERR_MODULE_NOT_FOUND",
      "ERR_REQUIRE_ESM",
      "ExperimentalWarning",
    ],

    "coding.scenario.js_monorepo_tooling": [
      "turborepo",
      "turbo run",
      "nx",
      "lerna",
      "changesets",
      "pnpm workspace",
      "workspaces",
    ],

    "coding.scenario.js_lint_format_modern": [
      "biome",
      "rome",
      "eslint --fix",
      "prettier --check",
      "stylelint",
    ],

    // Modern Python tooling
    "coding.scenario.python_tooling_modern": [
      "uv",
      "uv pip",
      "uv run",
      "pipx",
      "ruff",
      "tox",
      "hatch",
      "rye",
      "pyenv",
      "pip install -r",
      "requirements-dev.txt",
    ],

    // Strong, language-specific error codes / signatures
    "coding.feature.error_codes": [
      // TypeScript compiler
      "TS2307",
      "TS2339",
      "TS2345",
      "TS2322",
      "TS2769",
      "TS7006",
      // C# compiler
      "CS0246",
      "CS0103",
      "CS1061",
      // Java
      "cannot find symbol",
      "Exception in thread \"main\"",
      // Python
      "ModuleNotFoundError:",
      "IndentationError:",
      // Rust
      "mismatched types",
      "borrowed value does not live long enough",
      // Go
      "undefined:",
      "cannot use",
      // SQL
      "SQLSTATE",
      "ORA-",
      "ERROR 1064",
    ],

    // C/C++ dependency managers & tooling
    "coding.scenario.c_cpp_tooling_modern": [
      "vcpkg",
      "conan",
      "clangd",
      "clang-tidy",
      "asan",
      "ubsan",
      "-fsanitize=address",
      "-fsanitize=undefined",
    ],

    // Rust ecosystem tokens (high signal)
    "coding.scenario.rust_ecosystem": [
      "rust-analyzer",
      "cargo fmt",
      "cargo clippy",
      "serde_json",
      "anyhow",
      "thiserror",
      "tokio::",
    ],

    // Go ecosystem tokens
    "coding.scenario.go_ecosystem": [
      "go mod tidy",
      "go vet",
      "go generate",
      "golangci-lint",
      "protobuf",
      "protoc",
    ],

    // .NET ecosystem tokens
    "coding.scenario.dotnet_ecosystem": [
      "dotnet ef",
      "EntityFrameworkCore",
      "Microsoft.Extensions",
      "appsettings.json",
    ],

    // JVM build wrappers
    "coding.scenario.java_wrappers": [
      "./mvnw",
      "./gradlew",
      "gradlew.bat",
      "mvnw.cmd",
    ]
  },

  wiringExample: {
    "kinds.coding.signals.positive_add_suggested": [
      { "set": "coding.feature.error_codes", "weight": 2, "match": "contains" },
      { "set": "coding.scenario.python_tooling_modern", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.js_runtime_modern", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.js_monorepo_tooling", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.js_lint_format_modern", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.c_cpp_tooling_modern", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.rust_ecosystem", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.go_ecosystem", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.dotnet_ecosystem", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.java_wrappers", "weight": 1, "match": "contains" }
    ],
    note: "这批补丁如果全挂上仍觉得误命中增加，可先只接入 coding.feature.error_codes（权重2）+ python/js 的 modern tooling（权重1）。"
  }
};

obj.updatedAt = new Date().toISOString();

fs.writeFileSync(targetPath, JSON.stringify(obj, null, 2) + "\n", "utf8");
