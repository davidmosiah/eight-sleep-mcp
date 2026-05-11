# Contributing

Contributions are welcome, especially around: tracking upstream endpoint changes, expanding privacy-safe normalization, adding mutation guardrails, agent setup examples, and tests.

## Local development

```bash
npm ci
npm run typecheck
npm run build
npm run smoke
```

## Design rules

- Keep the project explicitly **unofficial** and unaffiliated with Eight Sleep.
- Never commit account credentials, tokens or personal sleep exports.
- Read-only by default. Mutations are gated by `EIGHT_SLEEP_ALLOW_MUTATIONS=true`.
- Tools should return both text content and structured content.
- Error messages should be actionable without revealing secrets.
- Sleep/temperature outputs should be framed as wellness context, not medical advice.
- When upstream endpoints break, prefer mirroring the fix from `lukas-clarke/eight_sleep` / `pyEight` rather than guessing.

## Pull request checklist

- `npm run typecheck` passes.
- `npm run build` passes.
- `npm run smoke` passes.
- README/tools docs are updated when behavior changes.
- Any new tool documents whether it's read-only or gated by `EIGHT_SLEEP_ALLOW_MUTATIONS`.
