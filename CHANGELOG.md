# Changelog

## 2.1.0 - 2026-08-27

- Refactor billing, language, thinking, request, response, and redaction behavior into a platform-neutral Core.
- Keep the Manggo translation and OCR services in one `.mplugin` without changing their external service contract.
- Add independent Bob 1.8+ translation and OCR packages with secure settings and three billing modes.
- Add cumulative SSE translation streaming, cancellation support, Qwen-MT full-language-name requests, and non-streaming Bob OCR rows.
- Build and validate all three packages with one version and a SHA-256 checksum manifest.
- Add two independent Bob publishing repositories with stable appcast metadata and automatic `bobplugin` indexing; real Bob host validation remains documented as Early Access.

## 2.0.0 - 2026-08-27

- Add explicit pay-as-you-go, Coding Plan, and Token Plan billing modes.
- Add China and Singapore pay-as-you-go routing, Workspace ID routing, and an HTTPS-only custom Base URL override.
- Add pay-as-you-go presets for Qwen MT Plus and Qwen 3.5 OCR.
- Preserve optional thinking controls with model-aware request parameters.
- Replace the Alibaba Cloud product mark with an original redistributable plugin icon.
- Add an MIT license, security policy, CI workflow, and public-release documentation.

## 1.1.0 - 2026-08-27

- Add service icons and selectable reasoning effort.

## 1.0.0 - 2026-08-27

- Initial local release with translation and OCR services.
