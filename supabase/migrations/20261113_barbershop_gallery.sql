create table if not exists public.barber_shop_photos (
    id uuid primary key default gen_random_uuid(),
    storage_path text not null unique,
    alt_text text not null default '',
    created_at timestamptz not null default now()
);

grant select on public.barber_shop_photos to anon, authenticated;
grant insert, update, delete on public.barber_shop_photos to authenticated;

alter table public.barber_shop_photos enable row level security;

drop policy if exists "Public can read barber shop photos" on public.barber_shop_photos;
create policy "Public can read barber shop photos"
    on public.barber_shop_photos for select to anon, authenticated
    using (true);

drop policy if exists "Admins can manage barber shop photos" on public.barber_shop_photos;
create policy "Admins can manage barber shop photos"
    on public.barber_shop_photos for all to authenticated
    using ((select public.is_barberflow_admin()))
    with check ((select public.is_barberflow_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'barberflow-barbershop',
    'barberflow-barbershop',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload barber shop photos" on storage.objects;
create policy "Admins can upload barber shop photos"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'barberflow-barbershop'
        and (select public.is_barberflow_admin())
    );

drop policy if exists "Admins can update barber shop photos" on storage.objects;
create policy "Admins can update barber shop photos"
    on storage.objects for update to authenticated
    using (
        bucket_id = 'barberflow-barbershop'
        and (select public.is_barberflow_admin())
    )
    with check (
        bucket_id = 'barberflow-barbershop'
        and (select public.is_barberflow_admin())
    );

drop policy if exists "Admins can delete barber shop photos" on storage.objects;
create policy "Admins can delete barber shop photos"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'barberflow-barbershop'
        and (select public.is_barberflow_admin())
    );
