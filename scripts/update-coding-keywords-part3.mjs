import fs from "node:fs";

const targetPath = new URL("../tools/soft-router-suggest/drafts/coding关键词库.txt", import.meta.url);
const raw = fs.readFileSync(targetPath, "utf8");
const obj = JSON.parse(raw);

obj.part3 = {
  title: "第三部分：按语言归类的强特征 / 高频场景词（相同部分已抽到 common 集合）",
  updatedAt: new Date().toISOString(),
  intent: "scenario + ecosystem high-signal",
  notes: [
    "本部分补的是‘场景词/生态词’：框架、工具、依赖/包管理、典型命令、典型错误片段等（比语法 token 更贴近真实对话）。",
    "相同/跨语言常见的词已整合到 coding.scenario.common.*；每个语言的集合尽量只放相对独有或更强指向性的词。",
    "这些词建议作为 coding 的额外 positive signals（权重通常 1~2）；不要把过泛的词（例如：开发/实现/优化/配置/接口/API）当强信号。",
    "如果你后续要做严格的 contains 匹配：短缩写、单字母标识仍不建议进入正向 signals；必要时用 regex + 单词边界。"
  ],
  keywordSets: {
    // ---------------------------------------------------------------------
    // Common (cross-language) scenario sets
    // ---------------------------------------------------------------------
    "coding.scenario.common.package_manager": [
      "npm",
      "pnpm",
      "yarn",
      "pip",
      "pip3",
      "poetry",
      "pipenv",
      "conda",
      "cargo",
      "mvn",
      "maven",
      "gradle",
      "dotnet",
      "nuget",
      "composer",
      "bundler",
      "bundle install",
      "gem install",
    ],

    "coding.scenario.common.test_framework": [
      "pytest",
      "unittest",
      "nose",
      "jest",
      "vitest",
      "mocha",
      "chai",
      "cypress",
      "playwright",
      "junit",
      "testng",
      "xunit",
      "nunit",
      "rspec",
      "minitest",
      "go test",
      "cargo test",
      "dotnet test",
    ],

    "coding.scenario.common.build_and_ci": [
      "build",
      "compile",
      "compiler",
      "linker",
      "make",
      "cmake",
      "ninja",
      "bazel",
      "msbuild",
      "tsc",
      "webpack",
      "vite",
      "rollup",
      "GitHub Actions",
      "CI",
      "pipeline",
      "workflow",
    ],

    "coding.scenario.common.web_backend": [
      "REST",
      "RESTful",
      "GraphQL",
      "OpenAPI",
      "Swagger",
      "gRPC",
      "middleware",
      "ORM",
      "JWT",
      "OAuth",
      "CORS",
      "websocket",
      "WebSocket",
      "nginx",
    ],

    "coding.scenario.common.devops": [
      "Docker",
      "docker-compose",
      "Kubernetes",
      "k8s",
      "Helm",
      "Terraform",
      "Ansible",
      "systemd",
      "systemctl",
      "Linux",
    ],

    "coding.scenario.common.db": [
      "PostgreSQL",
      "Postgres",
      "MySQL",
      "SQLite",
      "Redis",
      "MongoDB",
      "Elasticsearch",
      "EXPLAIN",
      "index",
      "transaction",
      "deadlock",
    ],

    "coding.scenario.common.ml_data": [
      "Jupyter",
      "notebook",
      "pandas",
      "NumPy",
      "numpy",
      "PyTorch",
      "torch",
      "TensorFlow",
      "scikit-learn",
      "sklearn",
    ],

    // ---------------------------------------------------------------------
    // Per-language / ecosystem unique-ish scenario sets
    // ---------------------------------------------------------------------

    // Python
    "coding.scenario.python": [
      "FastAPI",
      "Django",
      "Flask",
      "uvicorn",
      "gunicorn",
      "Celery",
      "pydantic",
      "mypy",
      "typing",
      "dataclass",
      "__init__.py",
      "site-packages",
      "pip install",
      "python -m",
      "virtualenv",
      "venv",
      "Conda",
      "Anaconda",
      "ipynb",
      "beautifulsoup",
      "requests",
      "asyncio",
    ],

    // JS/TS/Node
    "coding.scenario.js_ts_node": [
      "Node.js",
      "node_modules",
      "package.json",
      "npm run",
      "pnpm",
      "yarn",
      "TypeScript",
      "tsconfig.json",
      "ts-node",
      "nodemon",
      "eslint",
      "prettier",
      "React",
      "Next.js",
      "Vue",
      "Nuxt",
      "Angular",
      "Svelte",
      "Express",
      "Koa",
      "NestJS",
      "Prisma",
      "Sequelize",
      "Mongoose",
    ],

    // Java / JVM
    "coding.scenario.java_jvm": [
      "Spring",
      "Spring Boot",
      "Maven",
      "Gradle",
      "pom.xml",
      "build.gradle",
      "Lombok",
      "SLF4J",
      "Logback",
      "Log4j",
      "Tomcat",
      "Jetty",
      "JPA",
      "Hibernate",
      "@RestController",
      "@Autowired",
      "Exception in thread",
      "Caused by:",
    ],

    // C / C++
    "coding.scenario.c_cpp": [
      "#include",
      "CMakeLists.txt",
      "g++",
      "gcc",
      "clang",
      "gdb",
      "valgrind",
      "ASan",
      "UBSan",
      "-fsanitize",
      "segmentation fault",
      "core dumped",
      "undefined reference to",
      "std::vector",
      "std::string",
      "unique_ptr",
      "shared_ptr",
    ],

    // C# / .NET
    "coding.scenario.csharp_dotnet": [
      "ASP.NET",
      "ASP.NET Core",
      "Entity Framework",
      "EF Core",
      "LINQ",
      "NuGet",
      "dotnet restore",
      "dotnet build",
      "dotnet publish",
      "csproj",
      "sln",
      "MSBuild",
      "IEnumerable",
      "Task<",
    ],

    // Go
    "coding.scenario.go": [
      "gofmt",
      "golangci-lint",
      "go mod",
      "go get",
      "go install",
      "context.Context",
      "net/http",
      "Gin",
      "Echo",
      "GORM",
      "grpc-go",
      "err != nil",
      "panic:",
    ],

    // Rust
    "coding.scenario.rust": [
      "Cargo.toml",
      "cargo build",
      "cargo clippy",
      "rustfmt",
      "tokio",
      "serde",
      "actix",
      "axum",
      "rocket",
      "lifetime",
      "borrow checker",
      "match ",
      "impl ",
      "trait ",
      "error[E",
    ],

    // PHP
    "coding.scenario.php": [
      "Laravel",
      "Symfony",
      "composer",
      "composer install",
      "artisan",
      "Eloquent",
      "Blade",
      "Fatal error: Uncaught",
      "Parse error:",
      "undefined function",
    ],

    // Ruby
    "coding.scenario.ruby": [
      "Rails",
      "ActiveRecord",
      "bundler",
      "bundle exec",
      "rake ",
      "rspec",
      "Gemfile",
      "NoMethodError",
      "NameError",
    ],

    // Swift / iOS
    "coding.scenario.swift_ios": [
      "SwiftUI",
      "UIKit",
      "Xcode",
      "xcodebuild",
      "CocoaPods",
      "Podfile",
      "pod install",
      "Swift Package Manager",
      "SPM",
      "@State",
    ],

    // Kotlin / Android
    "coding.scenario.kotlin_android": [
      "Android",
      "Android Studio",
      "Gradle",
      "Kotlin DSL",
      "Coroutine",
      "suspend fun",
      "Jetpack",
      "Compose",
      "Ktor",
    ],

    // Scala
    "coding.scenario.scala": [
      "sbt",
      "Scala",
      "Akka",
      "Spark",
      "case class",
      "implicit",
    ],

    // Dart / Flutter
    "coding.scenario.dart_flutter": [
      "Flutter",
      "pubspec.yaml",
      "dart pub",
      "flutter pub",
      "Widget",
      "StatefulWidget",
      "BuildContext",
    ],

    // Shell
    "coding.scenario.shell": [
      "#!/bin/bash",
      "chmod +x",
      "set -e",
      "pipefail",
      "ssh ",
      "scp ",
      "curl ",
      "grep ",
      "awk ",
      "sed ",
    ],

    // PowerShell
    "coding.scenario.powershell": [
      "Get-ChildItem",
      "Select-Object",
      "Format-Table",
      "Write-Host",
      "$env:",
      "ExecutionPolicy",
      "Invoke-WebRequest",
      "Invoke-RestMethod",
    ],

    // SQL (更偏 DB 场景)
    "coding.scenario.sql": [
      "SELECT",
      "JOIN",
      "GROUP BY",
      "ORDER BY",
      "EXPLAIN ANALYZE",
      "index scan",
      "query plan",
      "transaction",
      "isolation level",
      "deadlock",
    ],

    // Haskell
    "coding.scenario.haskell": [
      "ghci",
      "cabal",
      "stack.yaml",
      "{-# LANGUAGE",
      "Monad",
      "Functor",
      "Applicative",
    ],

    // Erlang / Elixir
    "coding.scenario.erlang_elixir": [
      "rebar3",
      "erl",
      "io:format",
      "OTP",
      "defmodule",
      "mix.exs",
      "mix test",
      "iex",
    ],

    // Clojure / Lisp
    "coding.scenario.clojure_lisp": [
      "clj",
      "lein",
      "deps.edn",
      "(defn",
      "(defun",
      ":require",
      "macro",
    ],

    // MATLAB / R
    "coding.scenario.matlab_r": [
      "MATLAB",
      "Simulink",
      "RStudio",
      "tidyverse",
      "ggplot2",
      "data.frame",
    ],

    // Solidity
    "coding.scenario.solidity": [
      "pragma solidity",
      "contract ",
      "msg.sender",
      "uint256",
      "require(",
      "emit ",
      "mapping(",
      "Hardhat",
      "Foundry",
    ],

    // HDL
    "coding.scenario.hdl": [
      "Verilog",
      "SystemVerilog",
      "VHDL",
      "endmodule",
      "always @(",
      "posedge",
      "negedge",
    ],
  },

  wiringExample: {
    "kinds.coding.signals.positive_add_suggested": [
      { "set": "coding.scenario.common.package_manager", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.common.test_framework", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.common.build_and_ci", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.common.db", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.common.devops", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.python", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.js_ts_node", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.java_jvm", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.go", "weight": 1, "match": "contains" },
      { "set": "coding.scenario.rust", "weight": 1, "match": "contains" }
    ],
    note: "权重建议偏保守（1）。若你发现仍不足以区分 coding，可把部分强集合（如 python/js/java/rust/go）提升到 2。"
  }
};

obj.updatedAt = new Date().toISOString();

fs.writeFileSync(targetPath, JSON.stringify(obj, null, 2) + "\n", "utf8");
