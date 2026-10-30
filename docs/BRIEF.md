# TrueMed: Pitch and Build Brief

Oct 30, 2026 · @muyiwa

## The Meta AI thesis

TrueMed puts Meta AI at every hand a medicine passes through in Nigeria, so a single photo can reveal whether a pack is lying and where it really came from.

**One-line pitch:** "Snap any medicine and Meta AI tells you, in your own language, whether the pack is lying and where it really came from. The same AI guards every pharmacy's door."

**The thesis:** the ledger knows where every pack should be; Meta AI checks whether it really is, at every hand, from a single photo. No barcode scanners, no new labels, no special hardware.

| Criterion | Weight | How TrueMed earns it |
| --- | --- | --- |
| Impact | 30% | Covers the whole Nigerian chain (open markets, pharmacies, licensed chemists, street sellers, the home), built on real 2026 NAFDAC cases and a pharmacist's firsthand account |
| Use of Meta AI tooling | 25% | Meta's hosted models (Muse Spark, SAM 3.1, Muse Voice Transcribe) and four AI agents, each doing work nothing else in the system can do |
| Demo (incl. video) | 25% | One pack's story with four AI-led moments, filmed in a real pharmacy and a real home |
| Technical depth | 20% | Agents with tools, hard-fact rules, a shared ledger, a confirmation step, published accuracy numbers |

- **Theme:** Build for Your World, a problem you live firsthand.
- **Track:** Indie developer, judged on creativity, technical ambition and whether it works.
- **Deadline:** Wed Nov 4, 9 PM EST = 3 AM Thu Nov 5 Lagos. Submit by Wednesday afternoon.

## The problem: where fakes enter in Nigeria

Fakes flow from imported containers and open markets into licensed shops and homes, and today no tool follows a pack along that path or explains it to the person about to take it.

- **The scale.** WHO estimates about [1 in 10 medical products](https://www.news-medical.net/news/20171205/1-in-10-medical-products-found-to-be-substandard-or-falsified-in-low-and-middle-income-countries.aspx) in low- and middle-income countries is substandard or falsified, and bad antimalarials may cause about 116,000 extra deaths a year in sub-Saharan Africa.
- **Open markets are the main entry point.** NAFDAC has linked the Idumota market network to [more than 80% of medicine supply](https://businessday.ng/?p=1171420); the Pharmacists Council calls open drug markets [a threat to public health](https://guardian.ng/features/open-drug-markets-threat-to-public-health/). Pharmacists confirm they buy from authorized suppliers and fill gaps at the open market.
- **It's not only medicine.** NAFDAC says [cosmetics, food and beverages make up over half of seizures](https://guardian.ng/?p=2861874), including ["Coglaet" toothpaste](https://guardian.ng/features/health/nafdac-raises-alarm-over-suspected-counterfeit-toothpaste-in-kaduna/) and [date-tampered Cerelac](https://webiis10.mondaq.com/nigeria/healthcare/1787778/updates-on-the-recent-activities-and-other-developments-at-national-agency-for-food-and-drugs-administration-control-nafdac).
- **The tricks:** containers of imported fakes, expired stock relabeled with future dates, real registration numbers copied onto fakes, lookalike brand names.
- **Where people buy.** Roughly [4,500 pharmacies versus an estimated 100,000 licensed chemists](https://solve.mit.edu/solutions/95136) (patent and proprietary medicine vendors), plus unlicensed street sellers.

**What exists, and the gap:**

| Tool | What it does | What it can't do |
| --- | --- | --- |
| [MAS scratch codes](https://nafdac.gov.ng/?p=2429) | Text a PIN, get genuine or fake | Only on some products; one code at a time |
| [Greenbook](https://allafrica.com/stories/202511130105.html) | Look up a registration number | Can't tell if this pack is genuine |
| [GS1 traceability rules](https://gs1nigeriaweb.azurewebsites.net/?p=2397) (2024) | Require serial barcodes and electronic traceability records | Consumers can't read them; small shops lack tools |
| [Scan2Verify](https://nafdac.gov.ng/nafdac-traceability-find-out-all-you-need-to-know-here/) | Health workers scan 2D codes | No packaging checks, no shop binding, English only |

None of them reads the whole pack, knows which shop it belongs to, or explains the result in the buyer's language. That is the gap Meta AI fills.

## The product: four Meta AI agents and one ledger

TrueMed is four Meta AI agents working on top of one shared ledger, at two gates: the pharmacy or chemist's receiving counter, and the buyer's home.

### The Inspector: Muse Spark + SAM 3.1

- Reads any pack from a phone photo: name, strength, NAFDAC number, batch, dates, serial. No scanner needed.
- SAM 3.1 isolates the label, date block, seal and barcode, then outlines exactly where the evidence is.
- Compares the artwork with the genuine reference, spots lookalike brand names, and looks for tampering on the date area.
- Before any hard verdict built on printed text, it shows the user what it read and asks them to confirm.

### The Voice: Muse Voice Transcribe + Muse Spark

- Asks "Where did you buy it?" before revealing anything, then understands the spoken answer in English or Pidgin and matches it to a registered shop. (Yoruba and Hausa speech input is on the roadmap via Meta's open speech models.)
- Explains every result in the user's language: written in English, Pidgin, Yoruba or Hausa; spoken in English and Pidgin, with Yoruba and Hausa audio as a stretch goal.

### The Sentinel: Muse Spark with web search

- Turns each NAFDAC alert into structured batch and registration records.
- Instantly warns every pharmacy and chemist whose logged stock matches.

### The Investigator: Muse Spark with long context and tools

- On any flag, reads the pack's full scan history, the shops involved, the photos and matching alerts.
- Writes a ready-to-send case file for NAFDAC and the Pharmacists Council. The user reviews and sends it.

### The Ledger: memory, not AI

- Logs every receiving scan and buyer scan, with the source tagged as authorized supplier or open market.
- Catches clones (the same serial logged twice), the wrong shop, packs already sold, and serials never issued by the manufacturer.
- **Hard facts decide High risk. AI on its own can only raise Caution.**

### Two gates

- **Gate 1, receiving:** a pharmacist or licensed chemist checks each pack before it reaches the shelf, whichever channel it came from. Single packs by photo; whole cartons by video, with SAM 3.1 tracking every pack.
- **Gate 2, home:** anyone scans before taking a medicine, wherever it was bought.

| Result | Meaning |
| --- | --- |
| Genuine: authorized chain | All checks pass, shop confirmed, supplied by an authorized supplier |
| Checked: open-market source | All checks pass, shop confirmed, bought at market and checked on receipt |
| No red flags | Checks pass; the shop isn't in the network yet |
| Caution | Only AI-judged concerns, or a nearby repeat scan |
| High risk | A hard fact fails: unregistered, alert batch, expired, clone, wrong shop, serial never issued |
| No record | Not in our data. "This does not mean it's fake." |

## Real fakes, and the agent that catches each

Every check in TrueMed maps to how a real fake was caught, so each demo moment can say "based on a real NAFDAC case."

| Case | The trick | How TrueMed catches it | Who |
| --- | --- | --- | --- |
| [Herceptin](https://nairametrics.com/2026/03/26/nafdac-alerts-nigerians-over-counterfeit-stomach-cancer-drug-herceptin-in-circulation/), 2026 | Wrong artwork, wrong expiry, invalid 2D code | Artwork comparison, GS1 validity, barcode vs print | Inspector |
| [Chloroquine](https://nairametrics.com/?p=479031), 2026 | Registration number not in NAFDAC's database | Registry lookup | Rules |
| [SMA Gold](https://allafrica.com/stories/202602230576.html), 2026 | Date markings altered | Tamper check, shelf-life plausibility, barcode vs print | Inspector + Rules |
| ["Coglaet" toothpaste](https://guardian.ng/features/health/nafdac-raises-alarm-over-suspected-counterfeit-toothpaste-in-kaduna/), 2026 | Lookalike brand, no registration | Lookalike name detection, registry | Inspector |
| [Dostinex](https://www.vanguardngr.com/?p=2829195), 2026 | Specific falsified batches | Alert batch match | Sentinel |
| Copied serial (demo) | Real code copied onto fakes | Clone across shops, wrong shop | Ledger + Voice |
| Container fake (demo) | Invented serial | Serial never issued by manufacturer | Ledger |

**Hard facts (can produce High risk):** registration exists and matches the product, alert batch, expiry, barcode matches print, GS1 validity, clone, wrong shop, serial never issued, and **shelf-life plausibility** (an expiry far beyond the product's normal shelf life gets flagged).

**AI judgement (Caution at most):** artwork differences, tampering signs, lookalike names.

**Safety step:** the user confirms what the AI read before any High risk built on printed text.

## Architecture and Meta tooling

A Flutter web app sends every scan to a Node backend where the Inspector and Voice agents gather evidence, the ledger supplies memory, and a rule engine sets the verdict.

```
Flutter web app (Gate 1 receiving, Gate 2 home scan)
   │ photo / video                    │ spoken answer
   ▼                                  ▼
Inspector (Muse Spark + SAM 3.1)    Voice (Voice Transcribe + Muse Spark)
   │                                  │
   └──────────► Rule engine ◄─────────┘
                (hard facts decide)
                    ▲
                    │
   Ledger (shops, sources, serials) ◄── Sentinel (Muse Spark + web search:
                    │                    NAFDAC alerts → batch records)
                    ▼
   Result (graded verdict, evidence, spoken explanation)
                    │ on any flag
                    ▼
   Investigator (Muse Spark, long context, tools) → case file for NAFDAC
```

| Meta tool | Job in TrueMed |
| --- | --- |
| Muse Spark (`muse-spark-1.3`) | Reads packs into structured fields, compares artwork, matches spoken shop answers, writes explanations in four languages, powers the Sentinel and Investigator agents |
| SAM 3.1 (`sam-3.1`) | Finds the label, date, seal and barcode regions; outlines evidence; tracks every pack in carton videos (confirmed on the hosted API) |
| Muse Voice Transcribe | Spoken answers in English and Pidgin from people who can't or won't type |
| Meta open-weights speech models (MMS) | Stretch only: Yoruba and Hausa audio, if quality holds up in testing |
| Muse Code | Speeds up the build; credit it in the README |

Muse Image is deliberately left out: it has no real job here, and forced integrations cost credibility.

**Engineering rules:** API keys only on the backend; rate limits per session; a spend limit on the $150 credit; backend always on during judging (Nov 5–9); built-in sample packs so judges on laptops can test in 20 seconds; receiving scans queue offline.

## Loopholes and honest answers

No system beats a well-funded cartel perfectly; TrueMed narrows every route and says plainly where its limits are.

| Threat | TrueMed's answer | Honest limit |
| --- | --- | --- |
| Container fakes copying real names and numbers | Alert batches, invalid GS1 codes, clones across shops, artwork checks, serial never issued | Perfect copies with invented serials pass until brands share issued-serial lists: the key roadmap item |
| Expired stock relabeled with future dates | Barcode vs print, tamper detection, shelf-life plausibility | Professionally reprinted packs without barcodes may pass the AI |
| AI misreads a batch or date | User confirms the reading; low-confidence reads can only give Caution | None in practice |
| Batch-only packs (no unit serial) | Shop mismatch becomes a Caution signal | Weaker than unit-level binding, and said so |
| Leading question at the shop check | Ask "Where did you buy it?" first, reveal after | None |
| Counterfeiters using the app to perfect fakes | Full evidence only for verified pharmacists; plain reasons for anonymous users; repeated-probe flags | Some signal leaks unavoidably |
| Verified seller cheating | Each serial sells once; reconciliation flags the shop | Caught over days, not instantly |
| Buyers who never scan | Gate 1 stops fakes before the shelf | No protection at the sale itself |
| Whistle-blower intimidation | Reports go privately to NAFDAC | Physical safety is beyond an app |
| Substandard contents in genuine packs | Out of scope | Needs a lab |

**Never** generate realistic packaging of real brands for the demo, and never use real pharmacy or business names for demo shops. Use NAFDAC's published details, genuine packs you buy, the fictional DemoQuin brand, and fictional shop names.

## Build plan

Three build days, one day to test and film, one day for the video, and Wednesday as buffer. (Detailed milestones and checklists are in `CLAUDE.md`.)

**Fri Oct 30: the Inspector**

- [ ] Test Muse Spark, SAM 3.1 (phrase, box prompt, video) and Voice Transcribe (English + a Pidgin sentence)
- [ ] Inspector: photo to structured fields, plus the confirm step
- [ ] Rule engine: registry, product match, alert batch, expiry, shelf-life plausibility, barcode vs print
- [ ] Seed data: 20–30 products (hand-copied from Greenbook), the 2026 alerts, DemoQuin issued serials

**Sat Oct 31: ledger, gates and voice**

- [ ] Ledger: pharmacies and licensed chemists, sources, serials; clone, wrong shop, already sold, never issued
- [ ] Gate 1 receiving screen and Gate 2 home scan in Flutter web
- [ ] Voice: "Where did you buy it?" asked first, spoken answers understood, results spoken
- [ ] SAM evidence highlights on every result

**Sun Nov 1: agents, carton video and deploy**

- [ ] Sentinel: paste a NAFDAC alert, approve the parsed records, warn matching shops
- [ ] Investigator: tools over the ledger, case file with a visible reasoning trail
- [ ] Carton video receiving with SAM 3.1 tracking
- [ ] Deploy: always-on backend, rate limits, spend limit, judge sample packs

**Mon Nov 2: test and film**

- [ ] 25+ real packs through the eval; zero false High risk on genuine packs; record the numbers
- [ ] Film at a real pharmacy and a real home; record the pharmacist clip

**Tue Nov 3: the video**

- [ ] Edit the 3-minute video; write the README and architecture notes; code freeze tonight

**Wed Nov 4: submit**

- [ ] Final checks; submit by Wednesday afternoon Lagos time

**If behind, cut in this order:** hotspot map, Yoruba and Hausa audio, carton video, Investigator polish. Never cut the Inspector, the confirm step, the clone demo or Gate 2.

## Demo video

One pack's story, four AI-led moments, under three minutes.

1. **0:00–0:20, the human.** A pharmacist on camera describes buying at the open market. Then: "WHO estimates about 1 in 10 medical products in poorer countries is substandard or falsified."
2. **0:20–0:50, Gate 1.** The pharmacist photographs market stock. The Inspector reads it, SAM outlines the date: "The barcode says 2025, the box says 2028." Rejected before it reaches the shelf. *Caption: Muse Spark, SAM 3.1.*
3. **0:50–1:20, the clone and the container fake.** A second pharmacy logs a pack: "This serial was already received by a pharmacy in Kano." A DemoQuin pack with an invented serial: "This serial was never issued by the manufacturer."
4. **1:20–2:00, the kitchen table.** A mother scans her child's medicine. The app asks where she bought it; she answers in Pidgin. It replies aloud: "Received by Ikeja Care Pharmacy (demo), bought from the open market, checked on arrival. No problems found." *Caption: Voice Transcribe, Muse Spark.*
5. **2:00–2:30, the agents.** A NAFDAC alert is pasted and every shop holding the batch is warned. A flag becomes a case file in seconds, with the agent's reasoning visible.
6. **2:30–2:50, the proof.** The architecture and the accuracy numbers from the test set.
7. **2:50–3:00, the close.** "Meta AI at every hand. Every pack tells the truth."

**Rules:** name each Meta model on screen when it works; film on a real phone in real places; show the numbers; state the main limit before a judge asks; use only fictional shop names on screen.

## Pitch, judge questions and the production roadmap

Open with the human problem, answer the hard questions before they're asked, and show that production is a clear path, not a leap.

**Opening line:** "Most of Nigeria's medicine flows through open markets that regulators call a major source of fakes. I built TrueMed so Meta AI checks every pack at the pharmacy door and at the kitchen table."

| Judge's question | Answer |
| --- | --- |
| "NAFDAC already has tools." | Each checks one thing. TrueMed reads the whole pack, knows which shop it belongs to, and speaks the buyer's language. It complements NAFDAC. |
| "A perfect fake would pass." | Until brands share issued-serial lists, yes. That integration is the first production step, shown in the demo with DemoQuin. |
| "What if the AI is wrong?" | Hard facts decide; the user confirms what the AI read; AI alone gives Caution at most. Here are our accuracy numbers. |
| "Does the chain only work for your fake brand?" | No. Real GS1-coded packs get shop binding the moment a pharmacy or chemist logs them. |
| "Who benefits on day one?" | Any pharmacy or chemist gets pack checks and recall alerts immediately; clone detection grows as shops join. |
| "Where does the data come from?" | NAFDAC's Greenbook registry (seeded by hand; a formal data request has been sent) and public alerts, the network's own scans, and brand data later. |

**What changes for production:**

- Brand issued-serial lists and integration with NAFDAC's traceability system
- Official Greenbook data access (formal request to NAFDAC)
- Yoruba and Hausa speech input and output via Meta's open speech models
- A tamper-evident audit log and weighted reporting
- A WhatsApp channel and an offline-first chemist app
- Partnerships with NAFDAC, the Pharmacists Council and the coordinated wholesale centres
- Brand dashboards for hotspots and leaks: the business model

## Scores, odds and open questions

TrueMed scores about 8.6 out of 10 on Meta's rubric; the remaining gap is execution, not the idea.

| Criterion | Score | What raises it |
| --- | --- | --- |
| Impact (30%) | 9 | A real pharmacist on camera |
| Use of Meta AI (25%) | 8.5 | Carton video tracking working; model captions on screen |
| Demo (25%) | 8.5 | One continuous pack story, filmed for real |
| Technical depth (20%) | 8 | Published accuracy and false-alarm numbers |

**Rough odds** (judgment estimates, not data): with excellent execution, about 20–30% to reach the final shortlist, 6–12% to win an indie cash prize, 2–4% for first place, and 10–15% for a community or viral bonus prize if you rally your audience within the rules.

**Odds against:** thousands of entries and teams of up to four; other fake-drug projects; judges' unknown taste; real-pack accuracy; three days of building solo.

**Open questions:**

- [x] SAM 3.1 text prompts and video on the hosted API: confirmed (`sam-3.1`)
- [x] Greenbook data: no public API; seed by hand, optional single cached lookup, formal request to NAFDAC
- [x] Pharmacist on camera: agreed
- [ ] Does Pidgin transcribe acceptably on Voice Transcribe in English mode? (test Friday)
- [ ] What do the Discord submission rules require? (check before Tuesday)
- [ ] Yoruba and Hausa audio via Meta's open speech models: worth it? (decide Monday)

## Sources

- [Judging weights and prizes – AImagazine](https://aimagazine.blog/meta-opens-its-1m-global-ai-developer-hackathon-20000-seats-150-api-credits-each-and-applications-close-october-25/)
- [Track prize split – madrobot](https://madrobot.blog/2026/10/03/meta-global-ai-developer-hackathon-1-million-prizes-muse-model-api/)
- [Meta Global AI Developer Hackathon – Cerebral Valley](https://cerebralvalley.ai/e/meta-ai-developer-hackathon.md)
- [Meta Model API: SAM overview](https://dev.meta.ai/docs/sam/overview)
- [Meta Model API: Pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits)
- [WHO falsified medicines estimates – news-medical](https://www.news-medical.net/news/20171205/1-in-10-medical-products-found-to-be-substandard-or-falsified-in-low-and-middle-income-countries.aspx)
- [Open drug markets – BusinessDay](https://businessday.ng/?p=1171420)
- [Open drug markets a threat – Guardian](https://guardian.ng/features/open-drug-markets-threat-to-public-health/)
- [Cosmetics and food top seizures – Guardian](https://guardian.ng/?p=2861874)
- [Counterfeit "Coglaet" toothpaste – Guardian](https://guardian.ng/features/health/nafdac-raises-alarm-over-suspected-counterfeit-toothpaste-in-kaduna/)
- [NAFDAC updates, counterfeit Cerelac – Mondaq](https://webiis10.mondaq.com/nigeria/healthcare/1787778/updates-on-the-recent-activities-and-other-developments-at-national-agency-for-food-and-drugs-administration-control-nafdac)
- [Counterfeit Herceptin – Nairametrics](https://nairametrics.com/2026/03/26/nafdac-alerts-nigerians-over-counterfeit-stomach-cancer-drug-herceptin-in-circulation/)
- [Falsified chloroquine – Nairametrics](https://nairametrics.com/?p=479031)
- [Revalidated SMA Gold – AllAfrica](https://allafrica.com/stories/202602230576.html)
- [Counterfeit Dostinex – Vanguard](https://www.vanguardngr.com/?p=2829195)
- [NAFDAC Mobile Authentication Service](https://nafdac.gov.ng/?p=2429)
- [Greenbook and traceability – AllAfrica](https://allafrica.com/stories/202511130105.html)
- [NAFDAC traceability overview](https://nafdac.gov.ng/nafdac-traceability-find-out-all-you-need-to-know-here/)
- [Traceability Regulations 2024 – GS1 Nigeria](https://gs1nigeriaweb.azurewebsites.net/?p=2397)
- [Pharmacies and patent medicine vendors – MIT Solve](https://solve.mit.edu/solutions/95136)
