# Click transport and activation observability report

## Outcome

The ORCA browser path remains an accessibility element transport:
`LinkedInAdapter.submit` → `OrcaCliClient.click` → `orca click --element … --page …` → command receipt.
The receipt is explicitly `COMMAND_COMPLETED`; it does not imply activation. Immediate preflight revalidates the control and hit target before transport.

Activation evidence now records semantic transitions, sanitized active-element evidence, ARIA expansion, related-component visibility, timestamps, and state hashes. Focus counts only when it lands on the target control. Acceptance and verification remain separate.

## Verification evidence

- Click transport focused tests: 12 passed, 0 failed.
- LinkedIn focused tests: 47 passed, 0 failed.
- JEV/browser focused tests: 26 passed, 0 failed.
- Full suite: 266 total, 264 passed, 0 failed, 2 skipped; process exited normally.
- Safe browser calibration: ORCA `1.4.227`, profile `b27a3bcc-b139-4353-a15b-10e10824291e`; search input and language combobox were used only. An earlier fresh search click produced the positive `body → input#_r_3_` focus transition; repeated search and pointer sequences returned `clicked`/completed without a new transition. No Post click or social mutation occurred.
- Canonical runtime: revision `193`, schema `8`, SHA-256 `327688c03b5f535e4cc8082837a3cd338db74b74207b86887eef2ae9ed965aae` before and after.

## Limitation

The current LinkedIn page did not provide a repeatable positive activation transition for the safe controls in the final calibration pass. The synthetic fixture and semantic receipt tests pass. A future controlled attempt must still require positive post-click evidence; command completion alone is insufficient.
