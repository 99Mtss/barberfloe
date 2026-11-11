create table if not exists public.admin_users (
    user_id uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(trim(name)) between 1 and 100),
    category text not null check (category in ('pomadas', 'shampoo', 'barba', 'acessorios', 'outros')),
    price numeric(10, 2) not null check (price > 0),
    stock integer not null default 0 check (stock >= 0),
    status text not null default 'active' check (status in ('active', 'inactive')),
    image_url text not null default '',
    description text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    order_code text not null unique,
    customer_name text not null check (char_length(trim(customer_name)) between 1 and 120),
    items jsonb not null check (jsonb_typeof(items) = 'array'),
    total numeric(10, 2) not null check (total > 0),
    status text not null default 'pending'
        check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
    created_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.admin_users to authenticated;
grant select, update on public.orders to authenticated;

create index if not exists products_public_catalog_idx
    on public.products (category, name)
    where status = 'active' and stock > 0;

create index if not exists orders_created_at_idx
    on public.orders (created_at desc);

create or replace function public.is_barberflow_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    );
$$;

revoke all on function public.is_barberflow_admin() from public;
grant execute on function public.is_barberflow_admin() to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
    before update on public.products
    for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Admins can read their own access" on public.admin_users;
create policy "Admins can read their own access"
    on public.admin_users for select to authenticated
    using (user_id = (select auth.uid()));

drop policy if exists "Public can read available products" on public.products;
create policy "Public can read available products"
    on public.products for select to anon, authenticated
    using (status = 'active' and stock > 0);

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
    on public.products for all to authenticated
    using ((select public.is_barberflow_admin()))
    with check ((select public.is_barberflow_admin()));

drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders"
    on public.orders for select to authenticated
    using ((select public.is_barberflow_admin()));

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
    on public.orders for update to authenticated
    using ((select public.is_barberflow_admin()))
    with check ((select public.is_barberflow_admin()));

create or replace function public.create_barberflow_order(
    p_customer_name text,
    p_items jsonb
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
    v_total numeric(10, 2) := 0;
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
        raise exception 'O pedido deve conter entre 1 e 20 produtos.';
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

        update public.products
        set stock = stock - v_quantity
        where id = v_item.product_id
            and status = 'active'
            and stock >= v_quantity
        returning * into v_product;

        if not found then
            raise exception 'Um produto não está mais disponível na quantidade solicitada.';
        end if;

        v_total := v_total + v_product.price * v_quantity;
        v_items := v_items || jsonb_build_array(jsonb_build_object(
            'id', v_product.id,
            'nome', v_product.name,
            'preco', v_product.price,
            'quantidade', v_quantity,
            'imagem', v_product.image_url
        ));
    end loop;

    v_order_code := 'PED-'
        || to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDD')
        || '-'
        || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    insert into public.orders (order_code, customer_name, items, total)
    values (v_order_code, trim(p_customer_name), v_items, v_total)
    returning id into v_order_id;

    return jsonb_build_object(
        'id', v_order_id,
        'order_code', v_order_code,
        'total', v_total,
        'items', v_items
    );
end;
$$;

revoke all on function public.create_barberflow_order(text, jsonb) from public;
grant execute on function public.create_barberflow_order(text, jsonb) to anon, authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = 'products'
    ) then
        alter publication supabase_realtime add table public.products;
    end if;
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = 'orders'
    ) then
        alter publication supabase_realtime add table public.orders;
    end if;
end;
$$;
