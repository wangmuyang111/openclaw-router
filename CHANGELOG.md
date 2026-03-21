# Changelog

All notable changes to the OpenClaw Soft Router project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-02-11

### Added
- Initial public release of soft-router-suggest plugin
- Rule-based routing engine with 10 predefined categories
- Model priority configuration system (`model-priority.json`)
- Router rules configuration (`router-rules.json`)
- PowerShell installation and management scripts
- Optional LLM sidecar for advanced routing decisions
- Operational mode switching (FAST / RULES / LLM)
- Manual catalog refresh capability
- Comprehensive documentation (TECHNICAL.md, SECURITY.md, USAGE_MANUAL.txt)
- Health check and diagnostics (`doctor.ps1`)

### Features
- **Suggest-only mode**: Analyzes messages but never auto-switches models for user chat
- **Internal routing**: Automatically switches models for agent sub-tasks
- **Multi-category support**: 
  - strategy, coding, vision
  - support, general, chat
- **Provider auth awareness**: Detects expired OAuth tokens
- **Deduplication**: Prevents log spam from repeated suggestions
- **Echo mode**: Optional suggestion display in replies

### Security
- No hardcoded paths or credentials
- Sanitized configuration examples
- Pre-publish security checklist
- Cross-process deduplication locks

## [Unreleased]

### Added
- Added `tools/soft-router-suggest/KIND_GUIDE.zh-CN.md`: a detailed Chinese technical + user guidance document for the simplified 6-kind router, with focus on the first five major kinds (`strategy`, `coding`, `vision`, `support`, `general`).

### Planned
- GitHub Actions CI/CD workflow
- Automated tests
- Community contribution guidelines
- Examples and tutorials
- Multi-platform support (Linux, macOS)

---

For upgrade instructions, see [README.md](README.md).
