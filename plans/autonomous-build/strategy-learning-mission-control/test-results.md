# Test results

```text
cd ui && npm exec tsc -- --noEmit                 PASS
cd ui && npm run build                            PASS
node --test test/dashboard-ui.test.mjs test/workflow-ui.test.mjs
5 passed, 0 failed, 0 skipped
```

The production build emitted only existing Vite config-loader warnings.
