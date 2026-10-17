# Changes

- Added bounded `postAttributionContext` to advisory learning feedback.
- Added normalized status precedence and global status counts while retaining
  high-risk rows before the bounded context cap.
- Replaced raw account/profile identity values in the learning context with
  short deterministic fingerprints; raw values remain internal to validation.
- Added campaign-aware post/target/account/profile/channel validation before
  strategy exposes attribution context.
- Added regressions for late UNKNOWN retention, bounded counts, foreign posts,
  target identity drift and unchanged publish/UNKNOWN precedence.
- No authority, execution, browser, provider, publication or schema changes.
