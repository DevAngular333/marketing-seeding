# Discovery feed observer — remaining gaps

- Feed parsing is intentionally bounded and lightweight; it is not a general
  XML parser and does not certify any external channel.
- Feed sources still require an explicit campaign configuration and channel
  policy. Discovery remains advisory and cannot derive execution authority.
- No live external feed was used as proof. A future operational rollout needs
  source-specific policy, crawl scheduling and observability review.
- LinkedIn autonomous publish and independent publication verification remain
  blocked by missing exact campaign authority and browser/session proof.
