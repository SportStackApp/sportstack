# Production Readiness Form and Persistence Register

Last refreshed: 31/08/2026 from current source and targeted Dev evidence.

Persistence key: **URL** survives navigation/refresh and is shareable; **Local** survives browser
restart; **Session** survives same-browser refresh/navigation; **Saved** survives after explicit
Save; **Transient** intentionally resets when the page/dialog unmounts.

## Identity, profile, games and coaching

| Route/surface | Expected persistence | Latest result |
|---|---|---|
| Login and password forms | Transient; `returnTo` stays in URL | Source checked |
| Signup cascade/application | Transient until submitted; submitted request Saved | Source checked |
| Profile personal/contact/emergency fields | Saved after explicit Save | Preferred/nickname passed 30/08 |
| Profile team number and position preferences | Saved per team | Passed 30/08 |
| Profile notification preferences | Saved | Source checked |
| Profile photo/team/statistics dialogs | Transient drafts; successful actions Saved | Source checked |
| Games view/season/month | URL | Source checked |
| Line-up team context | Session | Passed refresh 30/08 |
| Line-up roster, assignments, nickname and dragged positions | Transient until Save; then Saved | Passed save/refresh 30/08 |
| Line-up roster/player search dialogs | Transient | Passed workflow 30/08 |
| Roster search/position filter | Transient | Source checked; persistence candidate |
| Squad team selector | URL `?team=` | Passed single-team state 30/08 |
| Coaching player team context | URL | Passed 30/08 |
| Coaching season filter and dialogs | Transient | Source checked |
| Coaching ratings/notes | Saved; repeat-click can clear rating | Passed 30/08 |
| Formation Library tabs/search/filters | Transient | Gap: inconsistent with builders |
| Formation/Template Builder drafts | Local; successful Save is backend Saved | Source checked |
| Hockey Trace import/tabs | Transient | Source checked |

## Communications, committees and coordination

| Route/surface | Expected persistence | Latest result |
|---|---|---|
| Communications audience tab/message | URL | Desktop tabs passed 31/08 |
| Communications composer | Local per destination; clears after Send | Source checked; Send not exercised |
| Communication settings/published content | Saved | Source checked |
| Committee selector, work/admin area and nested tabs | URL | Desktop tabs passed 31/08 |
| Committee setup wizard | Session until complete/cancel | Source checked |
| Committee dialogs, polls, meetings and minutes | Transient draft; explicit actions Saved | Source checked; writes not exercised |
| Coordination tabs/fixture/matrix selection | Transient | Gap: resets unlike Committee |
| Coordination action dialogs | Transient draft; submitted action Saved/audited | Source checked; writes not exercised |

## Voting

| Route/surface | Expected persistence | Latest result |
|---|---|---|
| Public Umpire cascade and ballot | Currently Transient | Gap: no draft recovery |
| Signed-in Umpire ballot | Local per compatible fixture; clears after Submit | Source checked |
| Player MVP current/history tab | URL | Source checked |
| Player MVP ballot draft | Local per session; clears after Submit | Source checked |
| Player MVP tally playback frame | Local per presentation | Source checked |

## Expense Hub

| Surface | Expected persistence | Latest result |
|---|---|---|
| Expenses filters | Session, isolated per signed-in user; never URL | Local Dev fix implemented; deployed refresh/navigation retest pending |
| Reports filters | Currently Transient | Gap: does not share Expenses context |
| Expense create/edit/allocation/attachments | Transient draft; explicit Save/backend attachments Saved | Source checked |
| Statement import/reconciliation | Transient import session; committed match Saved | Source checked |
| Supplier/category/payment-method editors | Transient draft; explicit Save persists | Source checked |

## Administration

| Route/surface | Expected/current persistence | Latest result |
|---|---|---|
| Admin Quick Actions order/enabled state | Local | Passed 30/08 |
| Associations filters/paging | Transient | Gap |
| Competitions filter/paging | Transient | Gap |
| Clubs association filter | URL; paging Transient | Source checked |
| Teams cascade | URL; paging Transient | Source checked |
| Divisions filters/paging | Transient | Gap |
| Venues filter/paging | Transient | Gap |
| Users filters | URL; paging/selection Transient | Source checked |
| Add Player draft | Transient; submitted record Saved | Source checked |
| Bulk/Fixture Import working state | Transient; committed records Saved | Source checked |
| Fixtures filters/sort | Transient; active dialog identity Session | Gap: context resets behind dialog |
| RevSports Mappings tab/filter/paging | Transient | Gap |
| RevSports Entity Review tab/search/filters/page size | Session across entity tabs | Passed 30/08 |
| RevSports Entity Review sort/page | Transient | Gap |
| Requests/Error Logs/Feedback filters | Transient | Gap |
| Player Explorer state | Session per user/scope; named searches Saved/URL | Source tests passed |
| Player MVP admin filters/paging/sort | Transient; selected session URL | Gap |
| Tally admin team | URL; selection/draft Transient; publish state Saved | Source checked |
| Umpire admin filters/tab | URL; sort Transient; actions Saved | Source checked |
| Safety tabs/filters | Transient; records Saved | Gap: resets across module use |
| Analytics scope/views/log filters | URL | Passed actual roles 30/08 |
| Roles/modules/access-control drafts | Transient; explicit changes Saved | Super Admin page passed 31/08 |
| Module Preview selection | Transient | Explicit preview exemption |

## Discipline

| Surface | Expected persistence | Latest result |
|---|---|---|
| New case intake/evidence draft | Transient; submitted case Saved | Source checked; write blocked |
| Case workspace active tab | Transient, defaults to Overview | Gap: not URL-backed |
| Workspace forms/transitions | Transient drafts; explicit submits Saved | Source checked; write blocked |

## Consistency decisions

- Saved backend data must survive refresh and navigation after a successful Save.
- Unsaved modal drafts may reset unless this register says Local or Session.
- Related operational filters should use URL or Session persistence when users reasonably move
  between tabs or return after inspecting a record.
- Passwords, tokens, files and sensitive ballot values must never be persisted outside their
  explicitly designed secure draft mechanism.
- Highest-value remaining persistence gaps are Fixtures, Safety, RevSports Mappings, Expense
  Reports, Player MVP administration and organisation management filters. Expense-list session
  persistence is a local Dev fix awaiting deployed retest.
