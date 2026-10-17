# Click transport and activation observability

## Requirements

- A1. Keep browser command completion separate from control activation.
- A2. Revalidate the final control immediately before the single browser input.
- A3. Record sanitized activation transitions and state hashes.
- A4. Keep activation separate from platform acceptance and publication verification.
- A5. Preserve UNKNOWN quarantine and perform no live publication.

## Constraints

- C1. No retry, reconciliation, or mutation of execution `ce9cfc41-528b-425f-9dee-ab2563b50ed3`.
- C2. No LinkedIn final Post click in this task.
- C3. No Reddit, Facebook, or Threads live work.

## Verification

- V1. Click transport, LinkedIn, and JEV focused tests pass with zero failures.
- V2. The full marketing-seeding suite exits normally with zero failures.
- V3. Canonical runtime revision and hash are unchanged.
- V4. Safe browser calibration uses only reversible controls.
