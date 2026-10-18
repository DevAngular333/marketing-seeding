# Discovery fit compatibility — Changes

- Added a local `hasFitHints()` check in `src/discovery.mjs`.
- No-fit observations no longer receive an all-UNKNOWN `fit` object.
- Added regression coverage for no-fit shape and actual service persistence → strategy research selection.
- Existing explicit fit evaluation and strategy filtering were left unchanged.
