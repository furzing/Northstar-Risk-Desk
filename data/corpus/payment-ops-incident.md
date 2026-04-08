# Payment Operations Incident Review: Same-Day Funding and ACH Returns

## Incident summary

Payment operations observed a spike in ACH returns within five business days of enabling same-day funding for a newly expanded merchant cohort. The rise was concentrated in merchants with weaker bank-account verification coverage and unusually fast payout expectations. The incident did not start as a fraud event, but it had fraud-like symptoms because funds left the platform before inbound settlement quality was proven.

## Root cause view

The immediate problem was not the funding speed on its own. The problem was the combination of same-day funding, loose verification coverage, and routing decisions that favored speed over debit-quality confidence. That mix allowed payment operations to scale payout velocity faster than treasury and underwriting controls were prepared to absorb.

## Recommended response

When same-day funding causes ACH returns to spike, payment operations should isolate the affected merchant cohort, suspend the accelerated payout setting for that cohort, and re-run bank verification on the highest-loss accounts. The team should also review routing rules, because poor bank routing quality can make ACH returns look like a merchant-quality issue when the failure actually sits in payment orchestration.

## Cross-functional actions

Treasury adds a temporary funding buffer, underwriting reviews reserve sufficiency, and fraud operations checks whether the return pattern overlaps with known abuse clusters. The response is intentionally cross-functional because ACH returns touch liquidity, merchant quality, and control design at the same time.

## Prevention

Future launches should gate same-day funding behind proven debit-quality coverage, reserve capacity, and a cohort-level return-rate ceiling. Launching speed features without those controls creates the illusion of growth while shifting risk into operations and treasury.
