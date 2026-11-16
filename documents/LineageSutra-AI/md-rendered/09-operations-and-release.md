# Operations and release

## Requirements

Node.js 20 or newer. Nothing else.

## Install

```bash
npm install -g lineagesutra-ai      # or: npx lineagesutra-ai ...
```

## CI

`.github/workflows/ci.yml`: test matrix (Ubuntu Node 20/22/24, Windows Node 20/22, macOS Node 22), demo, audit upload, npm-pack clean-install smoke test, secret scan.

## Release

1. Update `CHANGELOG.md` and the version in `package.json`.
2. `npm test && npm run proof`.
3. Commit, tag `vX.Y.Z`, push.
4. `release.yml` publishes with npm trusted publishing and provenance if configured; otherwise `npm publish --access public` from a logged-in machine.
5. Check: `npx lineagesutra-ai@X.Y.Z --version`.

## Checklist

Tests green on all matrix entries; audit PASS; no tokens in tree; README claims match `docs/STATUS.md`; changelog truthful.

## Support

GitHub issues; volunteer-maintained; no SLA.
