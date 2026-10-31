# NAFDAC integration

## What exists today (checked Oct 31 2026)

NAFDAC publishes **no developer API**. We found no API documentation, developer portal or third-party terms for any NAFDAC system.

| NAFDAC system | What it is | Open to third parties? |
|---|---|---|
| Greenbook (greenbook.nafdac.gov.ng) | Public search of registered products (about 6,400–7,000 at launch in 2024). NAFDAC says some registered products are missing because holders submit data slowly. | Website only |
| Traceability Information System + Scan2Verify (GS1 Nigeria) | Health workers scan the GS1 DataMatrix to verify against the Greenbook and record custody events. MNCH+N pilot since 2025. | Closed |
| MAS scratch codes | SMS PIN to a provider short code (e.g. Sproxil 38353) | Per provider; not every pack |
| Pharmaceutical Products Traceability Regulations 2024 | Requires a GS1 DataMatrix (GTIN, batch, expiry, serial) on each unit, phased in | n/a: the standard we read |

Sources: [NAFDAC traceability](https://nafdac.gov.ng/nafdac-traceability-find-out-all-you-need-to-know-here/), [Traceability Regulations 2024](https://nafdac.gov.ng/wp-content/uploads/Files/Resources/Regulations/REGULATIONS_2021/NAFDAC-Pharmaceutical-Products-Traceability-Regulations-2024.pdf), [Greenbook launch](https://nairametrics.com/2024/01/18/nafdac-unveils-greenbook-registered-drug-database-for-drug-information-access/), [Greenbook gaps](https://nannews.ng/greenbook-nafdac-tasks-marketing-authorisation-holders-on-product-submission/), [Scan2Verify](https://apps.apple.com/us/app/id6738647665), [MAS](https://www.mondaq.com/nigeria/healthcare/102588/national-agency-for-food-drugs-administration-and-control-nafdac-unveils-new-anti-counterfeiting-service).

What we will not do: bulk-scrape the Greenbook, call its hidden endpoints, or treat third-party copies (e.g. Apify) as a source of truth (CLAUDE.md rule 11).

## How TrueMed is built for it

`backend/src/registry/index.js` routes every "is this number registered?" question to the source that can answer it honestly:

| Number | Source | Label in the evidence trail |
|---|---|---|
| `DEMO-*` | NAFDAC sandbox (below) | "NAFDAC sandbox, simulated" |
| Matches a hand-copied seed record | `seed/products.json`, `sourceUrl` per record | "NAFDAC Greenbook, copied by hand" |
| Anything else | Real NAFDAC API if `NAFDAC_API_URL` is set, else one cached Greenbook lookup (off until its request shape is confirmed by hand) | "NAFDAC registry API" / "NAFDAC Greenbook portal" |

Rules the router keeps:
- Only an explicit `not_registered` answer can fail `REG_NOT_FOUND`. Timeouts, errors, unknown status codes and `outside_sandbox` are `unavailable`, so the check is skipped and the verdict falls to "No record" (D27).
- Demo numbers never go to a real NAFDAC source; the sandbox never answers for a real number.
- Gate 1 receipts of DemoQuin units are sent to the sandbox as custody events. Real packs are sent nowhere.

Connecting a real NAFDAC endpoint that speaks this contract is configuration: set `NAFDAC_API_URL` and `NAFDAC_API_KEY`. A different contract is one adapter next to `registry/client.js`.

## The sandbox contract

Base: `https://api.truemed.finessedev.space/sandbox/nafdac/v1`. Every response carries `"sandbox": true` and a notice that it is simulated by TrueMed and not operated by NAFDAC. Scope: the fictional DemoQuin brand only.

| Call | Answers |
|---|---|
| `GET /` | Endpoint list |
| `GET /registrations/:regNo` | `200 {status:"registered", product}` · `404 {status:"not_registered"}` · `422 {status:"outside_sandbox"}` |
| `GET /verify?gtin=&serial=&batch=&expiry=` | Product, registration, unit status (`dispatched`, `not_dispatched`, `not_issued`, `not_provided`), batch/expiry mismatches, last custody event |
| `GET /events?gtin=&serial=` | Custody trail of one unit |
| `POST /events` | Record `receive`, `dispense`, `return` or `destroy`. Accepted only from the TrueMed server itself; the public sandbox is read-only. |

Try it: `GET /registrations/DEMO-0001` (registered) and `GET /registrations/DEMO-0099` (not registered, used by the "Unregistered number" sample pack).

## The ask

A pilot with NAFDAC and GS1 Nigeria: read access to registration status and, for traceability pilot products, unit verification and custody events, in whatever form NAFDAC prefers. TrueMed already reads the GS1 DataMatrix the 2024 regulation requires, so it can report receiving and verification events from every pharmacy door and home scan back to the regulator.
