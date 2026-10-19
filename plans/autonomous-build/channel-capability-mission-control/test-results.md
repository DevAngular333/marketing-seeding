# Test results

Commands:

```text
cd ui && npm exec tsc -- --noEmit
cd ui && npm run build
```

Results: both passed. Build emitted only the existing Vite native config-loader
warnings for `__dirname` and JSON import attributes.
