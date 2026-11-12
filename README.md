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
- O checkout continua encaminhando o cliente para o WhatsApp para combinar o pagamento. O valor exibido no painel representa pedidos registrados, não necessariamente pagamentos recebidos.
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
3. Publique a Edge Function atualizada:

   ```powershell
   supabase functions deploy create-order
   ```

4. Publique o site e teste o checkout: um pedido deve ser registrado, o estoque deve ser atualizado e o WhatsApp deve abrir com os dados do pedido.
