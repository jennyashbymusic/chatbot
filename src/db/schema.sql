-- Jenny Ashby chatbot — Supabase schema (Section 3 of the master build doc)
-- Run this in the Supabase SQL editor for a fresh project.

create extension if not exists "uuid-ossp";

create table if not exists fans (
  id uuid primary key default uuid_generate_v4(),
  phone_number text not null unique,
  name text,
  first_contact_date timestamptz not null default now(),
  source text,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'basic', 'voice')),
  credits_remaining integer not null default 0,
  stripe_customer_id text
);

create table if not exists fan_memory (
  fan_id uuid primary key references fans (id) on delete cascade,
  summary text not null default '',
  key_facts jsonb not null default '{}'::jsonb,
  last_updated timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default uuid_generate_v4(),
  fan_id uuid not null references fans (id) on delete cascade,
  message_direction text not null check (message_direction in ('inbound', 'outbound')),
  message_text text not null,
  timestamp timestamptz not null default now(),
  flagged boolean not null default false,
  human_override boolean not null default false
);

create index if not exists conversations_fan_id_idx on conversations (fan_id, timestamp desc);
create index if not exists conversations_flagged_idx on conversations (flagged) where flagged = true;
create index if not exists fans_phone_number_idx on fans (phone_number);

-- Atomic credit helpers, used by src/db/fans.ts so credit updates never race
-- under concurrent webhook/message traffic.
create or replace function decrement_fan_credit(p_fan_id uuid)
returns void as $$
  update fans
  set credits_remaining = greatest(credits_remaining - 1, 0)
  where id = p_fan_id;
$$ language sql volatile;

create or replace function add_fan_credits(p_stripe_customer_id text, p_credits integer)
returns void as $$
  update fans
  set credits_remaining = credits_remaining + p_credits
  where stripe_customer_id = p_stripe_customer_id;
$$ language sql volatile;
