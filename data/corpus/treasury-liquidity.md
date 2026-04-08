# Treasury Liquidity Control Memo

## Operating objective

The treasury desk protects daily funding continuity for card settlements, ACH payouts, and warehouse-backed receivables. The operating objective is to keep unencumbered cash above the minimum runway floor while still preserving enough speed to fund merchants on competitive timelines. In practice, that means treasury watches warehouse utilization, settlement lag, ACH returns, and reserve releases as one connected system rather than as isolated metrics.

## Why warehouse utilization and settlement lag are monitored together

Warehouse utilization and settlement lag are monitored together because they describe the same cash-gap problem from two different directions. Higher warehouse utilization means the firm is closer to the borrowing limit, while longer settlement lag means incoming cash is arriving more slowly than expected. When both move in the wrong direction at the same time, the platform can keep approving volume but still run short on liquid cash before the next inflow clears. Treasury therefore uses a paired alert because warehouse utilization without settlement lag can look safe, and settlement lag without utilization can look temporary, but together they signal real funding pressure.

## Protected funding thresholds

The desk moves into protected funding mode when warehouse utilization rises above 82%, settlement lag stretches beyond 1.8 days, or unencumbered cash falls below 22 days of runway. Protected funding mode slows merchant prefunding, pauses discretionary reserve releases, and routes new high-ticket payouts to manual treasury review. The threshold logic exists to preserve liquidity before the desk is forced into reactive borrowing.

## Same-day funding and ACH return risk

Same-day funding is attractive for merchant growth, but it amplifies ACH return risk because the platform pays out before inbound debits have fully seasoned. If ACH returns spike after same-day funding is enabled, treasury adds a temporary funding buffer, reduces payout acceleration for the affected cohort, and asks payment operations to isolate whether the issue is bank routing quality, merchant behavior, or weak account verification. That response matters because same-day funding can convert a recoverable operational issue into a liquidity event.

## Reporting cadence

Treasury publishes a morning liquidity snapshot, an intraday exception log, and an end-of-day funding summary for the finance lead and the payments operations lead. The snapshot is most useful when it shows threshold proximity, not just raw balances, because raw balances often hide whether reserves or warehouse capacity are already spoken for.
