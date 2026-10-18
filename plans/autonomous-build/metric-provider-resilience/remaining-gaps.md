# Remaining Gaps

- Live provider rate-limit headers, permissions and response authenticity are
  still unverified.
- Retry behavior is bounded and locally deterministic, but exact provider
  cadence remains governed by the existing checkpoint-aware scheduler.
- No live metrics were collected and no external side effect was attempted in
  this milestone.
