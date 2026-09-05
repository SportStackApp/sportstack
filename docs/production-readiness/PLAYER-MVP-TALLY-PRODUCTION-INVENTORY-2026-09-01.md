# Player MVP Vote Tally Production inventory — 1 September 2026

Status: **frozen Main candidate inventory; Production unchanged**

This appendix is the exact Git inventory used by the Player MVP Vote Tally Production-readiness
packet. It is intentionally exhaustive. The Production release must be re-frozen if any listed
reference changes.

## Frozen references

- Main: `1924404642710bf570e9bde424a09e34be181658`
- Production branch: `682b8eaba33f657a2c64dcce571a40e0b2b0ba00`
- Production is an ancestor of Main: **yes**
- Commits from Production to Main: **228**
- Changed paths: **398**
- Migration files: **111**
- Edge Function files: **12**
- GitHub workflow files: **3**

## Every commit from Production to Main

- `c990e665a76f9c3e73cbcbba73abfdbc4f167113` — 2026-07-30 — chore(notes): sync repository notes to obsidian
- `2db4e1ca1c92af8609f455972290376615ea1ebd` — 2026-07-30 — feat(umpire): add public match voting portal
- `f04521de78012f35f90b60fb313dccce4ab888ef` — 2026-07-30 — feat(umpire): show dates in round selector
- `fd6960d5405f6a1c534671236d5bb686f63219da` — 2026-07-30 — feat(umpire): simplify public player suggestions
- `a258fc4a188c70c0fee8bf84810e543200771dd9` — 2026-07-30 — feat(umpire): add account login return flow
- `baf1157ec4d577549c230427f4e29d899f2305e5` — 2026-07-30 — docs(umpire): record dev login verification
- `9371db69efdd652972264f5da337656600c04135` — 2026-07-30 — fix(umpire): return account login to public flow
- `7a8fbbf79f26d07f7f737a2dd50a565bad76c318` — 2026-07-30 — docs(umpire): record corrected account flow
- `38a2505ed49ddbbdfb0074aea65bf3757d760851` — 2026-07-30 — docs(umpire): record staging release gate
- `74e2947004070b10d7d40a81fa24fb36948080a5` — 2026-07-31 — chore(release): add guarded production workflow
- `e3966b18ebb94f5cfe28605b5b8eab21d0feabbc` — 2026-07-31 — docs(release): record guarded preflight
- `4bcb4fca2a485876cb5747eea0a43ce533b981b7` — 2026-07-31 — fix(release): isolate production migration history
- `3142cb54df37568f28fbc99a45c7d3902bfce647` — 2026-07-31 — docs(setup): record dependency readiness
- `2053824d6bca103a896c49727393cb705de1e6ea` — 2026-07-31 — fix(revsports): unify fixture mapping pipeline
- `b186efbd38b5b7e6d7f4ac5f95bd4d4548f10940` — 2026-07-31 — chore(revsports): add dev import preview switch
- `a37743a0800bffe3fb315f7090b280f760a32ef8` — 2026-07-31 — chore(revsports): add direct dev fixture import
- `3ca3b196a5f33673c051d4fccae4816d5e2db5e5` — 2026-07-31 — fix(revsports): recover shifted venue fields
- `abe63868e61eb7980208c120394f12bbf0fb2049` — 2026-08-01 — fix(revsports): enrich bye round context
- `9c15e9dc1b577f5f88787a267fcd034c4835fcb8` — 2026-08-01 — fix(revsports): keep bye context schema-safe
- `9cd5a87f888e3e8f7993e0ba357ea81c1bcd8315` — 2026-08-01 — fix(revsports): split linked pitch labels
- `5a2ae3cfe66c26d6a676b231dc5fd92c304ca3a9` — 2026-08-01 — docs(plan): lock development order
- `e1bc0a7e970c986c5a4bba28fb9dc7681c3acf46` — 2026-08-01 — feat(coaching): complete formation lineup reliability
- `3db95634a1e2466ff2475a4610b2b42fd1663b93` — 2026-08-01 — chore(domains): prepare umpire portal hostname
- `a6c10ea1d78480b2e86db4be752f279bc433b6b2` — 2026-08-01 — refactor(navigation): organise role-based menus
- `2ff78a6ec1377583ea51583a84ae3f6b6debae5d` — 2026-08-01 — fix(dashboard): improve fixture availability flow
- `e6a4c9bc2d26d298ec7392d07fabc3249835780f` — 2026-08-01 — fix(communications): confirm scoped broadcasts
- `435e946e4870f00a9ab6ecd1ab73307910d5f27d` — 2026-08-01 — fix(voting): make umpire ballots atomic
- `a04df91727af40ab9bc51b63f08f0e23fd65b091` — 2026-08-01 — fix(admin): harden core data workflows
- `4a82ab0df2ed044a528213448a3373004224b8aa` — 2026-08-01 — feat(permissions): add scoped module controls
- `55722ce465b5fee2053d137f79a9961d7948e008` — 2026-08-01 — feat(committee): add private committee setup
- `bd20bf7d425888faf41b240a028ed620c56487ba` — 2026-08-01 — feat(committee): add polls meetings and private chat
- `dfc16aecc9245d81a6dbe2bcd486bf5ac05a79a8` — 2026-08-01 — feat(safety): enable risk and quality workflows
- `4803bf033e8b8dfbc427614e9a2cfcd25ce74cdb` — 2026-08-01 — test(quality): automate dev plan checks
- `978737b563087ed1d5489eb6c45e247c057d966b` — 2026-08-01 — fix(quality): install pinned Python dependencies
- `d9d8a7a2b18640a39c4f5a879af7922637e77e00` — 2026-08-01 — docs(plan): complete reliability block
- `9352d2458f026767961412352a4687bd953799c1` — 2026-08-01 — chore(quality): use Node 24 actions
- `18aa4282d9a9aa20921e484fbb248f3bb02eeb45` — 2026-08-01 — feat(owner-test): implement remediation plan
- `dcc5709d8d208e537802ffa5ed1fe0d959417dbc` — 2026-08-01 — fix(ci): baseline owner-test focused lint
- `933155fa66daa46a40d6c5acea7e7f1385513962` — 2026-08-01 — fix(admin): repair live role enum reference
- `068d28133bd3b3b741de20cd2078491dfe41e34c` — 2026-08-02 — feat(permissions): add scoped Dev testing controls
- `1ffabbd1151ef820a8fd85f2a9af22c0d6544420` — 2026-08-02 — fix(permissions): reject stale mode responses
- `a06ae9a215c0d5aca70283f7ff4073432899d3b0` — 2026-08-02 — feat(permissions): enforce session-bound module access
- `526c0d304328503ba363232fc3d178df037073d0` — 2026-08-02 — docs(permissions): record Dev enforcement rollout
- `879d184edaa9360c5f0d83c4bb6fa0be62ddc632` — 2026-08-02 — fix(permissions): preserve deliberate admin mode
- `2a5e0d487fa6c5364570b893d34bd712dc85248a` — 2026-08-02 — docs(testing): record overnight Dev evidence
- `55149960ea88b7d1023ecb9277accc2650233ea2` — 2026-08-02 — fix(permissions): prevent cascade mode race
- `eb5ddae88a103c73a05e3760a3b8b0b562f2d554` — 2026-08-02 — docs(testing): record remaining mode reset
- `de5b5e0035a125235568397ffedf68977f44147b` — 2026-08-02 — docs(testing): confirm module-only permission controls
- `10acb9e90402b48f5b8ac429c729e085e439e886` — 2026-08-02 — docs(testing): map remaining Dev workflow causes
- `9949d2b364ef6e4ca1a39281a8ae9b79cf5d0400` — 2026-08-02 — docs(testing): correct overnight workflow evidence
- `8f0e01921de80210fa698fbefba5ca68a8dc07ff` — 2026-08-02 — docs(testing): record final overnight browser evidence
- `4390b4746908fc504e8c6af4a70cb8320381cc9a` — 2026-08-02 — docs(testing): clarify active permission preview evidence
- `b5c397fc9130f75fa2a124b45b65333a0becd56e` — 2026-08-02 — docs(testing): record continuation evidence
- `6b3fac483b23a76ddab9f827c2b3cef77fd4be5d` — 2026-08-03 — feat(auth): reset reserved dev test accounts
- `86a1d402d35b7637b09c3232c0b4ff7564d7ad12` — 2026-08-03 — fix(auth): enforce active mode route boundaries
- `845934b86b67b94a981f3435f9876799a329e35f` — 2026-08-03 — fix(auth): wait for confirmed route context
- `0d462ce8bf7f99cdf9a8f2e6311d52da277fa1e0` — 2026-08-03 — fix(admin): include role-scoped users
- `de3a2018bbc5411e231f77d88868f7a66f1fd33b` — 2026-08-03 — fix(admin): permit scoped role-only mutations
- `e67f5f09ef5297b6913da3d5b6fd494498ff4b43` — 2026-08-03 — fix(navigation): reopen selected team overview
- `33874d4a6a238c0cb92a0a81f2d689507e7ad89d` — 2026-08-03 — fix(fixtures): add calendar and clean bye cards
- `3a7fcfb33b008f010f3102e2a092f7b72b23487b` — 2026-08-03 — fix(communications): exclude broadcast author alerts
- `1be1f3c2fcbb0a40bc4f842cd33f85c15e3c550a` — 2026-08-03 — fix(umpiring): scope player suggestions to fixture
- `0f3398b7323f8f196701d1ad01595d17721a0b8a` — 2026-08-03 — fix(fixtures): deduplicate availability players
- `ae3acc6f1a19ab6abcc602545a71eac136cadc56` — 2026-08-03 — fix(coaching): exclude unavailable suggested players
- `7d17259ca0977da0e530706e673426d5d2f024b7` — 2026-08-03 — fix(notifications): alert staff to selected player changes
- `c84a5d583465f56ad2d5d3ecadeeed9669c28235` — 2026-08-03 — fix(communications): restrict removed message history
- `9e7cf1f24ed379900712a2f3f710ab51442a4a2b` — 2026-08-03 — fix(mvp): preserve ballot drafts on refresh
- `a3055220c5b1c450a5c55be9eb88f99fcc7bc2d8` — 2026-08-03 — fix(umpiring): preserve ballot entries on back
- `2498cf9f4b48f09d74722357f1ff9f24e9c69152` — 2026-08-03 — fix(umpiring): restore ballot drafts after refresh
- `63e4862275648d510a47839b1c0a1be9f1840a57` — 2026-08-03 — fix(umpiring): rebuild saved fixture context
- `c9b9b4cbcd13ec9c181104c295910aff25669127` — 2026-08-03 — fix(umpiring): allow role-scoped fixture access
- `1d4bd209a13eb11d6f314c38fb31b02adffcb1f1` — 2026-08-03 — fix(profile): preserve player number edits
- `b03938d381b4c5365375974e40b7046219e3ed70` — 2026-08-03 — fix(admin): show active mode labels
- `d2915091047673410be7c7081b95d6b3ed218194` — 2026-08-03 — fix(fixtures): present byes consistently
- `8e9945ecc6d81d8239d05209a0ba09c9b0b2dc59` — 2026-08-03 — fix(fixtures): hide bye lineup action
- `ef8406fa1d183ca0ee1323fc5c328475977140e4` — 2026-08-04 — feat(fixtures): expand calendar and match details
- `a12f2619c425e0e65a2232e4bec24263a892a52d` — 2026-08-04 — test(fixtures): update calendar presentation contract
- `5181a8caf3bed7e7c7627b7e05b68177da5b784f` — 2026-08-04 — feat(expenses): add manual Expense Hub
- `4cc7070a8b7c424255475f5a0d9510fbc95ec042` — 2026-08-04 — fix(fixtures): restrict editing and show calendar results
- `cdf1be388eb3703142716fc6c9c9389c1c9bc565` — 2026-08-04 — feat(expenses): add statement review and invoice scanning
- `701edab53cd4188f8990c5956b2b340691d0e129` — 2026-08-04 — feat(expenses): complete ai expense review
- `6246a483179f4cf98eb9778c1369e362c8d6feaf` — 2026-08-04 — fix(admin): batch broad user list requests
- `f3486b05553abc02d420724f5a3a25af7a66f12b` — 2026-08-08 — fix(auth): preserve page state on focus recheck
- `df5b0ec14251a85cd223ee32c9e0fdd22c732981` — 2026-08-08 — fix(fixtures): render scheduled availability states
- `7d7e67f1a44ac610597a1223f4847deb7a75d58c` — 2026-08-08 — fix(fixtures): improve availability controls
- `e38150d74dbc9ec1d1bfa51c4b8d773f582f40ba` — 2026-08-09 — fix(fixtures): preserve local time on admin save
- `29972db954a65bf3c5aaeed863e43adeee219fc3` — 2026-08-09 — docs(testing): record unattended dev verification
- `a77f01ae014035664a9717f97c3f7686fce54faa` — 2026-08-10 — fix(workflows): resolve unattended testing findings
- `ebc29e32d3f73f53eab6fbdd0014ecd25c957833` — 2026-08-10 — docs(handoff): record dev repair verification
- `77422f1188eade9f45f36382462dca7849a1081a` — 2026-08-10 — fix(scope): restrict club admin selector
- `e710225261d5602cd58931d565dd134b6f39c151` — 2026-08-10 — docs(handoff): record club admin scope repair
- `4e3d094fc7d1b7f7322be1369ab8c36c29d985ec` — 2026-08-10 — docs(tests): record club admin owner pass
- `aac7fac72929751e21dd58fa1c0399b6b74f57ac` — 2026-08-10 — docs(tests): record player multi-team pass
- `2ef2dc8202a49a9238f5e45ea43c5b6993de801e` — 2026-08-10 — docs(tests): record communications draft pass
- `ef600f3e5cbab157fd5d155efa50470eb75f6144` — 2026-08-10 — docs(tests): record message history pass
- `deea6c00613712950e6a204b1152ca5994f6b6c2` — 2026-08-11 — feat(committee): add guided setup workflow
- `6d4c98149a58809f7ad6395b1e0d08e22fe0eadc` — 2026-08-11 — docs(committee): record guided workflow rollout
- `b517912f6fefc1836060a4b8a6e50e7f03f06710` — 2026-08-12 — feat(discipline): add verified phase one workflow
- `21c94659d6a1966712b0ea4aa10e037b316ee34e` — 2026-08-12 — docs(discipline): record dev rollout
- `8815af72e1aa0a5009b4d24c4adaf7199057f7d7` — 2026-08-12 — docs(discipline): clarify deployment evidence
- `df4decd622311221b07287aa02a83ff49b9b77b6` — 2026-08-12 — feat(discipline): improve guided incident intake
- `d4fbbfc828c9eec7e145b856f69d6a625998b482` — 2026-08-12 — docs(discipline): record guided intake rollout
- `e6b73dfe19ce55da7512296b12f15ee1a6970fdf` — 2026-08-12 — feat(discipline): improve preliminary screening guidance
- `e00c1c533b9b50ae72ed42f941279f63a4c665e1` — 2026-08-12 — docs(discipline): record screening guidance rollout
- `e8018598a4a6d4d30cd0ff61293379005f3537df` — 2026-08-13 — feat(discipline): guide investigator setup
- `909b1316e5df7b13e4afd588ce2ed2cdc10e72de` — 2026-08-13 — docs(discipline): record investigator rollout
- `31fb7921352e837dd7c909b81413290c5288ab98` — 2026-08-13 — docs(discipline): record incident rehearsal evidence
- `8fcbdd1bbcf0bc483365138a0f7836869d5d3e29` — 2026-08-13 — docs(discipline): record Incident 007 dev case run
- `283e15074ababda4f4b6585ca4ecf85e36da8f5c` — 2026-08-13 — docs(discipline): record incident 007 findings run
- `8e5b9d194137920d30c5a7ccf18eff19221c0c8d` — 2026-08-13 — feat(discipline): add independent review panel
- `a72a9a0a7e501e83d93a1378e25fbb283b0ad5e2` — 2026-08-13 — fix(discipline): allow reports without outcome recommendation
- `7aec329e84ec56bc9f4da6d0f822292e96462968` — 2026-08-13 — fix(discipline): polish completed panel summary
- `8a60d635ad41ebb8d6f3b374b7e737ef967e9718` — 2026-08-13 — docs(discipline): record review panel deployment
- `95dd3dffb70992dd6b44d2b3f5409a6a1c8f37cc` — 2026-08-13 — feat(discipline): add tribunal preparation workflow
- `cc1149beeae7d1f6e1e61b97760a0adda2f6bb0b` — 2026-08-13 — docs(discipline): record tribunal preparation walkthrough
- `67892315c1856a13b3c8208c56acb062a3aa26d7` — 2026-08-14 — feat(discipline): complete post-referral workflow
- `25ef0333625c40ec416f31b4bed5b9f4151eb257` — 2026-08-14 — fix(discipline): show phase two validation inline
- `2f12910647db619ee16b460b69e056e27e6628fc` — 2026-08-14 — feat(discipline): harden appeals and case closure
- `15adb8d387862c97732a39457ff64719431d9d4f` — 2026-08-14 — docs(discipline): close phase two workflow pass
- `08fe4f6034595175b2372bc807c65be0a3a91f35` — 2026-08-14 — docs(coordination): define offer and roster workflows
- `a26834030324e3c14f13072827b474ffc8d9a040` — 2026-08-14 — feat(admin): add player explorer
- `26ad7813da49cf28014a05158dfabc696dd71710` — 2026-08-14 — docs(coordination): require offerer confirmation
- `0063b2bab70b04b671c490201ea163aa057f60d5` — 2026-08-14 — feat(admin): add grouped player filters
- `1a55b32a568f468dca22388d9ab93e5b44e5e05e` — 2026-08-14 — docs(admin): record player filter deployment
- `c50eb87d6a08e84d9ccfee12978dbb6a8a475de6` — 2026-08-14 — docs(coordination): make confirmation fail closed
- `353f5d4c0a2787bd98ba777e61f46ac4a602fcd5` — 2026-08-14 — docs(release): record main staging promotion
- `4ce830fbd669c09ad7ff31448bcf26c039ddb64b` — 2026-08-15 — feat(admin): save and schedule player searches
- `f94442ac0fd724a2c0bbc332eab85a90216b4457` — 2026-08-15 — feat(discipline): redesign incident workflow
- `ec36dbb74bac19072b7b9c73a8b27c9174eccc0e` — 2026-08-15 — docs(discipline): record Dev verification
- `008dbbdd88b3b327aab5fff4f715bfecdfdee791` — 2026-08-15 — fix(scrapers): repair backups and mapping checks
- `c1400f99588f5534bfdae4a99f43bfa4be55b089` — 2026-08-15 — fix(scrapers): repair backups and mapping checks
- `d54fe7c117db8b522febe48775bbbc7b2d82c091` — 2026-08-15 — docs(scrapers): record production recovery
- `e6bbdc8b5f22dc4773b3360526263ff9e8d8674b` — 2026-08-15 — docs(scrapers): record production recovery
- `14e90919523a00c262f2c2e2e7e841735e6bd4d8` — 2026-08-16 — feat(admin): export and sort player results
- `d4226f80d1d148d957b0db6c9ed04d96e23f109a` — 2026-08-16 — feat(discipline): preserve drafts and audit withdrawals
- `02b3756b664e7600129b7479ea64e498035e2278` — 2026-08-16 — feat(admin): scope player explorer access
- `7cd41f4b7447ce9dcb606d2341192eb2bc271d26` — 2026-08-16 — docs(coordination): confirm design and implementation plan
- `f97271f7dfcd13b3a42df55fad20269e064a0c69` — 2026-08-17 — feat(coordination): implement coordination module
- `453552d2d9fbf56389d730b8d0c20d05f635bef8` — 2026-08-17 — fix(coordination): enable module access
- `0e08ffe606de1f26e7d80f22b02a6522890ccf7b` — 2026-08-17 — fix(coordination): prevent offer policy recursion
- `97e0668888e97e1c6c02e883035f673914605823` — 2026-08-19 — feat(coordination): scope umpires and coordinators
- `01380dc4cfec5fe65cb566351c8c653bea806376` — 2026-08-19 — fix(coordination): type umpire scope state
- `60f65dddfbb48efe1df7c7a5e1ed7c3eeb8fb1cc` — 2026-08-19 — test(coordination): align access regressions
- `46750b618fe505d5f55eddcaee42f2ddf4647120` — 2026-08-19 — fix(admin): restore player explorer permissions
- `12d9ffc162ddb8651c76df6cb3e2a750fa1b8a43` — 2026-08-19 — fix(admin): avoid player explorer timeout
- `e52efeb8d3b2c13b56b668b54124ea53e68baf58` — 2026-08-19 — merge(main): align scraper recovery history
- `d79067b1137e8fb459d77af2cacc9470ab5c1c1e` — 2026-08-19 — docs(release): record main staging promotion
- `a6a78fca5b56452d66e0be813f75e1248154c822` — 2026-08-20 — docs(plan): consolidate open project work
- `1c3dd43c824fbc6c88b06cc4f7eff4c08734addd` — 2026-08-20 — docs(plan): clarify audit baseline
- `e75c8cf66c91ef74a721922b1da3a6280b99681e` — 2026-08-20 — docs(plan): record Player Explorer owner feedback
- `9000ab06c38e7a27b0b5578d4f8bbe1833196652` — 2026-08-20 — docs(plan): require Player Explorer state persistence
- `5e238f6b205dfa3ec93f6add84502b9f238ccf78` — 2026-08-20 — docs(plan): record Player Explorer sorting pass
- `171f4c9a7197fab746e678da26fedd03f9ef51aa` — 2026-08-20 — docs(plan): record Player Explorer export pass
- `117f1c3f04deb1c9c742fe5608e2c5dd73c5d599` — 2026-08-20 — docs(plan): record saved-filter test feedback
- `0880ad3ecb835d359d4b195953cff9f423f8b06e` — 2026-08-20 — docs(plan): record saved-filter loading pass
- `19a61ea54ca3ddeeaec1383b697273f69e854758` — 2026-08-20 — docs(plan): record recurring-search schedule pass
- `9b8782876156c64335ca87ddf43b1f2054007f64` — 2026-08-20 — docs(plan): record Association Admin explorer pass
- `c2b3a7e69aa165a24009535d0ad78d472022be9e` — 2026-08-20 — docs(plan): record Club Admin explorer pass
- `6ab6f8f046665da4f5084c62bfca2aba7f97068a` — 2026-08-20 — docs(plan): record Team Manager explorer pass
- `3c195e6fadec863725c5a39dc202e9ae89db0245` — 2026-08-20 — docs(plan): record Coach explorer pass
- `afc3a09b3c167c70844e22d63e11e9aa45d32834` — 2026-08-20 — docs(plan): park multi-club manager retest
- `7fa3835cce4787ac011560006e5ee1378a06e068` — 2026-08-20 — docs(plan): record scope transition issue
- `7abd0cc1a911dc7ec66d5d49c0208f93d367a9c0` — 2026-08-20 — docs(plan): record fixture owner feedback
- `27857ce231e230de38533ffaf15ce1e3a31a7b29` — 2026-08-20 — docs(plan): record permission regression evidence
- `fbc357c1c3e74403db1850c53120bf2cee47ab62` — 2026-08-20 — fix(db): restore private helper permissions
- `1626dbf67bd6daca85139c400597936cfb86cd6b` — 2026-08-20 — docs(plan): record Player MVP permission pass
- `176feff3309540291e79e4f04f5f7726950720a4` — 2026-08-20 — fix(player-mvp): default email notifications off
- `4b73662c05e04b982ffefcbaa8b392a1ba5e6ac7` — 2026-08-20 — docs(player-mvp): record email default owner pass
- `90ec6d917cc59e54bda666fe0711c13b86f1b1d0` — 2026-08-20 — docs(player-mvp): record round owner acceptance
- `2e1f76b62e7f72a45b5fe3bdf6f582ccdcb7a23a` — 2026-08-20 — docs(umpire-voting): add owner refinements
- `619259544144781e83d581f5bd3ea479c23897b2` — 2026-08-20 — docs(umpire-voting): refine player search scope
- `3abec5a6062cf16754ab88ceadbe1ca59a1e2481` — 2026-08-20 — fix(admin): repair Dev Umpire account reset
- `a6f235405b8e13d767ee24dd4d9e8999cdf4dbd6` — 2026-08-20 — fix(deps): resolve nanoid security advisory
- `7cbf2c192248a2f94c7931a842c79c6af505140b` — 2026-08-20 — fix(player-explorer): complete owner feedback package
- `ba76f5cc19d8a109dc7bc09f3eb7e1156e91f4da` — 2026-08-20 — fix(fixtures): preserve dialogs and label byes
- `7068c9460235f8055963f29ddda0224120a2392c` — 2026-08-20 — feat(umpire-voting): refine exports results and review
- `cd9da2f5b38e0f7b3596b143d18a93f34fb983ee` — 2026-08-21 — fix(admin): stabilise scoped workflows
- `3c1c203b2c0fa2f02a09677d2f9993f4e1ba1540` — 2026-08-21 — fix(fixtures): retain dialogs across focus loss
- `54b3ea909a4600f33d842510b455c6348f503c97` — 2026-08-21 — fix(fixtures): require explicit dialog close
- `bd04a9ca16c18e7fef230d4891cbeb9d760e5cb7` — 2026-08-21 — fix(fixtures): restore dialogs after window focus
- `08b30f9d1aa0fbbf41dd12873fd9bf5a92a611b1` — 2026-08-21 — fix(dashboards): use live communication channel scope
- `132bec07ed487cbc6b59d79b5efb6c2c19e78141` — 2026-08-21 — docs(plan): record Dev catch-up audit
- `fc848951662fe80a69e5113a20720f0f09af6bb6` — 2026-08-21 — chore(feedback): reconcile dev register plan
- `578dc1c6facf036793e7bc1410058bf5bd066c4f` — 2026-08-23 — docs(obsidian): use Big Brain vault
- `6d73ca735aabe21181d13b09dada4f3b8ecc54c4` — 2026-08-26 — docs(umpire-voting): record historical Dev import
- `646dd67c34d028afb75cecbe57498fdab6fb765d` — 2026-08-28 — docs(access): document approved target model
- `72a3504a643ad9cd7c2d22e478a1c62f457f6e0f` — 2026-08-29 — fix(ui): label icon controls and selectors
- `f5d3066341ceaa59f0d336792416356c03ee6e81` — 2026-08-29 — fix(umpire-voting): label public ballot selectors
- `f32156b4e2dffedc7210a7af804c29c22b3cceed` — 2026-08-29 — docs(ui): record walk-away review findings
- `882c30c27ed516be27bd43e3aa20b353d1d93473` — 2026-08-29 — feat(player-mvp): add published tally presentations
- `1faf79f921fe3363f9fc4089eab59a0a5eca88c1` — 2026-08-29 — feat(player-mvp): refine tally presentations
- `2d71336a7626989d79cd8f4942fe7cdfbdad1c5f` — 2026-08-29 — docs(player-mvp): record tally refinement rollout
- `8f15e22dfd838fa4d209512c2c68987f080f352d` — 2026-08-29 — fix(player-mvp): remove remaining expired copy
- `71af0476f87225e24766ae0a5cca75b32c408830` — 2026-08-29 — fix(player-mvp): dedupe audience and refine podium
- `d48239d809e775dce6947a27c4058a1137b37522` — 2026-08-29 — docs(player-mvp): record audience and podium fix
- `16839febda056b0a5a38fd1ef1fe55b8ad43efda` — 2026-08-29 — feat(admin): improve lineups coaching and review tools
- `74f6d93ca275cb644c3f9605fe2909c5d0051a70` — 2026-08-29 — docs(handoff): record improvement batch gates
- `dbe788c196aa13f02d539fd0ae99c9e9eb6f4500` — 2026-08-29 — docs(readiness): add production readiness programme
- `dc77c0e640b010a093f2308a1af97bb33e5b8efd` — 2026-08-30 — fix(lineup): preserve selected placeholder players
- `a08fad190364b1d9f173c166abcbc5f48f7ac1c5` — 2026-08-30 — fix(lineup): improve pitch player interaction
- `73fd362ba32ba3e0e72df9424ba63269decfc6b8` — 2026-08-30 — docs(readiness): record pitch repair rollout
- `7b955e36b82ce6a3ff595196d037c5547a4f4885` — 2026-08-30 — fix(coaching): clear ratings and show card details
- `ca71a8c96cf2111ff93e68766256d4045d20e8e6` — 2026-08-30 — docs(readiness): record coaching repair rollout
- `6c3d87c294b992a1316ea11ee753d5c7c89daef6` — 2026-08-30 — fix(coaching): combine playing position choices
- `d281eff4eff83b6eaf2506b3b1372b1d9d8da52f` — 2026-08-30 — docs(readiness): record position repair rollout
- `961ce83cc6434cc56718f394bbc0b7fac1ccf98c` — 2026-08-30 — docs(readiness): close roster selection finding
- `5de25e54bbe6a0e751f0ca0604d99ad83cdd57a6` — 2026-08-30 — docs(testing): harden walk-away preflight
- `99dff2cd839a208eed6444aaea0d237a32f1db83` — 2026-08-30 — fix(readiness): repair walk-away UI findings
- `b980446b4aa299d913b67efee0677e28cad6214b` — 2026-08-30 — docs(readiness): record deployed walk-away repair
- `09efcb18f4f1d4b6bf68c3d985854544a83d635a` — 2026-08-30 — docs(readiness): close verified gate ledger
- `5a3cfd33960192e405341a6d02841176c7a1172d` — 2026-08-30 — docs(readiness): correct gate output oracles
- `1bf5c2055907a76b7d867790e17b0b3ca91e9c46` — 2026-08-30 — docs(readiness): record gate revalidation
- `bdc88678d4dcd698da03c4c79c7381a48bfe54e1` — 2026-08-30 — fix(lineup): prevent mobile marker label overlap
- `3a4ffd4fd25d352ef89011db1e22bd32ea127050` — 2026-08-30 — fix(accessibility): label icon-only controls
- `0ac115dc1c7156a3ead7372ddfb118ac0fe79811` — 2026-08-30 — docs(readiness): close authenticated Dev retest
- `87ede592338b74228876b56acea4de439bf94292` — 2026-08-30 — docs(readiness): record final sync evidence
- `ec02531975371a1920283bb2e0cf53284ba3891b` — 2026-08-30 — docs(security): record disposable credential cleanup
- `affa751d07136139c38f527800cff3c5a849a3be` — 2026-08-31 — docs(automation): allow bounded overnight fix batches
- `db1717b414a558d6bdeada9e5eb890d251ac3d8f` — 2026-08-31 — fix(readiness): improve sorting persistence and accessibility
- `8b6ad738681b4000ad457d87381e3a0d4aba2565` — 2026-08-31 — fix(safety): close deployed accessibility findings
- `192c91c6018cd6e31bbe713a103a27c373473c9f` — 2026-08-31 — docs(readiness): record deployed walk-away evidence
- `6368058ba77ed07b2c735de446480ff1b2469c11` — 2026-08-31 — fix(admin): standardise support table sorting
- `c413edc8c046f2ec261ceebfacfb72bb98fe9048` — 2026-08-31 — fix(admin): improve support action contrast
- `cfe794b8d982fbdf8947d33d43e5b7ccd4e50a40` — 2026-08-31 — fix(feedback): name controls and improve status contrast
- `ae39443df8c499fcbc08ca9b7d1bcb17734dc00b` — 2026-08-31 — fix(layout): improve scope cascade accessibility
- `68192c413f97fdc3dc984aa070c1cd5a52df03d1` — 2026-08-31 — fix(admin): correct support heading hierarchy
- `cd61b9fb7f1cbff3346a7df433d8d1ad2d45347c` — 2026-08-31 — docs(readiness): close support table consistency batch
- `1924404642710bf570e9bde424a09e34be181658` — 2026-08-31 — fix(player-mvp): harden tally playback accessibility

## Every changed path from Production to Main

Legend: `A` added, `M` modified, `D` deleted, `R` renamed.

```text
M	.env.example
M	.github/workflows/dev-scrapers.yml
M	.github/workflows/production-scrapers.yml
A	.github/workflows/quality-dev.yml
M	AGENTS.md
M	CODEX_HANDOFF.md
A	GATES.md
M	README.md
A	config/obsidian-note-sync.json
A	docs/access-control-model.md
A	docs/consolidated-open-items-plan.md
A	docs/coordination-module-discovery.md
A	docs/coordination-module-implementation-plan.md
M	docs/current-state.md
A	docs/development-plan.md
A	docs/domain-migration-plan.md
A	docs/feedback-register-reconciliation-2026-08-21.md
A	docs/incident-discipline-phase1.md
A	docs/navigation-audit.md
M	docs/overnight-agent-plan.md
A	docs/owner-test-matrix.md
A	docs/production-readiness/FORM-REGISTER.md
A	docs/production-readiness/GATES.md
A	docs/production-readiness/PLAN-GATES.md
A	docs/production-readiness/PLAN.md
A	docs/production-readiness/PRODUCTION-SCRAPER-FAILURE-2026-08-31.md
A	docs/production-readiness/ROUTE-REGISTER.md
A	docs/production-readiness/TABLE-REGISTER.md
A	docs/production-readiness/WALK-AWAY-CHARTER.md
A	docs/production-release-process.md
M	docs/project-brief.md
M	docs/scraper-operations.md
A	docs/umpire-scope-backfill-2026-08-19.md
M	index.html
M	notes/README.md
M	notes/known-issues.md
M	notes/project-consolidation-notes.md
M	package-lock.json
M	package.json
M	scraper/scraper.py
M	scripts/import_revsports_fixtures_v2.py
A	scripts/lint-dev-plan.mjs
A	scripts/register-obsidian-note-sync-task.ps1
A	scripts/release-production.ps1
A	scripts/sync-sportstack-notes-to-obsidian.ps1
M	scripts/upload_scrape_backups_to_storage.py
A	scripts/verify-lint-baseline.mjs
A	scripts/verify-mvp-tally-feature.mjs
A	scripts/verify-production-readiness-plan.mjs
M	src/App.tsx
A	src/components/RouteErrorBoundary.tsx
A	src/components/ThemeAccountSync.tsx
M	src/components/ThemeToggle.tsx
A	src/components/admin/AdvancedPermissionControls.tsx
A	src/components/admin/DevTestAccountProvisioner.tsx
M	src/components/admin/EditUserDetailsDialog.tsx
A	src/components/admin/ModuleControlsCard.tsx
A	src/components/admin/PlayerExplorerFilterBuilder.tsx
A	src/components/admin/PlayerExplorerSavedSearches.tsx
A	src/components/admin/SortableTableHead.tsx
A	src/components/auth/ModeRouteGate.tsx
A	src/components/auth/ModuleGate.tsx
M	src/components/auth/ProtectedRoute.tsx
A	src/components/committee/CommitteeActivity.tsx
A	src/components/committee/CommitteeChat.tsx
A	src/components/committee/CommitteeMeetings.tsx
A	src/components/committee/CommitteePolls.tsx
A	src/components/committee/CommitteeSetupWizard.tsx
M	src/components/communications/CommunicationSettingsDialog.tsx
M	src/components/entity/EntityDashboard.tsx
M	src/components/layout/AppLayout.tsx
M	src/components/lineup/FillInFinderDialog.tsx
M	src/components/lineup/HockeyPitch.tsx
M	src/components/lineup/LineupView.tsx
M	src/components/profile/NotificationPreferencesSection.tsx
M	src/components/profile/PersonalDetailsSection.tsx
M	src/components/profile/PlayerPositionPreferences.tsx
A	src/components/umpire/TurnstileWidget.tsx
M	src/components/umpire/UmpireLinkedPlayerPicker.tsx
A	src/components/workflows/GuidedWorkflowDialog.tsx
M	src/contexts/AppModeContext.tsx
M	src/contexts/AuthContext.tsx
M	src/contexts/TeamContext.tsx
M	src/contexts/TestRoleContext.tsx
A	src/features/coordination/coordination.test.ts
A	src/features/coordination/coordination.ts
A	src/features/discipline/DisciplineAccessGate.tsx
A	src/features/discipline/DisciplineCommitteeDecision.tsx
A	src/features/discipline/DisciplineEvidenceHandlingDialog.tsx
A	src/features/discipline/DisciplineIntakeGuidance.tsx
A	src/features/discipline/DisciplineInvestigatorSetup.tsx
A	src/features/discipline/DisciplinePhase2Workflow.tsx
A	src/features/discipline/DisciplinePortalLayout.tsx
A	src/features/discipline/DisciplineReviewPanel.tsx
A	src/features/discipline/DisciplineScreeningGuidance.tsx
A	src/features/discipline/DisciplineTagPicker.tsx
A	src/features/discipline/DisciplineTribunalPreparation.tsx
A	src/features/discipline/DisciplineUi.tsx
A	src/features/discipline/PredictiveTextInput.tsx
A	src/features/discipline/api.ts
A	src/features/discipline/disciplineIntakeContent.ts
A	src/features/discipline/disciplineIntakeDraft.test.ts
A	src/features/discipline/disciplineIntakeDraft.ts
A	src/features/discipline/disciplineInvestigatorSetup.test.ts
A	src/features/discipline/disciplinePhase2.test.ts
A	src/features/discipline/disciplineReviewPanel.test.ts
A	src/features/discipline/disciplineTribunalPreparation.test.ts
A	src/features/discipline/evidenceStatus.test.ts
A	src/features/discipline/evidenceStatus.ts
A	src/features/discipline/format.ts
A	src/features/discipline/investigatorSetupLogic.ts
A	src/features/discipline/phase2Logic.ts
A	src/features/discipline/reviewPanelLogic.ts
A	src/features/discipline/tribunalPreparationLogic.ts
A	src/features/discipline/types.ts
A	src/features/discipline/useDisciplineAccess.ts
A	src/features/discipline/workflowLogic.test.ts
A	src/features/discipline/workflowLogic.ts
A	src/features/expense-hub/ExpenseFiltersPanel.tsx
A	src/features/expense-hub/ExpenseHubContext.tsx
A	src/features/expense-hub/ExpenseHubGate.tsx
A	src/features/expense-hub/ExpenseHubLayout.tsx
A	src/features/expense-hub/ExpenseStatusBadge.tsx
A	src/features/expense-hub/ExpenseSummaryCards.tsx
A	src/features/expense-hub/api.ts
A	src/features/expense-hub/exports.ts
A	src/features/expense-hub/statementParser.test.ts
A	src/features/expense-hub/statementParser.ts
A	src/features/expense-hub/types.ts
A	src/features/expense-hub/useExpenseHubAccess.ts
A	src/features/expense-hub/utils.test.ts
A	src/features/expense-hub/utils.ts
A	src/features/player-mvp-tally/MvpTallyPresentation.tsx
A	src/features/player-mvp-tally/PublishedMvpTallies.tsx
A	src/features/player-mvp-tally/api.ts
A	src/features/player-mvp-tally/logic.test.ts
A	src/features/player-mvp-tally/logic.ts
A	src/features/player-mvp-tally/types.ts
M	src/hooks/useAdminScope.ts
A	src/hooks/useCoordinationAccess.ts
A	src/hooks/useModuleAvailability.ts
M	src/hooks/useUserRole.ts
M	src/index.css
M	src/integrations/supabase/types.ts
A	src/lib/activeScopeOptions.test.ts
A	src/lib/activeScopeOptions.ts
A	src/lib/adminAnalyticsAccess.test.ts
A	src/lib/adminAnalyticsAccess.ts
M	src/lib/adminCascade.ts
A	src/lib/adminSorting.test.ts
A	src/lib/adminSorting.ts
M	src/lib/appVersion.ts
A	src/lib/authRedirect.ts
A	src/lib/coachingProfile.test.ts
A	src/lib/coachingProfile.ts
A	src/lib/committeeWorkflow.test.ts
A	src/lib/committeeWorkflow.ts
A	src/lib/communicationMessages.test.ts
A	src/lib/communicationMessages.ts
A	src/lib/competitionOrder.ts
A	src/lib/domainConfig.ts
M	src/lib/entityDashboard.ts
A	src/lib/fixtureDisplay.ts
M	src/lib/formationPlanner.ts
A	src/lib/hockeyPositions.test.ts
A	src/lib/hockeyPositions.ts
A	src/lib/lineupPlanner.test.ts
A	src/lib/lineupPlanner.ts
A	src/lib/lineupTeamSelection.test.ts
A	src/lib/lineupTeamSelection.ts
M	src/lib/mvpVoting.ts
A	src/lib/playerExplorer.test.ts
A	src/lib/playerExplorer.ts
A	src/lib/playerExplorerResults.test.ts
A	src/lib/playerExplorerResults.ts
A	src/lib/playerExplorerScope.test.ts
A	src/lib/playerExplorerScope.ts
A	src/lib/playerExplorerSession.test.ts
A	src/lib/playerExplorerSession.ts
A	src/lib/playerHistory.test.ts
M	src/lib/playerHistory.ts
A	src/lib/playerHistoryFilters.ts
A	src/lib/playerPositions.ts
A	src/lib/profileNames.test.ts
A	src/lib/profileNames.ts
A	src/lib/profileRoles.test.ts
A	src/lib/profileRoles.ts
A	src/lib/publicUmpirePortal.ts
M	src/lib/rolePermissions.ts
M	src/lib/teamPositions.ts
A	src/lib/timezoneDateTime.test.ts
A	src/lib/timezoneDateTime.ts
M	src/lib/umpireLinkedPlayers.ts
A	src/lib/umpireVotingExport.test.ts
A	src/lib/umpireVotingExport.ts
M	src/pages/Chat.tsx
A	src/pages/CommitteeManagement.tsx
A	src/pages/CoordinationModule.tsx
M	src/pages/Dashboard.tsx
M	src/pages/GameDetail.tsx
M	src/pages/Games.tsx
M	src/pages/Lineup.tsx
M	src/pages/Login.tsx
A	src/pages/MvpTallyPresentationPage.tsx
M	src/pages/MvpVoteCast.tsx
M	src/pages/MvpVotes.tsx
M	src/pages/Profile.tsx
M	src/pages/ResetPassword.tsx
M	src/pages/Roster.tsx
M	src/pages/Signup.tsx
M	src/pages/admin/AdminDashboard.tsx
M	src/pages/admin/Analytics.tsx
M	src/pages/admin/ClubsManagement.tsx
M	src/pages/admin/DivisionsManagement.tsx
M	src/pages/admin/ErrorLogs.tsx
M	src/pages/admin/FeedbackResponses.tsx
M	src/pages/admin/FixtureImport.tsx
M	src/pages/admin/FixturesManagement.tsx
A	src/pages/admin/MvpTallyAdmin.tsx
M	src/pages/admin/MvpVotingAdmin.tsx
A	src/pages/admin/PlayerExplorer.tsx
M	src/pages/admin/Requests.tsx
M	src/pages/admin/RevSportsEntityReview.tsx
M	src/pages/admin/RevSportsMappings.tsx
M	src/pages/admin/RevSportsUnmatched.tsx
M	src/pages/admin/RolesPermissions.tsx
M	src/pages/admin/SafetyRiskModule.tsx
M	src/pages/admin/TeamsManagement.tsx
M	src/pages/admin/UmpireVotingModule.tsx
M	src/pages/admin/UsersManagement.tsx
M	src/pages/admin/VenuesManagement.tsx
M	src/pages/coaching/CoachingPlayerProfile.tsx
M	src/pages/coaching/CoachingSquad.tsx
M	src/pages/coaching/FormationBuilder.tsx
M	src/pages/coaching/FormationLibrary.tsx
A	src/pages/discipline/DisciplineCaseList.tsx
A	src/pages/discipline/DisciplineCaseWorkspace.tsx
A	src/pages/discipline/NewDisciplineCase.tsx
A	src/pages/expense-hub/ExpenseAiActivityPage.tsx
A	src/pages/expense-hub/ExpenseDashboard.tsx
A	src/pages/expense-hub/ExpenseEditorPage.tsx
A	src/pages/expense-hub/ExpenseReportsPage.tsx
A	src/pages/expense-hub/ExpensesPage.tsx
A	src/pages/expense-hub/StatementImportsPage.tsx
A	src/pages/expense-hub/SuppliersPage.tsx
A	src/pages/umpire/PublicUmpireVote.tsx
A	src/pages/umpire/UmpirePortalLanding.tsx
M	src/pages/umpire/UmpireVoteSubmit.tsx
M	supabase/config.toml
A	supabase/functions/_shared/expense-ai-provider.ts
A	supabase/functions/_shared/playerExplorer.ts
A	supabase/functions/_shared/playerExplorerScheduled.ts
A	supabase/functions/coordination-invite/index.ts
A	supabase/functions/expense-document-extract/index.ts
A	supabase/functions/expense-statement-extract/index.ts
A	supabase/functions/mvp-tally-commentary/index.ts
M	supabase/functions/mvp-voting-email-reminders/index.ts
A	supabase/functions/provision-dev-test-account/index.ts
A	supabase/functions/public-umpire-match-voting/index.ts
M	supabase/functions/send-profile-access-link/index.ts
M	supabase/functions/sportstack-notification-dispatch/index.ts
A	supabase/migrations/20260730114925_public_umpire_portal.sql
A	supabase/migrations/20260730124436_restore_default_voter_role.sql
A	supabase/migrations/20260731132457_add_stable_revsports_competition_external_ids.sql
A	supabase/migrations/20260801013000_harden_field_template_grants.sql
A	supabase/migrations/20260801030000_atomic_umpire_match_vote_submit.sql
A	supabase/migrations/20260801040000_atomic_membership_request_approval.sql
A	supabase/migrations/20260801041000_safe_venue_delete.sql
A	supabase/migrations/20260801050000_scoped_module_controls.sql
A	supabase/migrations/20260801060000_committee_setup.sql
A	supabase/migrations/20260801070000_committee_operations.sql
A	supabase/migrations/20260801071000_committee_operations_hardening.sql
A	supabase/migrations/20260801072000_committee_operations_indexes.sql
A	supabase/migrations/20260801080000_safety_hub_write_workflows.sql
A	supabase/migrations/20260801081000_safety_hub_linked_scope_fix.sql
A	supabase/migrations/20260801082000_committee_safety_links.sql
A	supabase/migrations/20260801083000_scoped_administration_integrity.sql
A	supabase/migrations/20260801084000_administration_scope_reads_and_snapshot.sql
A	supabase/migrations/20260801085000_super_admin_viewing_scope.sql
A	supabase/migrations/20260801090000_communication_message_revisions.sql
A	supabase/migrations/20260801091000_division_umpire_vote_scheme.sql
A	supabase/migrations/20260801092000_shared_sport_position_catalogue.sql
A	supabase/migrations/20260801093000_safety_risk_configuration_workflow.sql
A	supabase/migrations/20260801094000_committee_work_and_storage.sql
A	supabase/migrations/20260801095000_restrict_administration_rpc_execution.sql
A	supabase/migrations/20260801131220_fix_admin_role_enum_reference.sql
A	supabase/migrations/20260802100000_advanced_permission_management.sql
A	supabase/migrations/20260802101000_harden_permission_subject_hierarchy.sql
A	supabase/migrations/20260802102000_harden_is_super_admin_search_path.sql
A	supabase/migrations/20260802103000_harden_permission_function_execution.sql
A	supabase/migrations/20260802104000_validate_admin_role_scopes.sql
A	supabase/migrations/20260802105000_transactional_dev_account_and_role_guards.sql
A	supabase/migrations/20260802106000_mode_aware_permission_management.sql
A	supabase/migrations/20260802107000_mode_aware_permission_listing.sql
A	supabase/migrations/20260802108000_harden_permission_group_assignments.sql
A	supabase/migrations/20260802109000_authorise_dev_test_provisioning_session.sql
A	supabase/migrations/20260802110000_mode_aware_runtime_permissions.sql
A	supabase/migrations/20260802111000_scope_role_mutations_and_preserve_membership_player.sql
A	supabase/migrations/20260802112000_enforce_permission_set_scope_containment.sql
A	supabase/migrations/20260802113000_session_bound_permission_mode.sql
A	supabase/migrations/20260802113500_session_bound_permission_context.sql
A	supabase/migrations/20260802114000_enforce_committee_safety_module_access.sql
A	supabase/migrations/20260802115000_enforce_voting_module_access.sql
A	supabase/migrations/20260802231405_reserved_dev_test_account_lookup.sql
A	supabase/migrations/20260803090000_scope_reserved_umpire_voter_accounts.sql
A	supabase/migrations/20260803100000_include_role_scoped_admin_users.sql
A	supabase/migrations/20260803101000_include_role_scoped_admin_mutations.sql
A	supabase/migrations/20260803102000_exclude_broadcast_author_notifications.sql
A	supabase/migrations/20260803103000_notify_selected_player_availability_changes.sql
A	supabase/migrations/20260803104000_allow_umpire_role_fixture_scope.sql
A	supabase/migrations/20260804071327_expense_hub_stage_one.sql
A	supabase/migrations/20260804073000_harden_expense_hub_access_and_indexes.sql
A	supabase/migrations/20260804074800_allow_expense_finance_admin_edits.sql
A	supabase/migrations/20260804080500_allow_expense_finance_admin_aliases.sql
A	supabase/migrations/20260804084438_restrict_fixture_management_to_association_admins.sql
A	supabase/migrations/20260804181000_expense_hub_stage_two_foundation.sql
A	supabase/migrations/20260804183000_harden_expense_stage_two_ownership.sql
A	supabase/migrations/20260804190000_complete_expense_hub_stage_two.sql
A	supabase/migrations/20260804190500_limit_expense_statement_scans.sql
A	supabase/migrations/20260810090000_harden_functions_and_rls_performance.sql
A	supabase/migrations/20260811090305_guided_committee_workflow.sql
A	supabase/migrations/20260811091322_fix_guided_committee_creation_returning.sql
A	supabase/migrations/20260812110000_incident_discipline_foundation.sql
A	supabase/migrations/20260812111000_incident_discipline_workflows.sql
A	supabase/migrations/20260812112000_incident_discipline_seed_2026.sql
A	supabase/migrations/20260812113000_incident_discipline_indexes.sql
A	supabase/migrations/20260812114000_incident_discipline_portal_context.sql
A	supabase/migrations/20260812115000_incident_discipline_atomic_intake.sql
A	supabase/migrations/20260812116000_incident_discipline_report_hash.sql
A	supabase/migrations/20260812162815_improve_discipline_intake_guidance.sql
A	supabase/migrations/20260812164333_index_discipline_intake_links.sql
A	supabase/migrations/20260812235915_improve_discipline_investigator_setup.sql
A	supabase/migrations/20260813224228_discipline_review_panel_workflow.sql
A	supabase/migrations/20260813225158_discipline_review_vote_privacy.sql
A	supabase/migrations/20260813225641_index_discipline_review_panel_foreign_keys.sql
A	supabase/migrations/20260813230835_allow_no_investigator_outcome_recommendation.sql
A	supabase/migrations/20260813235900_discipline_tribunal_preparation.sql
A	supabase/migrations/20260814000500_harden_discipline_tribunal_preparation.sql
A	supabase/migrations/20260814010000_discipline_phase2_completion_workflow.sql
A	supabase/migrations/20260814012000_harden_discipline_phase2_appeal_and_closure.sql
A	supabase/migrations/20260815090000_incident_discipline_workflow_redesign.sql
A	supabase/migrations/20260815093000_enforce_discipline_stage_responsibilities.sql
A	supabase/migrations/20260815094500_lock_legacy_discipline_review_panels.sql
A	supabase/migrations/20260815103000_player_explorer_saved_and_scheduled_searches.sql
A	supabase/migrations/20260816204954_discipline_evidence_withdrawal_workflow.sql
A	supabase/migrations/20260816205950_fix_discipline_pending_evidence_guard.sql
A	supabase/migrations/20260816210103_order_discipline_evidence_status_events.sql
A	supabase/migrations/20260816213409_scope_player_explorer_access.sql
A	supabase/migrations/20260817100124_add_coordination_availability_states.sql
A	supabase/migrations/20260817100200_create_coordination_module.sql
A	supabase/migrations/20260817100300_integrate_coordination_notifications.sql
A	supabase/migrations/20260817100400_add_coordination_application_operations.sql
A	supabase/migrations/20260817100500_harden_coordination_transitions.sql
A	supabase/migrations/20260817100600_add_coordination_review_queues.sql
A	supabase/migrations/20260817100700_fix_replacement_assignment_link_order.sql
A	supabase/migrations/20260817100800_add_coordination_foreign_key_indexes.sql
A	supabase/migrations/20260817100900_authorise_coordination_account_invites.sql
A	supabase/migrations/20260817101000_protect_confirmed_coordination_availability.sql
A	supabase/migrations/20260817101100_allow_coordination_module_access.sql
A	supabase/migrations/20260817101200_fix_coordination_offer_rls_recursion.sql
A	supabase/migrations/20260819071731_scoped_umpire_and_coordinator_access.sql
A	supabase/migrations/20260819193617_restore_player_explorer_function_permissions.sql
A	supabase/migrations/20260820182455_restore_private_helper_permissions.sql
A	supabase/migrations/20260820203326_default_player_mvp_notifications_off.sql
A	supabase/migrations/20260820213845_fix_dev_umpire_account_scope.sql
A	supabase/migrations/20260829074811_admin_lineup_coaching_improvements.sql
A	supabase/migrations/20260829124215_published_player_mvp_tally_presentations.sql
A	supabase/migrations/20260829130253_index_player_mvp_tally_foreign_keys.sql
A	supabase/migrations/20260829131126_harden_player_mvp_tally_audience.sql
A	supabase/migrations/20260829150000_refine_player_mvp_tally_presentations.sql
A	supabase/migrations/20260829170000_dedupe_mvp_tally_audience.sql
A	supabase/migrations/20260830122500_allow_cleared_coach_position_assessments.sql
A	supabase/tests/20260829_admin_lineup_coaching_improvements.sql
A	supabase/tests/coordination_security_and_roles.sql
A	supabase/tests/coordination_workflow.sql
A	supabase/tests/dev_umpire_test_account_scope.sql
A	supabase/tests/player_mvp_notification_defaults.sql
A	supabase/tests/player_mvp_tally_presentations.sql
A	supabase/tests/private_helper_permissions.sql
A	tests/test_chat_removed_history_visibility.py
A	tests/test_committee_safety_migration_safety.py
A	tests/test_communication_notifications.py
A	tests/test_dev_test_account_reset.py
A	tests/test_fixture_presentations.py
A	tests/test_game_detail_availability.py
A	tests/test_game_detail_deduplication.py
A	tests/test_import_revsports_fixtures_v2.py
A	tests/test_lineup_availability_rules.py
A	tests/test_mvp_ballot_draft_persistence.py
M	tests/test_scraper_workflow_routine.py
A	tests/test_selected_player_availability_notifications.py
A	tests/test_session_permission_context.py
A	tests/test_umpire_ballot_back_persistence.py
A	tests/test_umpire_ballot_refresh_persistence.py
A	tests/test_umpire_candidate_scope.py
M	tests/test_upload_scrape_backups_to_storage.py
A	tests/test_voting_module_enforcement.py
M	vite.config.ts
```

## Migration-file inventory

```text
A	supabase/migrations/20260730114925_public_umpire_portal.sql
A	supabase/migrations/20260730124436_restore_default_voter_role.sql
A	supabase/migrations/20260731132457_add_stable_revsports_competition_external_ids.sql
A	supabase/migrations/20260801013000_harden_field_template_grants.sql
A	supabase/migrations/20260801030000_atomic_umpire_match_vote_submit.sql
A	supabase/migrations/20260801040000_atomic_membership_request_approval.sql
A	supabase/migrations/20260801041000_safe_venue_delete.sql
A	supabase/migrations/20260801050000_scoped_module_controls.sql
A	supabase/migrations/20260801060000_committee_setup.sql
A	supabase/migrations/20260801070000_committee_operations.sql
A	supabase/migrations/20260801071000_committee_operations_hardening.sql
A	supabase/migrations/20260801072000_committee_operations_indexes.sql
A	supabase/migrations/20260801080000_safety_hub_write_workflows.sql
A	supabase/migrations/20260801081000_safety_hub_linked_scope_fix.sql
A	supabase/migrations/20260801082000_committee_safety_links.sql
A	supabase/migrations/20260801083000_scoped_administration_integrity.sql
A	supabase/migrations/20260801084000_administration_scope_reads_and_snapshot.sql
A	supabase/migrations/20260801085000_super_admin_viewing_scope.sql
A	supabase/migrations/20260801090000_communication_message_revisions.sql
A	supabase/migrations/20260801091000_division_umpire_vote_scheme.sql
A	supabase/migrations/20260801092000_shared_sport_position_catalogue.sql
A	supabase/migrations/20260801093000_safety_risk_configuration_workflow.sql
A	supabase/migrations/20260801094000_committee_work_and_storage.sql
A	supabase/migrations/20260801095000_restrict_administration_rpc_execution.sql
A	supabase/migrations/20260801131220_fix_admin_role_enum_reference.sql
A	supabase/migrations/20260802100000_advanced_permission_management.sql
A	supabase/migrations/20260802101000_harden_permission_subject_hierarchy.sql
A	supabase/migrations/20260802102000_harden_is_super_admin_search_path.sql
A	supabase/migrations/20260802103000_harden_permission_function_execution.sql
A	supabase/migrations/20260802104000_validate_admin_role_scopes.sql
A	supabase/migrations/20260802105000_transactional_dev_account_and_role_guards.sql
A	supabase/migrations/20260802106000_mode_aware_permission_management.sql
A	supabase/migrations/20260802107000_mode_aware_permission_listing.sql
A	supabase/migrations/20260802108000_harden_permission_group_assignments.sql
A	supabase/migrations/20260802109000_authorise_dev_test_provisioning_session.sql
A	supabase/migrations/20260802110000_mode_aware_runtime_permissions.sql
A	supabase/migrations/20260802111000_scope_role_mutations_and_preserve_membership_player.sql
A	supabase/migrations/20260802112000_enforce_permission_set_scope_containment.sql
A	supabase/migrations/20260802113000_session_bound_permission_mode.sql
A	supabase/migrations/20260802113500_session_bound_permission_context.sql
A	supabase/migrations/20260802114000_enforce_committee_safety_module_access.sql
A	supabase/migrations/20260802115000_enforce_voting_module_access.sql
A	supabase/migrations/20260802231405_reserved_dev_test_account_lookup.sql
A	supabase/migrations/20260803090000_scope_reserved_umpire_voter_accounts.sql
A	supabase/migrations/20260803100000_include_role_scoped_admin_users.sql
A	supabase/migrations/20260803101000_include_role_scoped_admin_mutations.sql
A	supabase/migrations/20260803102000_exclude_broadcast_author_notifications.sql
A	supabase/migrations/20260803103000_notify_selected_player_availability_changes.sql
A	supabase/migrations/20260803104000_allow_umpire_role_fixture_scope.sql
A	supabase/migrations/20260804071327_expense_hub_stage_one.sql
A	supabase/migrations/20260804073000_harden_expense_hub_access_and_indexes.sql
A	supabase/migrations/20260804074800_allow_expense_finance_admin_edits.sql
A	supabase/migrations/20260804080500_allow_expense_finance_admin_aliases.sql
A	supabase/migrations/20260804084438_restrict_fixture_management_to_association_admins.sql
A	supabase/migrations/20260804181000_expense_hub_stage_two_foundation.sql
A	supabase/migrations/20260804183000_harden_expense_stage_two_ownership.sql
A	supabase/migrations/20260804190000_complete_expense_hub_stage_two.sql
A	supabase/migrations/20260804190500_limit_expense_statement_scans.sql
A	supabase/migrations/20260810090000_harden_functions_and_rls_performance.sql
A	supabase/migrations/20260811090305_guided_committee_workflow.sql
A	supabase/migrations/20260811091322_fix_guided_committee_creation_returning.sql
A	supabase/migrations/20260812110000_incident_discipline_foundation.sql
A	supabase/migrations/20260812111000_incident_discipline_workflows.sql
A	supabase/migrations/20260812112000_incident_discipline_seed_2026.sql
A	supabase/migrations/20260812113000_incident_discipline_indexes.sql
A	supabase/migrations/20260812114000_incident_discipline_portal_context.sql
A	supabase/migrations/20260812115000_incident_discipline_atomic_intake.sql
A	supabase/migrations/20260812116000_incident_discipline_report_hash.sql
A	supabase/migrations/20260812162815_improve_discipline_intake_guidance.sql
A	supabase/migrations/20260812164333_index_discipline_intake_links.sql
A	supabase/migrations/20260812235915_improve_discipline_investigator_setup.sql
A	supabase/migrations/20260813224228_discipline_review_panel_workflow.sql
A	supabase/migrations/20260813225158_discipline_review_vote_privacy.sql
A	supabase/migrations/20260813225641_index_discipline_review_panel_foreign_keys.sql
A	supabase/migrations/20260813230835_allow_no_investigator_outcome_recommendation.sql
A	supabase/migrations/20260813235900_discipline_tribunal_preparation.sql
A	supabase/migrations/20260814000500_harden_discipline_tribunal_preparation.sql
A	supabase/migrations/20260814010000_discipline_phase2_completion_workflow.sql
A	supabase/migrations/20260814012000_harden_discipline_phase2_appeal_and_closure.sql
A	supabase/migrations/20260815090000_incident_discipline_workflow_redesign.sql
A	supabase/migrations/20260815093000_enforce_discipline_stage_responsibilities.sql
A	supabase/migrations/20260815094500_lock_legacy_discipline_review_panels.sql
A	supabase/migrations/20260815103000_player_explorer_saved_and_scheduled_searches.sql
A	supabase/migrations/20260816204954_discipline_evidence_withdrawal_workflow.sql
A	supabase/migrations/20260816205950_fix_discipline_pending_evidence_guard.sql
A	supabase/migrations/20260816210103_order_discipline_evidence_status_events.sql
A	supabase/migrations/20260816213409_scope_player_explorer_access.sql
A	supabase/migrations/20260817100124_add_coordination_availability_states.sql
A	supabase/migrations/20260817100200_create_coordination_module.sql
A	supabase/migrations/20260817100300_integrate_coordination_notifications.sql
A	supabase/migrations/20260817100400_add_coordination_application_operations.sql
A	supabase/migrations/20260817100500_harden_coordination_transitions.sql
A	supabase/migrations/20260817100600_add_coordination_review_queues.sql
A	supabase/migrations/20260817100700_fix_replacement_assignment_link_order.sql
A	supabase/migrations/20260817100800_add_coordination_foreign_key_indexes.sql
A	supabase/migrations/20260817100900_authorise_coordination_account_invites.sql
A	supabase/migrations/20260817101000_protect_confirmed_coordination_availability.sql
A	supabase/migrations/20260817101100_allow_coordination_module_access.sql
A	supabase/migrations/20260817101200_fix_coordination_offer_rls_recursion.sql
A	supabase/migrations/20260819071731_scoped_umpire_and_coordinator_access.sql
A	supabase/migrations/20260819193617_restore_player_explorer_function_permissions.sql
A	supabase/migrations/20260820182455_restore_private_helper_permissions.sql
A	supabase/migrations/20260820203326_default_player_mvp_notifications_off.sql
A	supabase/migrations/20260820213845_fix_dev_umpire_account_scope.sql
A	supabase/migrations/20260829074811_admin_lineup_coaching_improvements.sql
A	supabase/migrations/20260829124215_published_player_mvp_tally_presentations.sql
A	supabase/migrations/20260829130253_index_player_mvp_tally_foreign_keys.sql
A	supabase/migrations/20260829131126_harden_player_mvp_tally_audience.sql
A	supabase/migrations/20260829150000_refine_player_mvp_tally_presentations.sql
A	supabase/migrations/20260829170000_dedupe_mvp_tally_audience.sql
A	supabase/migrations/20260830122500_allow_cleared_coach_position_assessments.sql
```

## Edge Function-file inventory

```text
A	supabase/functions/_shared/expense-ai-provider.ts
A	supabase/functions/_shared/playerExplorer.ts
A	supabase/functions/_shared/playerExplorerScheduled.ts
A	supabase/functions/coordination-invite/index.ts
A	supabase/functions/expense-document-extract/index.ts
A	supabase/functions/expense-statement-extract/index.ts
A	supabase/functions/mvp-tally-commentary/index.ts
M	supabase/functions/mvp-voting-email-reminders/index.ts
A	supabase/functions/provision-dev-test-account/index.ts
A	supabase/functions/public-umpire-match-voting/index.ts
M	supabase/functions/send-profile-access-link/index.ts
M	supabase/functions/sportstack-notification-dispatch/index.ts
```

## GitHub workflow-file inventory

```text
M	.github/workflows/dev-scrapers.yml
M	.github/workflows/production-scrapers.yml
A	.github/workflows/quality-dev.yml
```
