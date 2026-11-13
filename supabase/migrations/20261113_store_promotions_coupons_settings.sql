alter table public.products
    add column if not exists promotion_percent numeric(5, 2),
    add column if not exists promotion_starts_at timestamptz,
    add column if not exists promotion_ends_at timestamptz;

alter table public.products
    drop constraint if exists products_promotion_percent_check,
    add constraint products_promotion_percent_check
        check (promotion_percent is null or promotion_percent between 0.01 and 99.99),
    drop constraint if exists products_promotion_dates_check,
    add constraint products_promotion_dates_check
        check (
            promotion_starts_at is null
            or promotion_ends_at is null
            or promotion_ends_at > promotion_starts_at
        );

alter table public.orders
    add column if not exists coupon_code text,
    add column if not exists discount_amount numeric(10, 2) not null default 0
        check (discount_amount >= 0);

alter table public.orders
    drop constraint if exists orders_total_check,
    drop constraint if exists orders_total_nonnegative_check,
    add constraint orders_total_nonnegative_check
        check (total >= 0);

create table if not exists public.store_coupons (
    code text primary key check (code ~ '^[A-Z0-9_-]{3,30}$'),
    discount_percent numeric(5, 2) not null
        check (discount_percent between 0.01 and 100),
    starts_at timestamptz,
    expires_at timestamptz,
    usage_limit integer check (usage_limit is null or usage_limit > 0),
    usage_count integer not null default 0 check (usage_count >= 0),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    constraint store_coupons_dates_check
        check (starts_at is null or expires_at is null or expires_at > starts_at),
    constraint store_coupons_usage_check
        check (usage_limit is null or usage_count <= usage_limit)
);

create table if not exists public.store_settings (
    singleton boolean primary key default true check (singleton),
    profile_image_path text not null default '',
    updated_at timestamptz not null default now()
);

insert into public.store_settings (singleton)
values (true)
on conflict (singleton) do nothing;

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = 'store_coupons'
    ) then
        alter publication supabase_realtime add table public.store_coupons;
    end if;
end;
$$;

grant select, insert, update, delete on public.store_coupons to authenticated;
grant select on public.store_settings to anon, authenticated;
grant insert, update on public.store_settings to authenticated;

alter table public.store_coupons enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "Admins can manage store coupons" on public.store_coupons;
create policy "Admins can manage store coupons"
    on public.store_coupons for all to authenticated
    using ((select public.is_barberflow_admin()))
    with check ((select public.is_barberflow_admin()));

drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings"
    on public.store_settings for select to anon, authenticated
    using (true);

drop policy if exists "Admins can manage store settings" on public.store_settings;
create policy "Admins can manage store settings"
    on public.store_settings for all to authenticated
    using ((select public.is_barberflow_admin()))
    with check ((select public.is_barberflow_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'barberflow-profile',
    'barberflow-profile',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload store profile photo" on storage.objects;
create policy "Admins can upload store profile photo"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'barberflow-profile'
        and (select public.is_barberflow_admin())
    );

drop policy if exists "Admins can update store profile photo" on storage.objects;
create policy "Admins can update store profile photo"
    on storage.objects for update to authenticated
    using (
        bucket_id = 'barberflow-profile'
        and (select public.is_barberflow_admin())
    )
    with check (
        bucket_id = 'barberflow-profile'
        and (select public.is_barberflow_admin())
    );

drop policy if exists "Admins can delete store profile photo" on storage.objects;
create policy "Admins can delete store profile photo"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'barberflow-profile'
        and (select public.is_barberflow_admin())
    );

create or replace function public.preview_barberflow_order(
    p_items jsonb,
    p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_item record;
    v_product public.products%rowtype;
    v_quantity integer;
    v_coupon public.store_coupons%rowtype;
    v_subtotal numeric(10, 2) := 0;
    v_promo_discount numeric(10, 2) := 0;
    v_coupon_discount numeric(10, 2) := 0;
    v_coupon_base numeric(10, 2) := 0;
    v_unit_price numeric(10, 2);
    v_is_promoted boolean;
    v_coupon_code text := upper(trim(coalesce(p_coupon_code, '')));
begin
    if p_items is null or jsonb_typeof(p_items) <> 'array' then
        raise exception 'Os itens do pedido são inválidos.';
    end if;
    if jsonb_array_length(p_items) not between 1 and 20 then
        raise exception 'Os itens do pedido são inválidos.';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(p_items) as entry(value)
        where jsonb_typeof(entry.value) <> 'object'
            or coalesce(entry.value ->> 'product_id', '') = ''
            or coalesce(entry.value ->> 'quantity', '') !~ '^[1-9][0-9]{0,2}$'
    ) then
        raise exception 'Os itens ou quantidades do pedido são inválidos.';
    end if;

    for v_item in
        select
            (entry.value ->> 'product_id')::uuid as product_id,
            sum((entry.value ->> 'quantity')::integer)::integer as quantity
        from jsonb_array_elements(p_items) as entry(value)
        group by (entry.value ->> 'product_id')::uuid
    loop
        v_quantity := v_item.quantity;
        if v_quantity > 99 then
            raise exception 'A quantidade máxima por produto é 99.';
        end if;

        select * into v_product
        from public.products
        where id = v_item.product_id
            and status = 'active'
            and stock >= v_quantity;
        if not found then
            raise exception 'Um produto não está mais disponível na quantidade solicitada.';
        end if;

        v_is_promoted := v_product.promotion_percent is not null
            and (v_product.promotion_starts_at is null or v_product.promotion_starts_at <= now())
            and (v_product.promotion_ends_at is null or v_product.promotion_ends_at > now());
        v_unit_price := case
            when v_is_promoted
                then greatest(0.01, round(v_product.price * (1 - v_product.promotion_percent / 100), 2))
            else v_product.price
        end;

        v_subtotal := v_subtotal + v_product.price * v_quantity;
        v_promo_discount := v_promo_discount
            + (v_product.price - v_unit_price) * v_quantity;
        if not v_is_promoted then
            v_coupon_base := v_coupon_base + v_unit_price * v_quantity;
        end if;
    end loop;

    if v_coupon_code <> '' then
        select * into v_coupon
        from public.store_coupons
        where code = v_coupon_code
            and active
            and (starts_at is null or starts_at <= now())
            and (expires_at is null or expires_at > now())
            and (usage_limit is null or usage_count < usage_limit);

        if not found then
            return jsonb_build_object(
                'valid', false,
                'message', 'Cupom inválido, expirado ou sem usos disponíveis.',
                'subtotal', round(v_subtotal, 2),
                'promotion_discount', round(v_promo_discount, 2),
                'coupon_discount', 0,
                'total', round(v_subtotal - v_promo_discount, 2)
            );
        end if;

        v_coupon_discount := round(v_coupon_base * v_coupon.discount_percent / 100, 2);
    end if;

    return jsonb_build_object(
        'valid', v_coupon_code = '' or found,
        'message', case
            when v_coupon_code = '' then ''
            when found then 'Cupom aplicado aos produtos fora de promoção.'
            else 'Cupom inválido, expirado ou sem usos disponíveis.'
        end,
        'coupon_code', nullif(v_coupon_code, ''),
        'subtotal', round(v_subtotal, 2),
        'promotion_discount', round(v_promo_discount, 2),
        'coupon_discount', v_coupon_discount,
        'total', round(v_subtotal - v_promo_discount - v_coupon_discount, 2)
    );
end;
$$;

revoke all on function public.preview_barberflow_order(jsonb, text) from public;
grant execute on function public.preview_barberflow_order(jsonb, text) to anon, authenticated;

create or replace function public.create_barberflow_order(
    p_customer_name text,
    p_items jsonb,
    p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_item record;
    v_product public.products%rowtype;
    v_quantity integer;
    v_coupon public.store_coupons%rowtype;
    v_coupon_code text := upper(trim(coalesce(p_coupon_code, '')));
    v_subtotal numeric(10, 2) := 0;
    v_promo_discount numeric(10, 2) := 0;
    v_coupon_discount numeric(10, 2) := 0;
    v_coupon_base numeric(10, 2) := 0;
    v_total numeric(10, 2) := 0;
    v_unit_price numeric(10, 2);
    v_line_promo_discount numeric(10, 2);
    v_is_promoted boolean;
    v_items jsonb := '[]'::jsonb;
    v_order_id uuid;
    v_order_code text;
begin
    if char_length(trim(coalesce(p_customer_name, ''))) not between 1 and 120 then
        raise exception 'Informe um nome com até 120 caracteres.';
    end if;
    if p_items is null or jsonb_typeof(p_items) <> 'array' then
        raise exception 'Os itens do pedido são inválidos.';
    end if;
    if jsonb_array_length(p_items) not between 1 and 20 then
        raise exception 'Os itens do pedido são inválidos.';
    end if;
    if exists (
        select 1
        from jsonb_array_elements(p_items) as entry(value)
        where jsonb_typeof(entry.value) <> 'object'
            or coalesce(entry.value ->> 'product_id', '') = ''
            or coalesce(entry.value ->> 'quantity', '') !~ '^[1-9][0-9]{0,2}$'
    ) then
        raise exception 'Os itens ou quantidades do pedido são inválidos.';
    end if;

    if v_coupon_code <> '' then
        select * into v_coupon
        from public.store_coupons
        where code = v_coupon_code
            and active
            and (starts_at is null or starts_at <= now())
            and (expires_at is null or expires_at > now())
            and (usage_limit is null or usage_count < usage_limit)
        for update;
        if not found then
            raise exception 'Cupom inválido, expirado ou sem usos disponíveis.';
        end if;
    end if;

    for v_item in
        select
            (entry.value ->> 'product_id')::uuid as product_id,
            sum((entry.value ->> 'quantity')::integer)::integer as quantity
        from jsonb_array_elements(p_items) as entry(value)
        group by (entry.value ->> 'product_id')::uuid
    loop
        v_quantity := v_item.quantity;
        if v_quantity > 99 then
            raise exception 'A quantidade máxima por produto é 99.';
        end if;

        update public.products
        set stock = stock - v_quantity
        where id = v_item.product_id
            and status = 'active'
            and stock >= v_quantity
        returning * into v_product;
        if not found then
            raise exception 'Um produto não está mais disponível na quantidade solicitada.';
        end if;

        v_is_promoted := v_product.promotion_percent is not null
            and (v_product.promotion_starts_at is null or v_product.promotion_starts_at <= now())
            and (v_product.promotion_ends_at is null or v_product.promotion_ends_at > now());
        v_unit_price := case
            when v_is_promoted
                then greatest(0.01, round(v_product.price * (1 - v_product.promotion_percent / 100), 2))
            else v_product.price
        end;
        v_line_promo_discount := case
            when v_is_promoted then (v_product.price - v_unit_price) * v_quantity
            else 0
        end;

        v_subtotal := v_subtotal + v_product.price * v_quantity;
        v_promo_discount := v_promo_discount + v_line_promo_discount;
        if not v_is_promoted then
            v_coupon_base := v_coupon_base + v_unit_price * v_quantity;
        end if;

        v_items := v_items || jsonb_build_array(jsonb_build_object(
            'id', v_product.id,
            'nome', v_product.name,
            'preco_original', v_product.price,
            'preco', v_unit_price,
            'quantidade', v_quantity,
            'desconto_promocional', v_line_promo_discount,
            'imagem', v_product.image_url
        ));
    end loop;

    if v_coupon_code <> '' then
        v_coupon_discount := round(v_coupon_base * v_coupon.discount_percent / 100, 2);
        update public.store_coupons
        set usage_count = usage_count + 1
        where code = v_coupon.code;
    end if;

    v_total := round(v_subtotal - v_promo_discount - v_coupon_discount, 2);
    v_order_code := 'PED-'
        || to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDD')
        || '-'
        || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    insert into public.orders (
        order_code, customer_name, items, total, coupon_code, discount_amount
    )
    values (
        v_order_code,
        trim(p_customer_name),
        v_items,
        v_total,
        nullif(v_coupon_code, ''),
        round(v_promo_discount + v_coupon_discount, 2)
    )
    returning id into v_order_id;

    return jsonb_build_object(
        'id', v_order_id,
        'order_code', v_order_code,
        'total', v_total,
        'subtotal', round(v_subtotal, 2),
        'promotion_discount', round(v_promo_discount, 2),
        'coupon_discount', v_coupon_discount,
        'coupon_code', nullif(v_coupon_code, ''),
        'items', v_items
    );
end;
$$;

revoke all on function public.create_barberflow_order(text, jsonb, text)
    from public, anon, authenticated;
grant execute on function public.create_barberflow_order(text, jsonb, text) to service_role;

create or replace function public.create_limited_barberflow_order(
    p_customer_name text,
    p_items jsonb,
    p_ip_hash text,
    p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_request_count smallint;
begin
    if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
        raise exception 'A identificação do cliente é inválida.';
    end if;

    delete from public.order_rate_limits
    where window_started_at < now() - interval '1 day';

    insert into public.order_rate_limits (ip_hash, window_started_at, request_count)
    values (p_ip_hash, now(), 1)
    on conflict (ip_hash) do update
    set window_started_at = case
            when public.order_rate_limits.window_started_at <= now() - interval '15 minutes'
                then now()
            else public.order_rate_limits.window_started_at
        end,
        request_count = case
            when public.order_rate_limits.window_started_at <= now() - interval '15 minutes'
                then 1
            else least(public.order_rate_limits.request_count + 1, 4)
        end
    returning request_count into v_request_count;

    if v_request_count > 3 then
        raise exception using
            errcode = 'P4290',
            message = 'Limite de pedidos atingido. Aguarde antes de tentar novamente.';
    end if;

    return public.create_barberflow_order(p_customer_name, p_items, p_coupon_code);
end;
$$;

revoke all on function public.create_limited_barberflow_order(text, jsonb, text, text)
    from public, anon, authenticated;
grant execute on function public.create_limited_barberflow_order(text, jsonb, text, text)
    to service_role;
