# Fraud Loss Playbook for Consumer and Merchant Risk

## Fraud taxonomy

The risk team separates first-party fraud, account takeover, synthetic identity fraud, and merchant abuse because the controls differ even when the loss surface looks similar. A single fraud rate number is not useful enough for action if the underlying mechanism is unclear.

## First-party fraud versus account takeover

First-party fraud occurs when the legitimate customer authorized the transaction and later disputes repayment or intent. Account takeover is different because an external actor hijacks credentials or session control and initiates activity the customer did not authorize. The distinction matters because first-party fraud is usually controlled through underwriting, limits, and dispute evidence, while account takeover is controlled through authentication, device intelligence, and behavioral anomalies.

## Escalation signals

The playbook escalates when repayment behavior breaks from prior cohorts, device reuse clusters around new identities, or a merchant shows a sudden jump in refund avoidance paired with fulfillment complaints. These signals are more informative in combination than in isolation, which is why fraud triage reviews both customer and merchant-side evidence together.

## Immediate controls

Immediate controls include lowering transaction limits, tightening step-up authentication, slowing instant disbursement, and suppressing retry logic on obviously risky funding sources. The wrong response is to maximize friction everywhere because broad friction can damage good-user conversion without materially reducing organized abuse.

## Reporting

Fraud reporting distinguishes controllable operational leakage from structural credit loss. That separation matters because the mitigation owner is different even when the finance line item ends up in the same loss summary.
