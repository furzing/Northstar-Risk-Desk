# Card Authorization Routing Strategy

## Objective

Card routing exists to maximize approved good volume while keeping fraud leakage and processor cost within policy. A routing engine that only optimizes approval rate can still destroy unit economics if it routes risky traffic to the most permissive path.

## Multi-processor logic

The routing policy prefers the primary processor when issuer response quality is stable, but it can fail over to a secondary processor when decline patterns suggest a processor-specific issue. The failover rule is not automatic for every decline type because soft declines, hard declines, and suspected fraud declines should not all be retried the same way.

## Risk-aware routing

Risk-aware routing tags transactions by merchant vertical, amount band, device confidence, and recent dispute behavior. High-risk traffic is intentionally denied the most conversion-maximizing path unless the risk team has explicitly approved an exception. This prevents the system from chasing top-line approvals while quietly worsening downstream loss and chargeback rates.

## Monitoring

The team monitors approval lift, processor cost, issuer timeout rate, retry rate, and downstream dispute impact as one routing scorecard. Approval lift without downstream quality can produce a false positive on routing performance.

## Escalation

Routing changes require a temporary rollback plan whenever they touch high-volume merchants or new geographies. Operations needs that plan because routing mistakes surface quickly in authorization data but may take longer to appear in finance or loss reporting.
