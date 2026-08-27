# Contributing

Thank you for helping improve the Manggo and Bob Bailian plugins.

## Before opening a change

- Never include API keys, screenshots containing keys, or private endpoint details.
- Keep runtime code dependency-free. Shared Core must remain platform-neutral; Manggo-only APIs belong in `src/manggo/`, and Bob JavaScriptCore APIs belong in `src/bob/`.
- Use official Alibaba Cloud Model Studio documentation as the source of truth for endpoints and request fields.
- Do not claim Bob support is stable without a macOS Bob 1.8+ installation test.

## Local checks

Install the locked build dependency, build generated adapters, and run the test suite:

```powershell
npm ci
npm run build
npm test
```

Build all three installable packages and their SHA-256 manifest:

```powershell
npm run package
```

Please update `CHANGELOG.md` when a user-visible behavior changes.

## Reporting security issues

Follow [SECURITY.md](SECURITY.md). Do not publish a real credential in a GitHub issue or test fixture.
