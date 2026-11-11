# BarberFlow

Loja pública e painel administrativo BarberFlow.

## Links

- Loja dos clientes: raiz do site, por exemplo `https://seudominio.com/`.
- Acesso do responsável: `https://seudominio.com/painel/login.html`.

Os dois endereços podem usar domínios diferentes: ambos apontam para o mesmo projeto Supabase. O painel exige usuário autenticado e cadastrado na tabela `admin_users`.

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

6. Configure a URL pública e as URLs de redirecionamento em **Authentication → URL Configuration** para os domínios usados. Se houver restrição de origens no projeto, permita também esses domínios.
7. Publique a raiz do projeto em um host de site estático. Compartilhe a raiz com clientes e `/painel/login.html` somente com o responsável.
8. Acesse o painel, entre com a conta autorizada e cadastre os produtos.

> A chave `anon`/`publishable` é pública e pode ficar no código do navegador; a segurança depende das políticas RLS instaladas pelo SQL. Nunca coloque a chave `service_role` ou outra chave secreta em arquivos publicados.

## Dados e pedidos

- Produtos, estoque e pedidos são compartilhados pelo Supabase entre a loja e o painel. A atualização de produtos e pedidos é transmitida em tempo real.
- O pedido e a baixa do estoque são processados juntos pela função `create_barberflow_order`; preço e disponibilidade são conferidos no banco, não no navegador do cliente. Para pedidos da loja publicada, essa rotina é chamada pela Edge Function `create-order` somente depois da verificação Turnstile.
- O checkout continua encaminhando o cliente para o WhatsApp para combinar o pagamento. O valor exibido no painel representa pedidos registrados, não necessariamente pagamentos recebidos.
- O checkout remoto exige que o Turnstile e a Edge Function estejam configurados; sem a chave pública do widget, os pedidos ficam bloqueados em vez de aceitar pedidos sem verificação.
- Produtos que existiam apenas no `localStorage` antes de configurar o Supabase não são migrados automaticamente. Cadastre-os novamente pelo painel ou exporte os dados antigos antes da troca.
- Para desenvolver sem configuração em `localhost` ou abrindo os arquivos localmente, a loja ainda lê os dados locais antigos. Em outros domínios, ela exige configuração do Supabase em vez de aparentar estar conectada. O painel administrativo não libera o acesso até que o Supabase esteja configurado e o responsável autenticado.

## Ativar proteção Turnstile no checkout

1. Na Cloudflare, crie um widget Turnstile com os hostnames exatos da loja. Copie a **Site Key** para `turnstileSiteKey` em [`supabase-config.js`](./supabase-config.js). A Site Key é pública; a Secret Key não deve ser colocada no código nem enviada pelo chat.
2. No terminal, entre na pasta do projeto, faça login e vincule o CLI ao projeto Supabase. Depois cadastre os segredos e listas permitidas (substitua os exemplos pelos domínios reais):

   ```powershell
   supabase login
   supabase link --project-ref volunftzrufaqsnazmwq
   supabase secrets set TURNSTILE_SECRET_KEY="SUA_SECRET_KEY" ALLOWED_ORIGINS="https://seudominio.com,https://www.seudominio.com" TURNSTILE_ALLOWED_HOSTNAMES="seudominio.com,www.seudominio.com"
   ```

   `ALLOWED_ORIGINS` recebe origens completas (protocolo e domínio); `TURNSTILE_ALLOWED_HOSTNAMES` recebe apenas hostnames. O Supabase fornece `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` à Edge Function automaticamente. Nunca publique nem compartilhe a chave `service_role`.
3. Publique a função:

   ```powershell
   supabase functions deploy create-order
   ```

4. Com a função e as variáveis configuradas, publique o site com a Site Key e, em seguida, execute uma única vez o SQL de [`supabase/migrations/20261111_secure_order_rpc.sql`](./supabase/migrations/20261111_secure_order_rpc.sql) no **SQL Editor**. Faça isso somente depois da implantação: a migração remove a permissão pública direta à rotina e, antes dela, ainda é possível contornar o CAPTCHA chamando a rotina diretamente.
5. Teste o checkout pela loja. Não execute novamente `supabase/schema.sql` para ativar o Turnstile.
