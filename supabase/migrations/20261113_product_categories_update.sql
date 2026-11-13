alter table public.products
    drop constraint if exists products_category_check;

update public.products
set category = 'cuidados-capilares'
where category in ('shampoo', 'shampoo-e-cabelo');

update public.products
set category = 'cuidados-com-barba'
where category in ('barba', 'cuidados-com-a-barba');

update public.products
set category = 'cuidados-capilares'
where category = 'acessorios';

update public.products
set category = 'cuidados-com-barba'
where category = 'outros';

update public.products
set category = 'pomadas'
where category in ('pomadas-e-finalizadores', 'finalizadores');

alter table public.products
    add constraint products_category_check
    check (category in ('pomadas', 'cuidados-capilares', 'cuidados-com-barba'));
