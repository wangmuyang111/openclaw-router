# Contributing to OpenClaw Soft Router

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:
- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Your environment (Windows version, PowerShell version, OpenClaw version)
- Relevant logs (sanitized - remove any personal info!)

### Suggesting Features

We welcome feature requests! Please:
- Check if the feature has already been requested
- Describe the use case and expected behavior
- Explain why this would be useful to others

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**:
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed
4. **Test your changes**:
   - Run `./scripts/doctor.ps1` to verify
   - Test all three modes (FAST/RULES/LLM)
5. **Commit with clear messages**: 
   ```
   feat: Add new routing category for code review
   
   - Added 'code_review' kind to router-rules.json
   - Updated model-priority.json with optimized order
   - Added keyword detection for review intent
   ```
6. **Push to your fork**: `git push origin feature/amazing-feature`
7. **Open a Pull Request** with:
   - Clear description of changes
   - Link to related issues
   - Screenshots/logs if relevant

## Development Guidelines

### Code Style

- **PowerShell**: Follow [PowerShell Best Practices](https://docs.microsoft.com/en-us/powershell/scripting/developer/cmdlet/strongly-encouraged-development-guidelines)
- **TypeScript**: Use consistent indentation (2 spaces)
- **JSON**: Validate before committing

### Security

**NEVER commit**:
- Absolute paths with usernames (`C:\Users\YourName\...`)
- API keys, tokens, or credentials
- Personal email addresses
- Full `openclaw.json` files
- Log files with real data

Use placeholders instead:
```json
{
  "path": "~/.openclaw/workspace/...",
  "email": "user@example.com"
}
```

### Documentation

- Update `README.md` if you change user-facing features
- Add entries to `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/)
- Update `docs/TECHNICAL.md` for architecture changes
- Keep `docs/USAGE_MANUAL.txt` in sync with new features

### Testing Checklist

Before submitting a PR, verify:
- [ ] `./scripts/doctor.ps1` passes
- [ ] Installation works from scratch
- [ ] Mode switching works (fast/rules/llm)
- [ ] No hardcoded paths or credentials
- [ ] Documentation updated
- [ ] CHANGELOG.md updated

## Project Structure

```
OpenClaw-SoftRouter-GitHub/
├── plugin/              # Plugin source code
│   ├── index.ts         # Main plugin logic
│   └── openclaw.plugin.json
├── scripts/             # PowerShell management scripts
│   ├── install.ps1
│   ├── doctor.ps1
│   ├── router.ps1
│   └── uninstall.ps1
├── tools/               # Configuration files
│   └── soft-router-suggest/
│       ├── model-priority.json
│       └── router-rules.json
├── router-sidecar/      # Optional LLM sidecar
├── docs/                # Documentation
└── README.md
```

## Communication

- **Issues**: For bugs and feature requests
- **Discussions**: For questions and ideas
- **Pull Requests**: For code contributions

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to make OpenClaw better!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🚀
