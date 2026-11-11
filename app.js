/* =========================================================
   BARBERFLOW - APP.JS
   ========================================================= */

const STORAGE_KEY = "barberflow_produtos";
const PEDIDOS_STORAGE_KEY = "barberflow_pedidos";
const TELEFONE_LOJA = "5582994114133";
const CATEGORIAS_LABELS = {
    pomadas: "Pomadas",
    shampoo: "Shampoo e cabelo",
    barba: "Barba",
    acessorios: "Acessórios",
    outros: "Outros"
};
let produtos = [];
let carrinho = [];
let categoriaSelecionada = "todas";
let erroProdutos = "";
let turnstileWidgetId = null;
let turnstileToken = "";
let turnstileError = "";
let turnstileLoadHandler = null;


/* =========================================================
   ELEMENTOS
   ========================================================= */

const productsContainer =
    document.querySelector(".products-container");

const cartButton =
    document.querySelector(".cart-button");

const cartOverlay =
    document.querySelector(".cart-overlay");

const closeCartButton =
    document.querySelector(".close-cart");

const cartItemsContainer =
    document.querySelector(".cart-items");

const cartCount =
    document.querySelector(".cart-count");

const cartTotal =
    document.querySelector("#cart-total");

const checkoutButton =
    document.querySelector(".checkout-button");

const categoryFilters =
    document.querySelector("#category-filters");

const productsResultCount =
    document.querySelector("#products-result-count");

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await carregarProdutos();
    } catch (erro) {
        erroProdutos = "Não foi possível carregar os produtos. Atualize a página ou tente novamente.";
        console.error("Erro ao carregar produtos:", erro);
    }

    renderizarProdutos();
    renderizarCarrinho();
    configurarEventos();
    configurarFiltrosCategoria();
    configurarCaptcha();

    if (window.barberflow && window.barberflow.isConfigured) {
        window.barberflow.client
            .channel("store-products")
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "products"
            }, async () => {
                try {
                    await carregarProdutos();
                    renderizarProdutos();
                    renderizarCarrinho();
                } catch (erro) {
                    erroProdutos = "Não foi possível atualizar o catálogo. Tente recarregar a página.";
                    console.error("Erro ao sincronizar produtos:", erro);
                    renderizarProdutos();
                }
            })
            .subscribe();
    }
});


/* =========================================================
   PRODUTOS
   ========================================================= */

async function carregarProdutos() {
    erroProdutos = "";

    if (window.barberflow && window.barberflow.error) {
        throw new Error(window.barberflow.error);
    }

    if (window.barberflow && window.barberflow.isConfigured) {
        const { data, error } = await window.barberflow.client
            .from("products")
            .select("*")
            .eq("status", "active")
            .gt("stock", 0)
            .order("created_at", { ascending: false });

        if (error) throw error;

        produtos = data.map(produto => ({
            id: produto.id,
            nome: produto.name,
            categoria: produto.category,
            preco: Number(produto.price),
            estoque: Number(produto.stock),
            status: produto.status,
            imagem: produto.image_url || "",
            descricao: produto.description || ""
        }));
        return;
    }

    const localDevelopment = window.location.protocol === "file:"
        || ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (!localDevelopment) {
        throw new Error("Configure a conexão Supabase antes de publicar a loja.");
    }

    try {

        const produtosSalvos =
            localStorage.getItem(STORAGE_KEY);

        if (!produtosSalvos) {

            produtos = [];

            return;
        }

        const dados =
            JSON.parse(produtosSalvos);

        produtos =
            Array.isArray(dados)
                ? dados
                : [];

    } catch (erro) {

        console.error(
            "Erro ao carregar produtos:",
            erro
        );
        produtos = [];
        throw erro;
    }
}


/* =========================================================
   RENDERIZAR PRODUTOS
   ========================================================= */

function renderizarProdutos() {

    if (!productsContainer) {
        return;
    }

    const produtosAtivos =
        produtos.filter(produto =>
            produto.status === "active" &&
            Number(produto.estoque) > 0
        );

    renderizarFiltrosCategoria(produtosAtivos);

    const produtosFiltrados =
        categoriaSelecionada === "todas"
            ? produtosAtivos
            : produtosAtivos.filter(produto =>
                normalizarCategoria(produto.categoria) === categoriaSelecionada
            );

    if (productsResultCount) {
        productsResultCount.textContent =
            `${produtosFiltrados.length} ${
                produtosFiltrados.length === 1
                    ? "produto"
                    : "produtos"
            }`;
    }

    if (produtosFiltrados.length === 0) {

        productsContainer.innerHTML = `
            <div class="products-empty">
                <i class="fa-solid fa-box-open" aria-hidden="true"></i>
                <p>${
                    erroProdutos
                        ? escaparHTML(erroProdutos)
                        :
                    produtosAtivos.length === 0
                        ? "Estamos preparando nossa seleção de produtos para você."
                        : "Nenhum produto encontrado nesta categoria."
                }</p>
            </div>
        `;

        return;
    }


    productsContainer.innerHTML =
        produtosFiltrados
            .map(produto => criarCardProduto(produto))
            .join("");

    configurarFallbacksDeImagem(productsContainer);


    document
        .querySelectorAll(".add-product")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        button.dataset.id;

                    adicionarAoCarrinho(id);

                }
            );

        });

}


function configurarFiltrosCategoria() {

    if (categoryFilters) {

        categoryFilters.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest("[data-category-filter]");

                if (!button) {
                    return;
                }

                categoriaSelecionada =
                    button.dataset.categoryFilter;

                renderizarProdutos();

            }
        );

    }

    document
        .querySelectorAll(".category-card[data-category]")
        .forEach(link => {

            link.addEventListener(
                "click",
                () => {

                    categoriaSelecionada =
                        normalizarCategoria(link.dataset.category);

                    renderizarProdutos();

                }
            );

        });

}


function renderizarFiltrosCategoria(produtosDisponiveis) {

    if (!categoryFilters) {
        return;
    }

    const categorias =
        [...new Set(
            produtosDisponiveis.map(produto =>
                normalizarCategoria(produto.categoria)
            ).filter(Boolean)
        )];

    if (
        categoriaSelecionada !== "todas" &&
        !categorias.includes(categoriaSelecionada)
    ) {
        categoriaSelecionada = "todas";
    }

    categoryFilters.innerHTML = [
        criarBotaoFiltro("todas", "Todas"),
        ...categorias.map(categoria =>
            criarBotaoFiltro(
                categoria,
                CATEGORIAS_LABELS[categoria] || categoria
            )
        )
    ].join("");

}


function criarBotaoFiltro(categoria, rotulo) {

    const selecionado =
        categoriaSelecionada === categoria;

    return `
        <button
            class="category-filter${selecionado ? " active" : ""}"
            type="button"
            data-category-filter="${escaparHTML(categoria)}"
            aria-pressed="${selecionado}"
        >
            ${escaparHTML(rotulo)}
        </button>
    `;

}


function normalizarCategoria(categoria) {

    return String(categoria || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");

}


/* =========================================================
   CARD DO PRODUTO
   ========================================================= */

function criarCardProduto(produto) {

    const preco =
        Number(produto.preco || 0);

    const imagem = String(produto.imagem || "").trim();

    const imagemMarkup = imagem
        ? `
            <img src="${escaparHTML(imagem)}" alt="${escaparHTML(produto.nome)}">
            <span class="image-placeholder" hidden aria-hidden="true">
                <i class="fa-solid fa-pump-soap"></i>
            </span>
        `
        : `
            <span class="image-placeholder" aria-hidden="true">
                <i class="fa-solid fa-pump-soap"></i>
            </span>
        `;

    return `
        <article class="product-card">

            <div class="product-image">
                ${imagemMarkup}
            </div>

            <div class="product-info">

                <h3>
                    ${escaparHTML(produto.nome)}
                </h3>

                <span class="product-category">
                    ${escaparHTML(
                        CATEGORIAS_LABELS[normalizarCategoria(produto.categoria)] ||
                        produto.categoria ||
                        "Barbearia"
                    )}
                </span>

                <p class="product-description">
                    ${escaparHTML(
                        produto.descricao || ""
                    )}
                </p>

                <div class="product-bottom">

                    <strong class="product-price">
                        ${formatarPreco(preco)}
                    </strong>

                    <button
                        type="button"
                        class="add-product"
                        data-id="${escaparHTML(
                            String(produto.id)
                        )}"
                    >
                        Adicionar
                    </button>

                </div>

            </div>

        </article>
    `;
}


/* =========================================================
   ADICIONAR AO CARRINHO
   ========================================================= */

function adicionarAoCarrinho(id) {

    const produto =
        produtos.find(
            item => String(item.id) === String(id)
        );

    if (!produto) {

        alert("Produto não encontrado.");

        return;
    }

    const estoque =
        Number(produto.estoque || 0);


    if (estoque <= 0) {

        alert("Este produto está sem estoque.");

        return;
    }


    const itemExistente =
        carrinho.find(
            item => String(item.id) === String(id)
        );


    if (itemExistente) {

        if (
            itemExistente.quantidade >= estoque
        ) {

            alert(
                "Você atingiu o limite disponível em estoque."
            );

            return;
        }

        itemExistente.quantidade++;

    } else {

        carrinho.push({

            id: produto.id,

            nome: produto.nome,

            preco: Number(produto.preco || 0),

            quantidade: 1,

            imagem: produto.imagem || ""

        });

    }


    renderizarCarrinho();

}


/* =========================================================
   RENDERIZAR CARRINHO
   ========================================================= */

function renderizarCarrinho() {

    if (!cartItemsContainer) {
        return;
    }


    if (carrinho.length === 0) {

        cartItemsContainer.innerHTML = `
            <div class="cart-empty">
                <p>Seu carrinho está vazio.</p>
            </div>
        `;

        atualizarResumoCarrinho();

        return;
    }


    cartItemsContainer.innerHTML =
        carrinho
            .map(item => criarItemCarrinho(item))
            .join("");

    configurarFallbacksDeImagem(cartItemsContainer);


    adicionarEventosCarrinho();

    atualizarResumoCarrinho();

}


function configurarFallbacksDeImagem(container) {

    container
        .querySelectorAll("img")
        .forEach(imagem => {

            imagem.addEventListener(
                "error",
                () => {

                    imagem.hidden = true;

                    const placeholder =
                        imagem.nextElementSibling;

                    if (placeholder) {
                        placeholder.hidden = false;
                    }

                },
                { once: true }
            );

        });

}


/* =========================================================
   ITEM DO CARRINHO
   ========================================================= */

function criarItemCarrinho(item) {

    const subtotal =
        Number(item.preco || 0) *
        Number(item.quantidade || 1);


    const imagem = String(item.imagem || "").trim();

    const imagemMarkup = imagem
        ? `
            <img src="${escaparHTML(imagem)}" alt="${escaparHTML(item.nome)}">
            <span class="image-placeholder" hidden aria-hidden="true">
                <i class="fa-solid fa-pump-soap"></i>
            </span>
        `
        : `
            <span class="image-placeholder" aria-hidden="true">
                <i class="fa-solid fa-pump-soap"></i>
            </span>
        `;


    return `
        <div
            class="cart-item"
            data-id="${escaparHTML(
                String(item.id)
            )}"
        >

            <div class="cart-item-image">
                ${imagemMarkup}
            </div>


            <div class="cart-item-info">

                <h4>
                    ${escaparHTML(item.nome)}
                </h4>

                <span>
                    ${formatarPreco(item.preco)}
                </span>


                <div class="cart-item-actions">

                    <button
                        type="button"
                        class="quantity-button decrease"
                        data-id="${escaparHTML(
                            String(item.id)
                        )}"
                    >
                        −
                    </button>


                    <span>
                        ${item.quantidade}
                    </span>


                    <button
                        type="button"
                        class="quantity-button increase"
                        data-id="${escaparHTML(
                            String(item.id)
                        )}"
                    >
                        +
                    </button>


                    <button
                        type="button"
                        class="remove-button"
                        data-id="${escaparHTML(
                            String(item.id)
                        )}"
                    >
                        Remover
                    </button>

                </div>

            </div>


            <strong>
                ${formatarPreco(subtotal)}
            </strong>

        </div>
    `;
}


/* =========================================================
   EVENTOS DO CARRINHO
   ========================================================= */

function adicionarEventosCarrinho() {


    document
        .querySelectorAll(".quantity-button.increase")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    aumentarQuantidade(
                        button.dataset.id
                    );

                }
            );

        });


    document
        .querySelectorAll(".quantity-button.decrease")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    diminuirQuantidade(
                        button.dataset.id
                    );

                }
            );

        });


    document
        .querySelectorAll(".remove-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    removerDoCarrinho(
                        button.dataset.id
                    );

                }
            );

        });

}


/* =========================================================
   AUMENTAR QUANTIDADE
   ========================================================= */

function aumentarQuantidade(id) {

    const item =
        carrinho.find(
            produto =>
                String(produto.id) === String(id)
        );

    if (!item) {
        return;
    }


    const produto =
        produtos.find(
            produto =>
                String(produto.id) === String(id)
        );


    if (!produto) {
        return;
    }


    const estoque =
        Number(produto.estoque || 0);


    if (item.quantidade >= estoque) {

        alert(
            "Não há mais unidades disponíveis em estoque."
        );

        return;
    }


    item.quantidade++;

    renderizarCarrinho();

}


/* =========================================================
   DIMINUIR QUANTIDADE
   ========================================================= */

function diminuirQuantidade(id) {

    const item =
        carrinho.find(
            produto =>
                String(produto.id) === String(id)
        );

    if (!item) {
        return;
    }


    if (item.quantidade <= 1) {

        removerDoCarrinho(id);

        return;
    }


    item.quantidade--;

    renderizarCarrinho();

}


/* =========================================================
   REMOVER DO CARRINHO
   ========================================================= */

function removerDoCarrinho(id) {

    carrinho =
        carrinho.filter(
            item =>
                String(item.id) !== String(id)
        );

    renderizarCarrinho();

}


/* =========================================================
   RESUMO DO CARRINHO
   ========================================================= */

function atualizarResumoCarrinho() {

    const quantidade =
        carrinho.reduce(
            (total, item) =>
                total +
                Number(item.quantidade || 0),
            0
        );


    const total =
        carrinho.reduce(
            (valor, item) =>
                valor +
                (
                    Number(item.preco || 0) *
                    Number(item.quantidade || 0)
                ),
            0
        );


    if (cartCount) {

        cartCount.textContent =
            quantidade;

    }


    if (cartTotal) {

        cartTotal.textContent =
            formatarPreco(total);

    }

}


/* =========================================================
   ABRIR CARRINHO
   ========================================================= */

function abrirCarrinho() {

    if (!cartOverlay) {
        return;
    }

    cartOverlay.classList.add("active");

    document.body.classList.add(
        "cart-open"
    );
    renderizarCaptcha();

}


function configurarCaptcha() {
    const widget = document.querySelector("#turnstile-widget");
    const message = document.querySelector("#turnstile-message");
    const config = window.BARBERFLOW_SUPABASE_CONFIG || {};
    const isRemoteStore = Boolean(window.barberflow && window.barberflow.isConfigured);

    if (!widget || !isRemoteStore) {
        return;
    }

    if (!config.turnstileSiteKey) {
        turnstileError = "A verificação de segurança ainda não foi configurada.";
        if (message) {
            message.textContent = turnstileError;
            message.hidden = false;
        }
        return;
    }

    if (message) {
        message.hidden = true;
    }

    turnstileLoadHandler = () => {
        turnstileLoadHandler = null;
        renderizarCaptcha();
    };

    if (window.turnstile) {
        renderizarCaptcha();
        return;
    }

    const script = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (script) {
        script.addEventListener("load", turnstileLoadHandler, { once: true });
        script.addEventListener("error", () => {
            turnstileError = "Não foi possível carregar a verificação de segurança. Verifique sua conexão e recarregue a página.";
            if (message) {
                message.textContent = turnstileError;
                message.hidden = false;
            }
        }, { once: true });
    }
}


function renderizarCaptcha() {
    const widget = document.querySelector("#turnstile-widget");
    const message = document.querySelector("#turnstile-message");
    const config = window.BARBERFLOW_SUPABASE_CONFIG || {};
    const isRemoteStore = Boolean(window.barberflow && window.barberflow.isConfigured);

    if (!widget || !isRemoteStore || !config.turnstileSiteKey) {
        return;
    }

    if (!window.turnstile) {
        return;
    }

    turnstileError = "";
    if (message) {
        message.hidden = true;
    }

    if (turnstileWidgetId !== null) {
        return;
    }

    try {
        turnstileWidgetId = window.turnstile.render(widget, {
            sitekey: config.turnstileSiteKey,
            action: "checkout",
            callback: token => {
                turnstileToken = token;
                turnstileError = "";
                if (message) {
                    message.hidden = true;
                }
            },
            "expired-callback": () => {
                turnstileToken = "";
                turnstileError = "A verificação expirou. Conclua-a novamente.";
                if (message) {
                    message.textContent = turnstileError;
                    message.hidden = false;
                }
            },
            "error-callback": () => {
                turnstileToken = "";
                turnstileError = "A verificação não foi concluída. Tente novamente.";
                if (message) {
                    message.textContent = turnstileError;
                    message.hidden = false;
                }
            }
        });
    } catch (erro) {
        console.error("Erro ao iniciar a verificação Turnstile:", erro);
        turnstileError = "Não foi possível iniciar a verificação de segurança.";
        if (message) {
            message.textContent = turnstileError;
            message.hidden = false;
        }
    }
}


function resetarCaptcha() {
    turnstileToken = "";
    if (turnstileWidgetId !== null && window.turnstile) {
        window.turnstile.reset(turnstileWidgetId);
    }
}


/* =========================================================
   FECHAR CARRINHO
   ========================================================= */

function fecharCarrinho() {

    if (!cartOverlay) {
        return;
    }

    cartOverlay.classList.remove("active");

    document.body.classList.remove(
        "cart-open"
    );

}


/* =========================================================
   CONFIGURAR EVENTOS
   ========================================================= */

function configurarEventos() {


    if (cartButton) {

        cartButton.addEventListener(
            "click",
            abrirCarrinho
        );

    }


    if (closeCartButton) {

        closeCartButton.addEventListener(
            "click",
            fecharCarrinho
        );

    }


    if (cartOverlay) {

        cartOverlay.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    cartOverlay
                ) {

                    fecharCarrinho();

                }

            }
        );

    }


    if (checkoutButton) {

        checkoutButton.addEventListener(
            "click",
            finalizarPedido
        );

    }


    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {

                fecharCarrinho();

            }

        }
    );

}


/* =========================================================
   FINALIZAR PEDIDO
   ========================================================= */

async function finalizarPedido() {
    if (carrinho.length === 0) {
        alert("Seu carrinho está vazio.");
        return;
    }

    if (!/^\d{10,15}$/.test(TELEFONE_LOJA)) {
        alert("O WhatsApp da barbearia ainda não foi configurado.");
        return;
    }

    const pedidoRemoto = Boolean(window.barberflow && window.barberflow.isConfigured);
    if (pedidoRemoto && !turnstileToken) {
        const message = document.querySelector("#turnstile-message");
        if (message) {
            message.textContent = turnstileError
                || "Conclua a verificação de segurança antes de continuar.";
            message.hidden = false;
        }
        abrirCarrinho();
        return;
    }

    const nomeCliente = prompt("Digite seu nome:");
    if (!nomeCliente || !nomeCliente.trim()) {
        alert("Digite seu nome para continuar.");
        return;
    }

    const itensSolicitados = carrinho.map(item => ({
        id: item.id,
        nome: item.nome,
        preco: Number(item.preco || 0),
        quantidade: Number(item.quantidade || 1),
        imagem: item.imagem || ""
    }));
    const originalLabel = checkoutButton ? checkoutButton.innerHTML : "";

    if (checkoutButton) {
        checkoutButton.disabled = true;
        checkoutButton.textContent = "Registrando pedido...";
    }
    if (cartItemsContainer) {
        cartItemsContainer.querySelectorAll("button").forEach(button => {
            button.disabled = true;
        });
    }

    let pedidoId;
    let total;
    let itensPedido;

    try {
        if (pedidoRemoto) {
            const { data, error } = await window.barberflow.client.functions.invoke(
                "create-order",
                {
                    body: {
                        customer_name: nomeCliente.trim(),
                        captcha_token: turnstileToken,
                        items: itensSolicitados.map(item => ({
                            product_id: item.id,
                            quantity: item.quantidade
                        }))
                    }
                }
            );
            if (error) throw error;

            pedidoId = data.order_code;
            total = Number(data.total);
            itensPedido = data.items.map(item => ({
                nome: item.nome,
                preco: Number(item.preco),
                quantidade: Number(item.quantidade)
            }));
            try {
                await carregarProdutos();
            } catch (erroAtualizacao) {
                console.error("Pedido registrado, mas não foi possível atualizar o catálogo:", erroAtualizacao);
            }
        } else {
            pedidoId = gerarIdPedido();
            total = itensSolicitados.reduce(
                (sum, item) => sum + item.preco * item.quantidade,
                0
            );
            itensPedido = itensSolicitados;

            let pedidos = [];
            try {
                const pedidosSalvos = localStorage.getItem(PEDIDOS_STORAGE_KEY);
                if (pedidosSalvos) {
                    const dados = JSON.parse(pedidosSalvos);
                    if (Array.isArray(dados)) pedidos = dados;
                }
            } catch (erro) {
                console.error("Erro ao carregar pedidos:", erro);
                throw new Error("Não foi possível carregar os pedidos salvos neste navegador.");
            }

            pedidos.push({
                id: pedidoId,
                cliente: { nome: nomeCliente.trim() },
                itens: itensSolicitados,
                total,
                status: "pending",
                criadoEm: new Date().toISOString()
            });
            localStorage.setItem(PEDIDOS_STORAGE_KEY, JSON.stringify(pedidos));

            carrinho.forEach(item => {
                const produto = produtos.find(
                    current => String(current.id) === String(item.id)
                );
                if (!produto) return;
                produto.estoque = Math.max(
                    0,
                    Number(produto.estoque || 0) - Number(item.quantidade || 0)
                );
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(produtos));
        }
    } catch (erro) {
        console.error("Erro ao registrar pedido:", erro);
        if (pedidoRemoto) {
            try {
                await carregarProdutos();
                renderizarProdutos();
            } catch (erroAtualizacao) {
                console.error("Erro ao atualizar o catálogo após a falha no pedido:", erroAtualizacao);
            }
        }
        alert(
            erro.message && /dispon[ií]vel|estoque/i.test(erro.message)
                ? "Um produto acabou de ficar indisponível ou não há estoque suficiente. Atualizamos a loja; revise sua sacola."
                : "Não foi possível registrar o pedido. Tente novamente."
        );
        if (checkoutButton) {
            checkoutButton.disabled = false;
            checkoutButton.innerHTML = originalLabel;
        }
        resetarCaptcha();
        renderizarCarrinho();
        return;
    }

    const mensagem = [
        "Olá! Gostaria de fazer um pedido.",
        "",
        `*Pedido:* ${pedidoId}`,
        `*Cliente:* ${nomeCliente.trim()}`,
        "",
        "*Produtos:*",
        ...itensPedido.map(item => {
            const subtotal = Number(item.preco) * Number(item.quantidade);
            return `• ${item.nome} - ${item.quantidade}x - ${formatarPreco(subtotal)}`;
        }),
        "",
        `*Total:* ${formatarPreco(total)}`
    ].join("\n");

    carrinho = [];
    resetarCaptcha();
    renderizarCarrinho();
    renderizarProdutos();
    fecharCarrinho();

    const url = `https://wa.me/${TELEFONE_LOJA}?text=${encodeURIComponent(mensagem)}`;
    window.location.href = url;
}


/* =========================================================
   GERAR ID DO PEDIDO
   ========================================================= */

function gerarIdPedido() {

    const agora =
        new Date();


    const ano =
        agora.getFullYear();


    const mes =
        String(
            agora.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const dia =
        String(
            agora.getDate()
        ).padStart(
            2,
            "0"
        );


    const numero =
        String(
            Date.now()
        ).slice(-6);


    return (
        `PED-${ano}${mes}${dia}-${numero}`
    );

}


/* =========================================================
   FORMATAR PREÇO
   ========================================================= */

function formatarPreco(valor) {

    return Number(valor || 0)
        .toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );

}


/* =========================================================
   ESCAPAR HTML
   ========================================================= */

function escaparHTML(valor) {

    return String(valor ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   SINCRONIZAÇÃO COM O ADMIN
   ========================================================= */

window.addEventListener(
    "storage",
    async event => {

        if (
            (!window.barberflow || !window.barberflow.isConfigured) &&
            event.key ===
            STORAGE_KEY
        ) {

            try {
                await carregarProdutos();
                renderizarProdutos();
                renderizarCarrinho();
            } catch (erro) {
                erroProdutos = "Não foi possível atualizar os produtos. Atualize a página ou tente novamente.";
                console.error("Erro ao sincronizar produtos locais:", erro);
                renderizarProdutos();
            }

        }

    }
);


/* =========================================================
   FIM DO APP.JS
   ========================================================= */