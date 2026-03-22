import fs from "node:fs";

const targetPath = new URL("../coding关键词库.txt", import.meta.url);
const raw = fs.readFileSync(targetPath, "utf8");
const obj = JSON.parse(raw);

obj.part2 = {
  title: "第二部分：强特征/高频特有词汇（用于 coding 加权；建议接入 coding.kind 的 positive signals）",
  updatedAt: new Date().toISOString(),
  scope: {
    intent: "high-signal tokens",
    match: "contains",
    warning: "无法保证穷尽所有语言/所有语法细节；这里提供高覆盖、可维护、低误命中倾向的强特征词。",
  },
  notes: [
    "目标：补充‘语言名/后缀’以外的强信号词（构建工具、包管理、典型报错、生态命令、独有语法片段）。",
    "原则：尽量避免通用词（class/if/for/end/var/let 等）——它们会在非编程对话中大量出现，导致误命中。",
    "原则：单字母/两字母缩写（R/D/V/ML/PS/CL/PL/SV/ST…）不要接入 contains；若一定要支持，请改为 regex + 单词边界。",
    "建议：将‘强特征’单独作为 set（本 part2），并给比语言名更高的权重（例如 2~3）。",
  ],
  keywordSets: {
    // ---------------------------
    // Cross-language strong signals
    // ---------------------------
    "coding.feature.build_and_toolchain": [
      "build failed",
      "compilation failed",
      "linker",
      "linking",
      "ld: ",
      "undefined reference to",
      "fatal error:",
      "stack trace",
      "stacktrace",
      "Traceback (most recent call last):",
      "Segmentation fault",
      "segmentation fault",
      "core dumped",
      "exit code",
      "command not found",
      "permission denied",
      "CI",
      "GitHub Actions",
      "pipeline",
    ],

    "coding.feature.package_files": [
      "package.json",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "tsconfig.json",
      "pyproject.toml",
      "requirements.txt",
      "Pipfile",
      "Pipfile.lock",
      "poetry.lock",
      "go.mod",
      "go.sum",
      "Cargo.toml",
      "Cargo.lock",
      "pom.xml",
      "build.gradle",
      "build.gradle.kts",
      ".csproj",
      ".sln",
      "composer.json",
      "Gemfile",
      "Gemfile.lock",
      "CMakeLists.txt",
      "Makefile",
      "docker-compose.yml",
      "Dockerfile",
    ],

    // ---------------------------
    // Python
    // ---------------------------
    "coding.feature.python": [
      "def ",
      "def\n",
      "async def",
      "await ",
      "__init__",
      "__main__",
      "if __name__ == '__main__'",
      "python -m",
      "pip install",
      "pip3 install",
      "venv",
      "virtualenv",
      "site-packages",
      "pytest",
      "unittest",
      "pylint",
      "flake8",
      "black",
      "IndentationError",
      "ModuleNotFoundError",
      "ImportError",
      "KeyError",
      "ValueError",
      "TypeError",
      "AttributeError",
      "numpy",
      "pandas",
      "asyncio",
    ],

    // ---------------------------
    // JavaScript / TypeScript / Node
    // ---------------------------
    "coding.feature.js_ts_node": [
      "node_modules",
      "npm install",
      "npm run",
      "pnpm add",
      "yarn add",
      "tsc ",
      "eslint",
      "prettier",
      "webpack",
      "rollup",
      "vite",
      "Next.js",
      "Nuxt",
      "import {",
      "export default",
      "module.exports",
      "require(",
      "console.log(",
      "Promise",
      "async function",
      "TypeError: Cannot read properties of undefined",
      "ReferenceError:",
      "SyntaxError:",
    ],

    // ---------------------------
    // Java / JVM
    // ---------------------------
    "coding.feature.java_jvm": [
      "public static void main",
      "System.out.println",
      "NullPointerException",
      "ClassNotFoundException",
      "NoSuchMethodError",
      "mvn clean",
      "mvn test",
      "gradle build",
      "./gradlew",
      "JDK",
      "JRE",
      "javac",
      "Spring Boot",
      "Hibernate",
    ],

    // ---------------------------
    // C / C++
    // ---------------------------
    "coding.feature.c_cpp": [
      "#include",
      "#include <",
      "std::",
      "cout <<",
      "cin >>",
      "nullptr",
      "template<",
      "constexpr",
      "malloc(",
      "free(",
      "sizeof(",
      "g++",
      "gcc",
      "clang",
      "cmake",
      "make",
    ],

    // ---------------------------
    // C# / .NET
    // ---------------------------
    "coding.feature.csharp_dotnet": [
      "dotnet build",
      "dotnet test",
      "dotnet restore",
      "NuGet",
      "using System",
      "Console.WriteLine",
      "System.Linq",
      "async Task",
      "IEnumerable",
    ],

    // ---------------------------
    // Go
    // ---------------------------
    "coding.feature.go": [
      "go test",
      "go build",
      "go run",
      "goroutine",
      "chan ",
      "select {",
      "defer ",
      "panic:",
      "recover(",
      "fmt.Println",
      "interface{}",
      ":=",
    ],

    // ---------------------------
    // Rust
    // ---------------------------
    "coding.feature.rust": [
      "cargo build",
      "cargo test",
      "cargo run",
      "rustc",
      "borrow checker",
      "lifetime",
      "impl ",
      "trait ",
      "crate",
      "Option<",
      "Result<",
      "unwrap()",
      "println!(",
      "error[E",
    ],

    // ---------------------------
    // PHP
    // ---------------------------
    "coding.feature.php": [
      "composer install",
      "composer update",
      "php artisan",
      "Fatal error: Uncaught",
      "Parse error:",
      "$_GET",
      "$_POST",
      "Laravel",
      "Symfony",
    ],

    // ---------------------------
    // Ruby
    // ---------------------------
    "coding.feature.ruby": [
      "bundle install",
      "bundle exec",
      "rails ",
      "rake ",
      "NoMethodError",
      "NameError",
      "irb",
      "puts ",
    ],

    // ---------------------------
    // Swift / Objective-C (Apple)
    // ---------------------------
    "coding.feature.swift_objc": [
      "SwiftUI",
      "@State",
      "@Published",
      "guard let",
      "Xcode",
      "CocoaPods",
      "Podfile",
      "pod install",
      "Swift Package Manager",
      "SPM",
      "@interface",
      "@implementation",
    ],

    // ---------------------------
    // Kotlin / Android
    // ---------------------------
    "coding.feature.kotlin": [
      "data class",
      "suspend fun",
      "CoroutineScope",
      "Android Studio",
    ],

    // ---------------------------
    // SQL (注意：关键词较通用，建议低权重)
    // ---------------------------
    "coding.feature.sql": [
      "SELECT ",
      "FROM ",
      "WHERE ",
      "JOIN ",
      "GROUP BY",
      "ORDER BY",
      "INSERT INTO",
      "DELETE FROM",
      "EXPLAIN",
      "psql",
      "mysql",
      "sqlite",
    ],

    // ---------------------------
    // Shell / PowerShell
    // ---------------------------
    "coding.feature.shell": [
      "#!/bin/bash",
      "chmod +x",
      "set -e",
      "set -euo pipefail",
      "sudo ",
      "curl ",
      "wget ",
      "grep -",
      "awk ",
      "sed ",
      "systemctl ",
      "export PATH=",
    ],

    "coding.feature.powershell": [
      "Get-ChildItem",
      "Select-Object",
      "Format-Table",
      "Write-Host",
      "$env:",
      "Invoke-WebRequest",
      "Invoke-RestMethod",
    ],

    // ---------------------------
    // Blockchain / smart contracts
    // ---------------------------
    "coding.feature.solidity": [
      "pragma solidity",
      "contract ",
      "msg.sender",
      "uint256",
      "require(",
      "emit ",
      "mapping(",
    ],

    // ---------------------------
    // HDL
    // ---------------------------
    "coding.feature.hdl": [
      "endmodule",
      "always @(",
      "posedge",
      "negedge",
      "wire ",
      "reg ",
      "entity ",
      "architecture ",
      "signal ",
    ],

    // ---------------------------
    // Risky / too generic tokens (keep as reference, do not wire)
    // ---------------------------
    "coding.feature.risky_or_generic_reference_only": [
      "class ",
      "if (",
      "for (",
      "while (",
      "var ",
      "let ",
      "const ",
      "int ",
      "string ",
      "return ",
      "function ",
      "end",
    ],
  },

  signals_patch_example: {
    "kinds.coding.signals.positive_add_suggested": [
      { "set": "coding.feature.package_files", "weight": 2, "match": "contains" },
      { "set": "coding.feature.build_and_toolchain", "weight": 2, "match": "contains" },
      { "set": "coding.feature.python", "weight": 2, "match": "contains" },
      { "set": "coding.feature.js_ts_node", "weight": 2, "match": "contains" },
      { "set": "coding.feature.java_jvm", "weight": 2, "match": "contains" },
      { "set": "coding.feature.go", "weight": 2, "match": "contains" },
      { "set": "coding.feature.rust", "weight": 2, "match": "contains" },
      { "set": "coding.feature.c_cpp", "weight": 2, "match": "contains" },
      { "set": "coding.feature.csharp_dotnet", "weight": 2, "match": "contains" },
      { "set": "coding.feature.shell", "weight": 1, "match": "contains" },
      { "set": "coding.feature.sql", "weight": 1, "match": "contains" }
    ],
    "do_not_wire_sets": [
      "coding.feature.risky_or_generic_reference_only"
    ]
  }
};

obj.updatedAt = new Date().toISOString();

fs.writeFileSync(targetPath, JSON.stringify(obj, null, 2) + "\n", "utf8");
