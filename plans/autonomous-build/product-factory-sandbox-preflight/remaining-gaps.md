# Remaining gaps

- The host has `/usr/bin/sandbox-exec`, but the backend is deprecated and no
  audited product profile or CPU, memory, file descriptor, process, or
  descendant cleanup limits are proven.
- `executionEligible` therefore remains `false`, and arbitrary project
  commands remain `NOT_EXECUTED_UNSAFE`.
- A future sandbox milestone needs an independently reviewed backend/profile,
  resource limits, network and filesystem policy, descendant cleanup, and
  representative fixture probes before project build/render execution can be
  enabled.
