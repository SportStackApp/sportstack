# Production Readiness Table Register

Last refreshed: 05/09/2026 from current TSX source and targeted Dev evidence.

Expected rule: operational data columns sort ascending and descending using their real type.
Action/control, fixed-rank, import-row-order, matrix and small form-like tables may be explicitly
exempt. **Text only** means arrows exist but business/date values are currently compared as text.

| Route/surface | Columns | Current sorting | Expected/result |
|---|---|---|---|
| Entity dashboard standings | #; Team; P; W; D; L; GD; Pts | None | Fixed rank exempt; Team/statistics follow-up |
| Coaching position ratings | Position; Player Pref; Your Assessment; Notes | None | Fixed form taxonomy exempt |
| Hockey Trace movement peaks | Time; Marker; Acceleration; Rotation | None | Gap: date/numeric sorting |
| Hockey Trace imported files | File; Data; Input rows; Used rows; Skipped; Status | Fixed filename order | Gap: interactive typed sorting |
| Expenses | select; Date; Supplier; Description; Invoice; Category; Total; Business; Status; Actions | All data columns use typed two-way sorting | Deployed headers/direction passed 31/08; select/Actions exempt |
| Associations | Name; Abbreviation; Website; Logo; Default Duration; Actions | All meaningful data columns use typed two-way sorting | Source and focused sorter tests passed 05/09; Logo/Actions exempt; deployed check pending |
| Competitions | Name; Association; Season; Active; Actions | All data columns use typed two-way sorting | Source and focused sorter tests passed 05/09; Actions exempt; deployed check pending |
| Clubs | Name; Association; Website; Abbreviation; Actions | All data columns use typed two-way sorting | Source and focused sorter tests passed 05/09; Actions exempt; deployed check pending |
| Divisions | Name; Competition; Association; Gender; Age Group; Match Duration; Actions | All data columns use typed two-way sorting | Source and focused sorter tests passed 05/09; Actions exempt; deployed check pending |
| Teams | Logo; Name; Club; Division; Gender; Age Group; Actions | All meaningful data columns use typed two-way sorting | Source and focused sorter tests passed 05/09; Logo/Actions exempt; deployed check pending |
| Venues | Name; Suburb; Association; Pitches; Actions | All data columns use typed two-way sorting | Source and focused sorter tests passed 05/09; Actions exempt; deployed check pending |
| Users | control; Name; Association / Club / Team; Status; Roles; Actions | None | Gap; control needs accessible label |
| Requests | Date; Type; Player; Team; Club; Membership Type; Status; Actions | Fixed newest first | Gap: interactive reversal/typed sorting |
| Fixtures | Date; Association; Division; Home Team; Away Team; Round; Venue; Status; Score; Actions | All data columns | Passed 30/08; Score semantic rule still undefined |
| Fixture Import preview | #; Date; Time; Venue; Pitch; Division; Home Team; Away Team; Status | None | Import order exempt; Status candidate |
| Bulk Import preview | #; identity/contact/scope/player fields; Status | None | Import order exempt; Status candidate |
| RevSports Entity Review, all tabs | Scraped Item; Context; SportStack Match; Status; Last Seen; Actions | All data columns | Passed 30/08 |
| RevSports Mappings, all tabs | CSV Column; Scraped Value; Maps To; Destination; Status | None | Gap: inconsistent with Entity Review |
| RevSports Unmatched | Association; Competition; Grade; Team; Club; First Seen; Actions | None | Gap except Actions |
| Error Logs | control; When; Context; Message | All data columns use typed two-way sorting | Passed 31/08; Details is a labelled keyboard-operable control |
| Feedback | When; Feedback; Status; Admin notes; control | All data columns use typed two-way sorting | Passed 31/08; status order and accessible labels verified |
| Player Explorer | Player; Identity; Teams; Games; Goals; Green; Yellow; Red | All typed columns | Source tests passed |
| Player MVP sessions | Team; Fixture; Date; Status; Completed; Actions | All data columns | Passed 30/08 |
| Player MVP ranking | Rank; Player; Points | Fixed leaderboard | Exempt |
| Player MVP ballot detail | Player; Vote; Result check; Action | None | Small detail table; explicit exemption |
| Analytics leaderboard | Rank; Player Name; Votes Received; Total Points | Fixed leaderboard | Exempt |
| Analytics vote completion | Round; Game; Voter; Team; Status; Submitted | Stable two-way sorting on every column | Deployed Round asc/desc passed 31/08 |
| Analytics individual log | Voter Name; Voted-For Player Name; Points; Round | Stable two-way sorting on every column | Deployed Points asc/desc passed 31/08 |
| Umpire submissions | Round; Division; Fixture; Submitted for/by; Source; Votes; Status; Submitted; Actions | All data columns | Source checked; shared-header inconsistency |
| Umpire leaderboard | Rank; Player; Team; 3s; 2s; 1s; Total | Fixed leaderboard | Exempt |
| Safety dashboard risks | ID; Risk; Rating; Owner; Review | Text only | Arrows passed; typed semantics gap |
| Safety work attention | Type; ID; Description; Owner; Due | Text only | Asc/desc passed 31/08; typed semantics gap |
| Safety Risk Register | ID; Risk/summary; Current/Target rating; Owner; Review; Status; control | Text only | Arrows present; semantic/accessibility gap |
| Safety Actions | ID; Action; Owner; Due; Status; control | Text only | Arrows present; semantic/accessibility gap |
| Safety QI Register | ID; Improvement; Priority; Owner; Due; Status; control | Text only | Arrows present; semantic/accessibility gap |
| Safety Bright Ideas | ID; Idea; Submitted by; Decision; Status; control | Text only | Arrows present; semantic/accessibility gap |
| Safety Audit History | Date; User; Record; Action; Field; control | Text only | Arrows present; semantic/accessibility gap |
| Safety matrices | Likelihood; consequence headings | None | Fixed lookup/editor exempt |
| Module Preview demonstration tables | Varies by preview | None | Demonstration-only exemption |

## Consistency findings

- Deployed typed interactive sorting currently exists in Fixtures, RevSports Entity Review, Player
  Explorer, Player MVP sessions, Umpire submissions, Expenses and Analytics operational tables.
- Safety uses generic displayed-text extraction; its arrows do not guarantee chronological date,
  severity or workflow ordering.
- RevSports Mappings and Unmatched visibly lag behind the newer Entity Review pattern.
- People, Requests, RevSports Mappings and Hockey Trace are the largest remaining operational
  sorting gaps. Organisation sorting is implemented in the current Dev candidate and still needs
  authenticated deployed verification.
- Blank action/control headings must receive accessible names even when they remain non-sortable.
