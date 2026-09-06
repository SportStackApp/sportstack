#!/usr/bin/env node

/**
 * Builds hosted-safe B1 runtime checks from the existing rollback-only checks.
 *
 * The original B1b and B1c checks select suitable rows from a Production-derived
 * data copy. Hosted rehearsal deliberately restores schema only, so this builder
 * injects deterministic example.invalid fixtures inside each existing transaction.
 * Both generated checks still finish with ROLLBACK and retain no fixture data.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");

const outputArgumentIndex = process.argv.indexOf("--output-dir");
if (outputArgumentIndex === -1 || !process.argv[outputArgumentIndex + 1]) {
  throw new Error("Usage: node scripts/build-b1-hosted-runtime.mjs --output-dir <directory>");
}

const outputDirectory = path.resolve(process.argv[outputArgumentIndex + 1]);

const checks = [
  {
    source: "scripts/sql/verify-b1-security-runtime.sql",
    output: "verify-b1-security-hosted-runtime.sql",
    marker:
      "-- temporary feature flag.\nbegin;\nselect set_config(",
    replacement: `-- temporary feature flag. Fake hosted rows are transaction-local.
begin;
insert into auth.users (id, email, role, aud)
values
  ('b1b00000-0000-0000-0000-000000000001', 'b1b-super@example.invalid', 'authenticated', 'authenticated'),
  ('b1b00000-0000-0000-0000-000000000002', 'b1b-unrelated@example.invalid', 'authenticated', 'authenticated');

insert into public.associations (id, name)
values ('b1b10000-0000-0000-0000-000000000001', 'B1b Hosted Association');

insert into public.profiles (id, first_name, last_name)
values
  ('b1b00000-0000-0000-0000-000000000001', 'B1b', 'Super'),
  ('b1b00000-0000-0000-0000-000000000002', 'B1b', 'Unrelated');

insert into public.user_roles (user_id, role)
values ('b1b00000-0000-0000-0000-000000000001', 'SUPER_ADMIN');

select set_config(`,
  },
  {
    source: "scripts/sql/verify-b1-membership-runtime.sql",
    output: "verify-b1-membership-hosted-runtime.sql",
    marker:
      "-- test inputs. Every workflow change below is rolled back.\nbegin;\ndo $b1c_select_candidate$",
    replacement: `-- test inputs. Every workflow change below is rolled back.
begin;
select set_config('app.mvp_team_setting_write', 'allowed', true);

insert into auth.users (id, email, role, aud)
values
  ('b1c00000-0000-0000-0000-000000000001', 'b1c-requester@example.invalid', 'authenticated', 'authenticated'),
  ('b1c00000-0000-0000-0000-000000000002', 'b1c-admin@example.invalid', 'authenticated', 'authenticated'),
  ('b1c00000-0000-0000-0000-000000000003', 'b1c-unrelated@example.invalid', 'authenticated', 'authenticated');

insert into public.associations (id, name)
values ('b1c10000-0000-0000-0000-000000000001', 'B1c Hosted Association');

insert into public.clubs (id, association_id, name)
values ('b1c20000-0000-0000-0000-000000000001', 'b1c10000-0000-0000-0000-000000000001', 'B1c Hosted Club');

insert into public.teams (id, club_id, name)
values
  ('b1c30000-0000-0000-0000-000000000001', 'b1c20000-0000-0000-0000-000000000001', 'B1c Hosted Team A'),
  ('b1c30000-0000-0000-0000-000000000002', 'b1c20000-0000-0000-0000-000000000001', 'B1c Hosted Team B');

insert into public.profiles (id, first_name, last_name)
values
  ('b1c00000-0000-0000-0000-000000000001', 'B1c', 'Requester'),
  ('b1c00000-0000-0000-0000-000000000002', 'B1c', 'Administrator'),
  ('b1c00000-0000-0000-0000-000000000003', 'B1c', 'Unrelated');

insert into public.team_memberships (id, user_id, team_id, membership_type, status)
values (
  'b1c40000-0000-0000-0000-000000000001',
  'b1c00000-0000-0000-0000-000000000001',
  'b1c30000-0000-0000-0000-000000000001',
  'PRIMARY',
  'ACTIVE'
);

do $b1c_select_candidate$`,
  },
];

await mkdir(outputDirectory, { recursive: true });

for (const check of checks) {
  const sourcePath = path.join(repositoryRoot, check.source);
  const original = (await readFile(sourcePath, "utf8")).replaceAll("\r\n", "\n");
  const occurrences = original.split(check.marker).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected one hosted injection marker in ${check.source}, found ${occurrences}.`);
  }

  const generated = original.replace(check.marker, check.replacement);
  if (!generated.includes("rollback;")) {
    throw new Error(`Generated check ${check.output} is not rollback-only.`);
  }

  await writeFile(path.join(outputDirectory, check.output), generated, "utf8");
}

console.log(`Built ${checks.length} hosted B1 runtime checks in ${outputDirectory}.`);
