# Changelog

## [0.0.4](https://github.com/theonly1me/shadowclone/compare/v0.0.3...v0.0.4) (2026-09-06)


### Fixes

* **cursor:** support wal mode without shm files via immutable fallback ([bc35a50](https://github.com/theonly1me/shadowclone/commit/bc35a50566c2438e31332fbecce19359c9d0c66e))
* **cursor:** support wal mode without shm files via immutable fallback ([4ca0731](https://github.com/theonly1me/shadowclone/commit/4ca0731ecd06f77c61e4107a8b9bd3bc8b6b1099))
* **eval:** address shadowclone self-review findings ([b81bd0f](https://github.com/theonly1me/shadowclone/commit/b81bd0f6ba64a33b10a800f308e056353351e64b))
* **eval:** use uuid session ids, extract prompt text, and drop structural telemetry on deep learn ([ce9fb74](https://github.com/theonly1me/shadowclone/commit/ce9fb74b49cce674c54f688ec48836e53dbf854f))
* **eval:** use uuid session ids, extract prompt text, and drop structural telemetry on deep learn ([32e1581](https://github.com/theonly1me/shadowclone/commit/32e1581da50ce73922dd03773eb9f13136df57d0))

## [0.0.3](https://github.com/theonly1me/shadowclone/compare/v0.0.2...v0.0.3) (2026-09-06)


### Features

* **dispatch:** enforce dispatch ceiling, host-side push, and git exclude agent ([f15886e](https://github.com/theonly1me/shadowclone/commit/f15886e9556253a1b4885175deee47699234baaf))
* **dispatch:** enforce dispatch ceiling, host-side push, and git exclude agent ([3e63567](https://github.com/theonly1me/shadowclone/commit/3e63567b341438e5126504772cca1301fd0d9f15))
* **eval:** add replay eval command, action fingerprints, and delta scoring (closes [#14](https://github.com/theonly1me/shadowclone/issues/14)) ([67705bb](https://github.com/theonly1me/shadowclone/commit/67705bb615d5f5c45902da90d78278f165960fde))
* **eval:** add replay eval command, action fingerprints, and delta scoring (closes [#14](https://github.com/theonly1me/shadowclone/issues/14)) ([b20c60b](https://github.com/theonly1me/shadowclone/commit/b20c60ba88620e2d1ec309d1cd0bfd9d7f30f9b9))
* **profile:** scoped pruning, truthful evidence, and git exclude ([8911b09](https://github.com/theonly1me/shadowclone/commit/8911b09c3e9ed3f97e0e475b920b0544a9f1d48e))
* **profile:** scoped pruning, truthful evidence, and git exclude ([5c1b081](https://github.com/theonly1me/shadowclone/commit/5c1b0816c1a33c61180bcbe0263d6ebeef025bf7))
* **redact:** sliced redaction and adversarial corpus ([50cd650](https://github.com/theonly1me/shadowclone/commit/50cd65009a8dc57d0858a4e64e315e8ef577f074))
* **redact:** sliced redaction and adversarial corpus ([2141655](https://github.com/theonly1me/shadowclone/commit/214165579f21c69af1533632a92461d98031bcf8))
* **signal:** add marker staleness detection, antigravity cancel mapping, and learn dry-run ([574e929](https://github.com/theonly1me/shadowclone/commit/574e92976c26688ffd7de647e05d692d44b64df3))
* **signal:** add marker staleness detection, antigravity cancel mapping, and learn dry-run ([c3b237a](https://github.com/theonly1me/shadowclone/commit/c3b237a1b247d73572854766a4864f042a294be5))


### Fixes

* **docs:** replace amnesia hook with agreed cross-session lead in launch brief ([a7ae94f](https://github.com/theonly1me/shadowclone/commit/a7ae94f2be36dbf644a4d25c5291aefd363a52ad))
* **eval:** add cost confirmation preview and isolate session working directories ([66af631](https://github.com/theonly1me/shadowclone/commit/66af63192343b273fcbfc67ea14bffc78fdb75d5))
* **profile:** drop in-flight duplicate rules and checkpoint merge distillation ([537d22a](https://github.com/theonly1me/shadowclone/commit/537d22ace3745f18035483a713b9a1b40df3b37b))
* **redact:** handle compound secret assignments and file URLs in home scrubbing ([a1c444a](https://github.com/theonly1me/shadowclone/commit/a1c444a04c504b36309b3b8b5fc83bff1d2fb721))


### Documentation

* **readme:** rewrite positioning, add evaluation architecture, and launch brief ([dfb2758](https://github.com/theonly1me/shadowclone/commit/dfb27588f31746d8461b9c7e67016b99c711eabd))
* **readme:** rewrite positioning, add evaluation architecture, and motivation ([4750129](https://github.com/theonly1me/shadowclone/commit/475012957519590409cb222136a2361bd6c22549))

## [0.0.2](https://github.com/theonly1me/shadowclone/compare/v0.0.1...v0.0.2) (2026-09-05)


### Features

* add --help and --version to the cli ([5ed2bf1](https://github.com/theonly1me/shadowclone/commit/5ed2bf19fae1cc7524da9b2a09ec04e5ae2d5c47))
* add codex and cursor providers ([5800691](https://github.com/theonly1me/shadowclone/commit/5800691c3ea57b48654fae0d69775a3dea1ae58f))
* add opt-in transcript indexing ([e6895de](https://github.com/theonly1me/shadowclone/commit/e6895de57921b5f00e7a2cc57294904db5e42ef1))
* add provider capabilities and antigravity observation ([688ab6c](https://github.com/theonly1me/shadowclone/commit/688ab6cd104c23b9c7f0d484491fd3e644e93a90))
* add provider capabilities and antigravity observation ([23cee6c](https://github.com/theonly1me/shadowclone/commit/23cee6cd77cb329aa9df83ec7421ec2b7801a878))
* add the headless worktree clone ([4214994](https://github.com/theonly1me/shadowclone/commit/421499473db098e719bd20b43b4fa38f86bdb533))
* add the live session clone ([3926132](https://github.com/theonly1me/shadowclone/commit/392613265e616c6b8829c63a9d418f5ed05199e9))
* build phase zero foundation ([8904ab5](https://github.com/theonly1me/shadowclone/commit/8904ab5c6a60ef03153457dd6b57e8073192d936))
* build the offline mirror ([57ec82e](https://github.com/theonly1me/shadowclone/commit/57ec82edf5da6f11f73dd02d6db47c4e5a3b1115))
* distillation consolidation pass and telemetry dropping ([28843ef](https://github.com/theonly1me/shadowclone/commit/28843efa5ae54c0b5cbf799bbebf72d761d03bb0))
* distillation consolidation pass and telemetry dropping ([8568492](https://github.com/theonly1me/shadowclone/commit/8568492a7a908dd5591f5ed593e27feb6bed7c7d))
* publish shadowclone to npm with per-platform binaries ([d94847d](https://github.com/theonly1me/shadowclone/commit/d94847d744f68b07231102357cf88894bab69c91))
* publish shadowclone to npm with per-platform binaries ([987cb4a](https://github.com/theonly1me/shadowclone/commit/987cb4a7c658f11e0864dc904799b44a25231611))
* quickstart and auto-init/install UX ([1bf1c45](https://github.com/theonly1me/shadowclone/commit/1bf1c45660222d530d8e376af7b681c815d301f7))
* quickstart and auto-init/install UX ([325e020](https://github.com/theonly1me/shadowclone/commit/325e0209be603574e21699f597aadc2647520a08))
* ship a single npm package that brings its own runtime ([d1c98d4](https://github.com/theonly1me/shadowclone/commit/d1c98d4eedb46e7ee1fcbc1beb22f9bb0fedde6e))
* ship a single npm package that brings its own runtime ([7dcf207](https://github.com/theonly1me/shadowclone/commit/7dcf207238b77e5c7e12382c10244ab6a0a1c1a1))


### Fixes

* annotate the cursor stat result for the lint gate ([ce303e1](https://github.com/theonly1me/shadowclone/commit/ce303e16d33657cd5223926610ace83347e24516))
* bound correction context egress ([839a8c7](https://github.com/theonly1me/shadowclone/commit/839a8c7c083a6b121af52a992789d6112eef3285))
* fall back to unmerged rules when the merge response is unusable ([8f3e792](https://github.com/theonly1me/shadowclone/commit/8f3e79208d3bcb5c5c1394b88d1c5f94482abe41))
* ignore unreadable cursor database ([70b0bca](https://github.com/theonly1me/shadowclone/commit/70b0bca6a0d4caaf7fcd5642511d861250945b38))
* ignore unreadable cursor database ([f769c80](https://github.com/theonly1me/shadowclone/commit/f769c80b41cedc6bfd975e882a84630aef30470f))
* keep distilled rules and remove emptied profile files during the prune ([5399a77](https://github.com/theonly1me/shadowclone/commit/5399a77308719f57069daa66e451c6b29d5c02d1))
* keep learned boundaries advisory ([1a2cfd6](https://github.com/theonly1me/shadowclone/commit/1a2cfd63f1e7009786cfa2c3e99b51105897c49a))
* keep learned tool denials advisory ([d09ef1c](https://github.com/theonly1me/shadowclone/commit/d09ef1cde1b129fa6238c06930227febef871638))
* only auto-install the live clone inside a git work tree ([8be0bd1](https://github.com/theonly1me/shadowclone/commit/8be0bd186fb394511dfea0beb4db79cee0f4eaa8))
* report managed engine policy accurately ([188e2b5](https://github.com/theonly1me/shadowclone/commit/188e2b5f19ff832bd9b64eac213a60a0ceaff525))
* use an optional chain in the checkpoint rule guard ([46908e3](https://github.com/theonly1me/shadowclone/commit/46908e35fbef561dda38e7fe30ba7fa47c7cb111))
* use an optional chain in the distillation capability check ([9925ad5](https://github.com/theonly1me/shadowclone/commit/9925ad545e9eb446a0dce0b956d9451b6fb3e600))


### Documentation

* add amnesia copy to README ([0841108](https://github.com/theonly1me/shadowclone/commit/0841108003a18224733fafb594df730e3c2b0435))
* add amnesia copy to README ([9d7881b](https://github.com/theonly1me/shadowclone/commit/9d7881bbf0cfc69bb731daa4d449b63554ba7010))
* add the competitive landscape and what to borrow from trace ([0f5d6ed](https://github.com/theonly1me/shadowclone/commit/0f5d6ede1e62e4b48e30e630d0068870fdc20db0))
* align readme, claude.md, and contributing with the transcript design ([817a036](https://github.com/theonly1me/shadowclone/commit/817a0367f3916e63efcabd2fc8b1690008f8a7f5))
* align readme, claude.md, and contributing with the transcript design ([7e86115](https://github.com/theonly1me/shadowclone/commit/7e8611557abc32e91dc9e0981527952a325fb498))
* architect the pivot to agent transcript learning ([b5b22e2](https://github.com/theonly1me/shadowclone/commit/b5b22e2f990c670e9e17677aa5143cc7e0d97ba4))
* architect the pivot to agent transcript learning ([baf32c6](https://github.com/theonly1me/shadowclone/commit/baf32c671e411394b2f0c10cf22cf7b78a03a491))
* compile the profile into a subagent and label the learn mockup ([256383b](https://github.com/theonly1me/shadowclone/commit/256383b21fd978b20c3df98c7f6e0d9071e99cd4))
* cut the readme to shape and split wall paragraphs ([0293343](https://github.com/theonly1me/shadowclone/commit/02933430f367f9f8b8504913a6a7e983cd42ced0))
* cut the readme to shape and split wall paragraphs ([511688a](https://github.com/theonly1me/shadowclone/commit/511688a645c5ef1d3e1cf77b178860aa963a8f78))
* document the gate, releasing, and security reporting ([aeec81c](https://github.com/theonly1me/shadowclone/commit/aeec81c15322d9c082e8ff2862781996fa569831))
* highlight architectural advantages ([5354cf4](https://github.com/theonly1me/shadowclone/commit/5354cf4ff191f0cc0e9b0561c39cf8794483c5da))
* keep antigravity observation only ([e23ad7d](https://github.com/theonly1me/shadowclone/commit/e23ad7d3f3918b3fab39fdeaa01db45ee4160b2c))
* list antigravity capture source ([fb29eef](https://github.com/theonly1me/shadowclone/commit/fb29eef99704a13841a124fea028fdba576b83c9))
* plan provider expansion ([c24608f](https://github.com/theonly1me/shadowclone/commit/c24608f41902309691b8fe140e69bb6fa1782888))
* put the mirror first and compile the profile into a subagent ([1a04ff1](https://github.com/theonly1me/shadowclone/commit/1a04ff13b2b5e2c60ce39ffe275bbd1e57374ecd))
* put the mirror first and make phase 2 the go or no go ([062baad](https://github.com/theonly1me/shadowclone/commit/062baadd281c83c63c703e651db6d41b22addda8))
* renumber the provider expansion design doc ([a4528fe](https://github.com/theonly1me/shadowclone/commit/a4528fe9b2ba9ddaa9054c02cc0527b47c37490f))
* skip deprecated gemini cli ([9ed5bf5](https://github.com/theonly1me/shadowclone/commit/9ed5bf5db988389712aa7cc0eafaa4e553984584))
* track executable replay evaluation ([2d8e084](https://github.com/theonly1me/shadowclone/commit/2d8e08492237f3a9c8d85c3a330a075ad39d16f5))
