# 01Blog frontend

Angular 22 with Bootstrap 5. See the [root README](../README.md) for database/backend setup, environment configuration and the complete verification workflow.

```bash
npm ci
npm start                    # http://localhost:4200
npm test -- --watch=false     # Vitest component/service tests
npm run build                # dist/frontend/browser
```

Real-browser tests use Playwright and Google Chrome. From the repository root, run `python3 scripts/verify.py` to prepare and clean up isolated servers, a test database and test administrator automatically.

The `e2e` Angular configuration uses `http://localhost:8081/api`; normal development/builds use `src/environments/environment.ts`. `npm run test:e2e` requires the isolated services and test administrator credentials to be supplied already.
