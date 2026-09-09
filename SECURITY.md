# Security Policy

## Reporting a vulnerability

**Do not open a public issue.**

Email **hefnyamr@rocketmail.com** with:

- what you found and where
- steps to reproduce
- what an attacker could do with it
- anything you think we would miss

You will get an acknowledgement within 2 working days and an assessment within
5. We will tell you what we intend to do and when, and we will credit you when
it is fixed unless you would rather we did not.

Please give us reasonable time to fix an issue before disclosing it publicly.

## What we consider most serious

In rough order of how badly we want to hear about it:

1. **Cross-tenant data access.** One workshop reaching another's records.
2. **Vehicle event ledger tampering.** Any path that modifies or removes a
   passport event, or that makes a broken chain verify.
3. **Authentication bypass**, session fixation, or privilege escalation.
4. **Share-link escalation.** A passport or estimate token reaching data
   outside its scope.
5. **Personal data exposure.**

## Out of scope

- Findings from automated scanners with no demonstrated impact
- Missing headers with no exploitable consequence
- Social engineering, physical access, denial of service
- Anything requiring an already-compromised device

## What we do

- Isolation enforced in the data-access layer rather than by convention
  ([ADR-0010](docs/03-adr/0010-tenant-isolation-in-data-layer.md))
- Passwords with bcrypt at cost 12; sessions stored only as digests
- Append-only ledger enforced by a database trigger
  ([ADR-0005](docs/03-adr/0005-append-only-vehicle-event-ledger.md))
- Dependency scanning on every build, critical findings blocking the merge
- A penetration test before general availability

The full model, including its known gaps stated openly rather than hidden, is
in [security model](docs/02-design/05-security-model.md).
