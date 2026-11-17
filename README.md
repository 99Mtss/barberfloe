# BarberFlow

Loja pública e painel administrativo BarberFlow.

## Links

- Loja dos clientes: https://barber-flow2.netlify.app/
- Acesso do responsável: https://barber-flow2.netlify.app/painel/login.html

Os dois endereços usam o mesmo domínio e apontam para o mesmo projeto Supabase. O painel exige usuário autenticado e cadastrado na tabela `admin_users`.

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. No **SQL Editor**, execute o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql) somente se ainda não tiver configurado o banco. O script cria as tabelas, políticas RLS, a rotina segura de criação de pedidos e a publicação Realtime para produtos e pedidos. Se o banco já está configurado, não execute esse schema novamente.
3. Em **Authentication → Users**, crie o usuário do responsável e confirme o e-mail. Não habilite cadastro público para visitantes.
4. Copie o UUID desse usuário e cadastre a permissão pelo SQL Editor:

   ```sql
   insert into public.admin_users (user_id)
   values ('UUID-DO-USUARIO-AUTORIZADO');
   ```

5. A **Project URL** e a chave pública **publishable** deste projeto já estão preenchidas em [`supabase-config.js`](./supabase-config.js). Se trocar de projeto, atualize esses dois valores.

6. Em **Authentication → URL Configuration**, configure `https://barber-flow2.netlify.app` como **Site URL** e adicione `https://barber-flow2.netlify.app/**` às **Redirect URLs**.
7. Publique a raiz do projeto em um host de site estático. Compartilhe a raiz com clientes e `/painel/login.html` somente com o responsável.
8. Acesse o painel, entre com a conta autorizada e cadastre os produtos.

> A chave `anon`/`publishable` é pública e pode ficar no código do navegador; a segurança depende das políticas RLS instaladas pelo SQL. Nunca coloque a chave `service_role` ou outra chave secreta em arquivos publicados.

## Dados e pedidos

- Produtos, estoque e pedidos são compartilhados pelo Supabase entre a loja e o painel. A atualização de produtos e pedidos é transmitida em tempo real.
- O pedido e a baixa do estoque são processados juntos pela função `create_barberflow_order`; preço e disponibilidade são conferidos no banco, não no navegador do cliente. A loja chama a Edge Function `create-order`, que limita cada IP a 3 pedidos a cada 15 minutos. O IP é usado somente em hash para aplicar o limite.
- Ao cancelar um pedido no painel, os itens retornam ao estoque. Se um pedido cancelado for reativado, o estoque é reservado novamente; a reativação falha se não houver quantidade suficiente.
- O checkout continua encaminhando o cliente para o WhatsApp para combinar o pagamento. O indicador "Valor em pedidos no mês" soma apenas pedidos confirmados, não necessariamente pagamentos recebidos.
- O checkout não exige conta ou configuração na Cloudflare. O limite é compartilhado por pessoas que usam o mesmo IP, como clientes na mesma rede.
- Produtos que existiam apenas no `localStorage` antes de configurar o Supabase não são migrados automaticamente. Cadastre-os novamente pelo painel ou exporte os dados antigos antes da troca.
- Para desenvolver sem configuração em `localhost` ou abrindo os arquivos localmente, a loja ainda lê os dados locais antigos. Em outros domínios, ela exige configuração do Supabase em vez de aparentar estar conectada. O painel administrativo não libera o acesso até que o Supabase esteja configurado e o responsável autenticado.

## Publicar o checkout

1. No terminal, entre na pasta do projeto, faça login e vincule o CLI ao projeto Supabase. Configure as origens permitidas usando os domínios reais:

   ```powershell
   supabase login
   supabase link --project-ref volunftzrufaqsnazmwq
   supabase secrets set ALLOWED_ORIGINS="https://barber-flow2.netlify.app"
   ```

   A loja e o painel usam a mesma origem, então basta cadastrá-la uma vez. `ALLOWED_ORIGINS` recebe a origem completa (protocolo e domínio). O Supabase fornece `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` à Edge Function automaticamente. Nunca publique nem compartilhe a chave `service_role`.
2. No **SQL Editor**, execute uma vez [`supabase/migrations/20261112_order_rate_limit.sql`](./supabase/migrations/20261112_order_rate_limit.sql). Ela bloqueia chamadas públicas diretas à rotina de pedidos e cria o limite usado pela Edge Function. Não execute novamente `supabase/schema.sql` em um banco já configurado.
3. No **SQL Editor**, execute uma vez [`supabase/migrations/20261113_store_promotions_coupons_settings.sql`](./supabase/migrations/20261113_store_promotions_coupons_settings.sql). Ela adiciona promoções por produto, cupons, foto de perfil da loja e as rotinas de prévia e criação de pedidos com descontos. Execute depois da migration de limite de pedidos.
4. No **SQL Editor**, execute uma vez [`supabase/migrations/20261117_order_cancellation_stock.sql`](./supabase/migrations/20261117_order_cancellation_stock.sql) para devolver itens ao estoque quando um pedido for cancelado.
5. No **SQL Editor**, execute uma vez [`supabase/migrations/20261117_store_hero_banner.sql`](./supabase/migrations/20261117_store_hero_banner.sql) para habilitar o banner personalizado do desktop.
6. Publique a Edge Function atualizada:

   ```powershell
   supabase functions deploy create-order
   ```

7. Publique o site e teste o checkout: um pedido deve ser registrado, o estoque deve ser atualizado e o WhatsApp deve abrir com os dados e descontos calculados no servidor.

## Configuração da loja

1. Depois de aplicar a migration de cupons e promoções, abra **Configuração** no painel para criar, editar, ativar/desativar ou excluir cupons percentuais.
2. Na mesma página, configure promoções percentuais e o período opcional de cada produto. Os cupons não são aplicados aos produtos em promoção.
3. A seção **Barbearia** reúne a galeria de até cinco fotos, e **Foto de perfil** permite enviar, pré-visualizar e remover a imagem. A foto de perfil aparece no destaque visual do topo da loja.
4. Em **Banner do desktop**, envie uma imagem JPG, PNG ou WebP de até 5 MB, visualize a prévia e salve. O banner substitui a imagem padrão no topo da versão desktop; o texto e os botões permanecem. Use **Restaurar banner padrão** para remover a imagem personalizada.

## Galeria da barbearia

1. No **SQL Editor** do Supabase, execute uma vez [`supabase/migrations/20261113_barbershop_gallery.sql`](./supabase/migrations/20261113_barbershop_gallery.sql). A migration cria a galeria, o bucket público de imagens e as políticas que permitem leitura pública e gerenciamento somente pelo responsável autorizado.
2. Execute também [`supabase/migrations/20261113_barbershop_gallery_limit.sql`](./supabase/migrations/20261113_barbershop_gallery_limit.sql) para impor o limite de cinco fotos no banco.
3. No painel, abra **Configuração → Barbearia**, envie até cinco fotos do espaço e, se quiser, informe uma descrição para cada imagem. Cada arquivo pode ter até 5 MB e ser JPG, PNG, WebP ou GIF.
4. As fotos publicadas aparecem automaticamente na seção da barbearia na loja. Ao clicar em uma foto, ela abre ampliada com sua descrição. A localização abre o ponto compartilhado no Google Maps.
