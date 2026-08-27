# Security policy

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for security issues. Do not include an Alibaba Cloud API Key, request payload, private document, or screenshot containing credentials in a public issue.

## Credential handling

- API Keys are entered through Manggo password fields and are sent directly from the local plugin runtime to the selected Alibaba Cloud Model Studio endpoint.
- The plugin has no proxy server, analytics, telemetry, or credential storage of its own.
- Error messages redact the configured API Key.
- Use a Key issued for the selected billing mode and region. Revoke and rotate any Key that may have been exposed.

Only the latest major release receives security fixes.
