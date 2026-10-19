# Discovery feed observer — changes

- Added bounded RSS and Atom item extraction to the existing public observer.
- Added safe same-origin item URL handling and source IDs.
- Added separate normalized feed `publishedAt` evidence.
- Fixed response-body inspection ordering so octet-stream detection cannot
  reference an uninitialized body.
- Added RSS, Atom, malformed-feed, unsafe-link, octet-stream and timestamp
  regression coverage.
