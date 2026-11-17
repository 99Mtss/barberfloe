alter table public.store_settings
    add column if not exists hero_banner_path text not null default '';
