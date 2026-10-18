# Changes

- Added one isolated restart/lease-recovery regression at
  `test/dry-run-restart-soak.test.mjs`.
- Seeded an explicit rehearsal candidate through the existing campaign,
  story, template, target, account and authorization contracts.
- Added three post-restart scheduler/worker ticks and an expired-lease seed to
  prove cleanup and safe reacquisition.
- Added assertions for one request/receipt/post, no duplicate adapter call,
  no live controls, no publication evidence and UNKNOWN immutability.
- No production source, schema, route, browser adapter or canonical state was
  changed.
