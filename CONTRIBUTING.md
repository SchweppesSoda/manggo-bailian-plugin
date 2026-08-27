# Contributing

Thank you for helping improve the Manggo Bailian plugin.

## Before opening a change

- Never include API keys, screenshots containing keys, or private endpoint details.
- Keep the plugin dependency-free and compatible with the Manggo plugin runtime.
- Use official Alibaba Cloud Model Studio documentation as the source of truth for endpoints and request fields.

## Local checks

Run the test suite:

```powershell
& "C:\Program Files\nodejs\node.exe" --test
```

Build the installable package:

```powershell
pwsh -NoProfile -File scripts/package.ps1
```

Please update `CHANGELOG.md` when a user-visible behavior changes.

## Reporting security issues

Follow [SECURITY.md](SECURITY.md). Do not publish a real credential in a GitHub issue or test fixture.
