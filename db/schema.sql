-- OpenArena local Postgres schema for imported Magic cards and shared logic files.
--
-- Design notes:
-- - `cards` stores one row per Scryfall printing, keyed by `scryfall_id`.
-- - `logic_files` stores one shared logic script per gameplay identity, keyed by `oracle_id`.
-- - importer bookkeeping lives in `import_jobs` and `import_checkpoints`.

create extension if not exists pgcrypto;

create table if not exists logic_files (
  -- Internal stable identifier for the shared logic row.
  id uuid primary key default gen_random_uuid(),
  -- Scryfall oracle identity shared by reprints with the same rules text.
  oracle_id uuid not null unique,
  -- Canonical display name used when generating or reviewing the logic script.
  canonical_name text not null,
  -- JavaScript function body text that encodes this card's gameplay logic.
  content text,
  -- Lifecycle state for logic generation and validation.
  status text not null check (status in ('pending', 'ready', 'failed')),
  -- Hash of the stored script content for change detection and dedupe checks.
  content_sha256 text,
  -- Model identifier used to generate the current script revision.
  generation_model text,
  -- Prompt/template version used when generating the current script revision.
  generation_prompt_version text,
  -- Most recent generation or validation failure message, if any.
  last_error text,
  -- Timestamp when this shared logic row was first created.
  created_at timestamptz not null default now(),
  -- Timestamp when this shared logic row was last updated.
  updated_at timestamptz not null default now()
);

create table if not exists cards (
  -- Internal stable identifier for a specific printed card row.
  id uuid primary key default gen_random_uuid(),
  -- Scryfall identifier for this exact printing/version of the card.
  scryfall_id uuid not null unique,
  -- Scryfall oracle identity used to group reprints with shared gameplay logic.
  oracle_id uuid not null,
  -- Foreign key to the shared logic script used by this printing.
  logic_file uuid not null references logic_files(id),
  -- Printed card name for this specific Scryfall record.
  name text not null,
  -- Three-to-five letter Scryfall set code for this printing.
  set_code text not null,
  -- Human-readable set name for this printing.
  set_name text not null,
  -- Collector number within the set.
  collector_number text not null,
  -- Language code of the imported printing.
  lang text not null,
  -- Official release date for the printing, when available.
  released_at date,
  -- Printed rarity reported by Scryfall.
  rarity text,
  -- Mana cost string such as `{2}{G}{G}`.
  mana_cost text,
  -- Converted mana value from Scryfall.
  cmc numeric,
  -- Full printed type line, such as `Legendary Creature — Elf Druid`.
  type_line text not null,
  -- Oracle rules text for the card or combined face text.
  oracle_text text,
  -- Printed power value for creatures, stored as text to preserve `*` and similar values.
  power text,
  -- Printed toughness value for creatures, stored as text to preserve `*` and similar values.
  toughness text,
  -- Printed loyalty value for planeswalkers and similar cards.
  loyalty text,
  -- JSON array of color identity symbols, such as `["G"]` or `["U","R"]`.
  color_identity jsonb not null default '[]'::jsonb,
  -- JSON array of supertypes parsed from the type line.
  supertypes jsonb not null default '[]'::jsonb,
  -- JSON array of card types parsed from the type line.
  types jsonb not null default '[]'::jsonb,
  -- JSON array of subtypes parsed from the type line.
  subtypes jsonb not null default '[]'::jsonb,
  -- Full raw Scryfall payload preserved for reprocessing and debugging.
  scryfall_payload jsonb not null,
  -- Direct Scryfall-hosted URL for the preferred imported card image.
  image_url text,
  -- Timestamp when this card row was first created.
  created_at timestamptz not null default now(),
  -- Timestamp when this card row was last updated.
  updated_at timestamptz not null default now()
);

create index if not exists cards_oracle_id_idx on cards (oracle_id);
create index if not exists cards_set_code_idx on cards (set_code);
create index if not exists cards_logic_file_idx on cards (logic_file);

create table if not exists import_jobs (
  -- Internal stable identifier for a complete importer run configuration.
  id uuid primary key default gen_random_uuid(),
  -- Source system used for card metadata, e.g. `scryfall`.
  source text not null,
  -- Ordered JSON array of set codes targeted by this importer job.
  set_codes jsonb not null,
  -- Current state of the overall import job.
  status text not null check (status in ('pending', 'running', 'completed', 'failed')),
  -- Timestamp when the job began processing.
  started_at timestamptz,
  -- Timestamp when the job completed successfully or failed terminally.
  completed_at timestamptz,
  -- Job-level failure details, if the run stops unexpectedly.
  last_error text,
  -- Timestamp when this job row was first created.
  created_at timestamptz not null default now(),
  -- Timestamp when this job row was last updated.
  updated_at timestamptz not null default now()
);

create table if not exists import_checkpoints (
  -- Internal stable identifier for a per-set checkpoint row.
  id uuid primary key default gen_random_uuid(),
  -- Import job that owns this checkpoint.
  job_id uuid not null references import_jobs(id) on delete cascade,
  -- Set code currently being processed or already completed.
  set_code text not null,
  -- Most recent Scryfall card id processed for this set.
  last_scryfall_id uuid,
  -- Collector number of the most recent processed card for deterministic resume ordering.
  last_collector_number text,
  -- Count of successfully processed cards for this set within the job.
  processed_count integer not null default 0,
  -- Timestamp when the set finished importing.
  completed_at timestamptz,
  -- Timestamp when this checkpoint row was first created.
  created_at timestamptz not null default now(),
  -- Timestamp when this checkpoint row was last updated.
  updated_at timestamptz not null default now(),
  unique (job_id, set_code)
);

comment on table logic_files is 'Shared gameplay logic scripts keyed by Scryfall oracle identity.';
comment on column logic_files.id is 'Internal stable identifier for the shared logic row.';
comment on column logic_files.oracle_id is 'Scryfall oracle identity shared by reprints with the same rules text.';
comment on column logic_files.canonical_name is 'Canonical display name used when generating or reviewing the logic script.';
comment on column logic_files.content is 'JavaScript function body text that encodes this card''s gameplay logic.';
comment on column logic_files.status is 'Lifecycle state for logic generation and validation.';
comment on column logic_files.content_sha256 is 'Hash of the stored script content for change detection and dedupe checks.';
comment on column logic_files.generation_model is 'Model identifier used to generate the current script revision.';
comment on column logic_files.generation_prompt_version is 'Prompt/template version used when generating the current script revision.';
comment on column logic_files.last_error is 'Most recent generation or validation failure message, if any.';
comment on column logic_files.created_at is 'Timestamp when this shared logic row was first created.';
comment on column logic_files.updated_at is 'Timestamp when this shared logic row was last updated.';

comment on table cards is 'Per-printing card records imported from Scryfall.';
comment on column cards.id is 'Internal stable identifier for a specific printed card row.';
comment on column cards.scryfall_id is 'Scryfall identifier for this exact printing/version of the card.';
comment on column cards.oracle_id is 'Scryfall oracle identity used to group reprints with shared gameplay logic.';
comment on column cards.logic_file is 'Foreign key to the shared logic script used by this printing.';
comment on column cards.name is 'Printed card name for this specific Scryfall record.';
comment on column cards.set_code is 'Three-to-five letter Scryfall set code for this printing.';
comment on column cards.set_name is 'Human-readable set name for this printing.';
comment on column cards.collector_number is 'Collector number within the set.';
comment on column cards.lang is 'Language code of the imported printing.';
comment on column cards.released_at is 'Official release date for the printing, when available.';
comment on column cards.rarity is 'Printed rarity reported by Scryfall.';
comment on column cards.mana_cost is 'Mana cost string such as `{2}{G}{G}`.';
comment on column cards.cmc is 'Converted mana value from Scryfall.';
comment on column cards.type_line is 'Full printed type line, such as `Legendary Creature — Elf Druid`.';
comment on column cards.oracle_text is 'Oracle rules text for the card or combined face text.';
comment on column cards.power is 'Printed power value for creatures, stored as text to preserve `*` and similar values.';
comment on column cards.toughness is 'Printed toughness value for creatures, stored as text to preserve `*` and similar values.';
comment on column cards.loyalty is 'Printed loyalty value for planeswalkers and similar cards.';
comment on column cards.color_identity is 'JSON array of color identity symbols, such as ["G"] or ["U","R"].';
comment on column cards.supertypes is 'JSON array of supertypes parsed from the type line.';
comment on column cards.types is 'JSON array of card types parsed from the type line.';
comment on column cards.subtypes is 'JSON array of subtypes parsed from the type line.';
comment on column cards.scryfall_payload is 'Full raw Scryfall payload preserved for reprocessing and debugging.';
comment on column cards.image_url is 'Direct Scryfall-hosted URL for the preferred imported card image.';
comment on column cards.created_at is 'Timestamp when this card row was first created.';
comment on column cards.updated_at is 'Timestamp when this card row was last updated.';

comment on table import_jobs is 'Importer runs that define which sets are being processed and their overall status.';
comment on column import_jobs.id is 'Internal stable identifier for a complete importer run configuration.';
comment on column import_jobs.source is 'Source system used for card metadata, e.g. `scryfall`.';
comment on column import_jobs.set_codes is 'Ordered JSON array of set codes targeted by this importer job.';
comment on column import_jobs.status is 'Current state of the overall import job.';
comment on column import_jobs.started_at is 'Timestamp when the job began processing.';
comment on column import_jobs.completed_at is 'Timestamp when the job completed successfully or failed terminally.';
comment on column import_jobs.last_error is 'Job-level failure details, if the run stops unexpectedly.';
comment on column import_jobs.created_at is 'Timestamp when this job row was first created.';
comment on column import_jobs.updated_at is 'Timestamp when this job row was last updated.';

comment on table import_checkpoints is 'Per-set resume markers used to restart an import job safely.';
comment on column import_checkpoints.id is 'Internal stable identifier for a per-set checkpoint row.';
comment on column import_checkpoints.job_id is 'Import job that owns this checkpoint.';
comment on column import_checkpoints.set_code is 'Set code currently being processed or already completed.';
comment on column import_checkpoints.last_scryfall_id is 'Most recent Scryfall card id processed for this set.';
comment on column import_checkpoints.last_collector_number is 'Collector number of the most recent processed card for deterministic resume ordering.';
comment on column import_checkpoints.processed_count is 'Count of successfully processed cards for this set within the job.';
comment on column import_checkpoints.completed_at is 'Timestamp when the set finished importing.';
comment on column import_checkpoints.created_at is 'Timestamp when this checkpoint row was first created.';
comment on column import_checkpoints.updated_at is 'Timestamp when this checkpoint row was last updated.';
