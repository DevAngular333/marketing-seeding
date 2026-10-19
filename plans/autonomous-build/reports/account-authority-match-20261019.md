# Supplied authority matching — 2026-10-19

## Verdict

`exact LinkedIn profile/account for this campaign only` is not sufficient to satisfy the current exact binding contract. Existing runtime identity can be observed, but it cannot be inferred as the user's intended account without an explicit match.

## Observed runtime identity (redacted-safe)

The canonical state has one enabled/healthy LinkedIn execution account and one active LinkedIn target:

- account ID: `linkedin_primary`
- ORCA profile ID: present in runtime as a UUID (not repeated here)
- target ID: present in runtime (not repeated here)
- target URL: LinkedIn feed URL
- account/profile/target bindings are internally consistent
- readiness is expired, so it is not currently dispatch eligible

No active Design OS Studio campaign or matching authorization exists. Existing authorizations belong to validation or Blender/design campaigns and are terminal or expired/paused/superseded.

## Why the supplied text cannot be derived safely

The existing normalization and authorization path requires an exact destination tuple:

`platform + accountId + targetId + profileId + targetUrl`

It also requires a campaign record, approved content hash or approved template binding, valid UTC window, visibility policy, and campaign scope fingerprint. The supplied authority provides the platform, semantic campaign/product labels, public visibility, audience, window, quota/cadence/concurrency, and a non-secret reference, but does not provide:

1. exact `accountId`;
2. exact ORCA `profileId` UUID;
3. exact `targetId`;
4. exact target URL;
5. approved launch-post bytes or SHA-256 content hash;
6. media artifact hash(es), if the approved post contains media;
7. an existing campaign ID/product-repository binding for `design-os-studio`.

Using the sole observed LinkedIn account as an implicit match would be a guess and would violate exact account/profile authorization. Reusing any validation/Blender campaign or content hash would violate campaign and content identity binding. Expired readiness also cannot be promoted to fresh readiness by authority text.

## Safe next input contract

To proceed, the authority must be bound explicitly to the existing account/target/profile tuple (or a newly registered exact tuple) and include approved content identity:

- exact account ID;
- exact ORCA profile UUID;
- exact target ID and target URL;
- approved post content bytes or SHA-256 hash;
- media hash(es) or explicit `no media`;
- product repository/campaign ID or an authorized campaign creation binding.

After those are supplied, the system may perform the normal authorization flow, fresh readiness check, one-time window, grant, lease, and exact execution gates. This report records no mutation and derives no live controls.
