# LineageSutra AI - Upstream trace

**Format:** `lineagesutra.upstream.v1`  
**Review status:** SUPPORTED_SUBSET_TRACE  
**Tool:** lineagesutra-ai 0.2.0 (created by Vatsal Shah)

**Change target:** `email_metrics.address`

## Upstream columns / datasets

| Node | Kind | Hops | Origin |
| --- | --- | --- | --- |
| `customers_public.email` | direct | 1 | no |
| `customers.email` | direct | 2 | yes |

## Limitations

- Upstream trace follows static column edges only; runtime-only inputs are not visible.

Integrity: SHA-256 `5721330d05319f352c40c76d28fbf90fe1b5b6be950d0fc8d79e6ef014a4218a` (tamper evidence, not a signature)
