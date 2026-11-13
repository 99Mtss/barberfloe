/* =========================================================
   BARBERFLOW - APP.JS
   ========================================================= */

const STORAGE_KEY = "barberflow_produtos";
const PEDIDOS_STORAGE_KEY = "barberflow_pedidos";
const TELEFONE_LOJA = "5582994114133";
const CATEGORIAS_LABELS = {
    pomadas: "Pomadas e Finalizadores",
    "cuidados-capilares": "Cuidados Capilares",
    "cuidados-com-barba": "Cuidados com a Barba",
    shampoo: "Cuidados Capilares",
    barba: "Cuidados com a Barba"
};
let produtos = [];
let carrinho = [];
let categoriaSelecionada = "todas";
let erroProdutos = "";


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

const couponInput = document.querySelector("#coupon-code");
const couponFeedback = document.querySelector("#coupon-feedback");
const applyCouponButton = document.querySelector("#apply-coupon");
let appliedCoupon = "";
let couponPreview = null;
let couponPreviewRequest = 0;

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
            descricao: produto.description || "",
            promocaoPercentual: Number(produto.promotion_percent) || 0,
            promocaoInicio: produto.promotion_starts_at || "",
            promocaoFim: produto.promotion_ends_at || ""
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

    const categoriaNormalizada = String(categoria || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    const aliases = {
        "pomadas-e-finalizadores": "pomadas",
        "pomadas": "pomadas",
        "shampoo": "cuidados-capilares",
        "shampoo-e-cabelo": "cuidados-capilares",
        "cuidados-capilares": "cuidados-capilares",
        "barba": "cuidados-com-barba",
        "cuidados-com-a-barba": "cuidados-com-barba",
        "cuidados-com-barba": "cuidados-com-barba"
    };

    return aliases[categoriaNormalizada] || categoriaNormalizada;

}

function promocaoAtiva(produto) {
    const percentual = Number(produto.promocaoPercentual);
    if (!Number.isFinite(percentual) || percentual <= 0) return false;

    const agora = Date.now();
    const inicio = produto.promocaoInicio ? Date.parse(produto.promocaoInicio) : null;
    const fim = produto.promocaoFim ? Date.parse(produto.promocaoFim) : null;

    return (inicio === null || (!Number.isNaN(inicio) && inicio <= agora))
        && (fim === null || (!Number.isNaN(fim) && fim > agora));
}

function obterPrecoAtual(produto) {
    const preco = Number(produto.preco || 0);
    if (!promocaoAtiva(produto)) return preco;
    const comDesconto = Math.round(preco * (1 - Number(produto.promocaoPercentual) / 100) * 100) / 100;
    return Math.max(0.01, comDesconto);
}

function montarItensSolicitados() {
    return carrinho.map(item => ({
        product_id: item.id,
        quantity: Number(item.quantidade)
    }));
}

function atualizarResumoComPrevia(preview) {
    couponPreview = preview;
    atualizarResumoCarrinho();
}

async function validarCupom() {
    if (!couponInput || !couponFeedback || !applyCouponButton) return;
    const code = couponInput.value.trim().toUpperCase();
    if (!code) {
        appliedCoupon = "";
        couponPreview = null;
        couponFeedback.textContent = "";
        couponFeedback.className = "cart-coupon-feedback";
        atualizarResumoCarrinho();
        return;
    }

    if (!window.barberflow || !window.barberflow.isConfigured) {
        couponFeedback.textContent = "Cupons só podem ser validados com a loja conectada.";
        couponFeedback.className = "cart-coupon-feedback is-error";
        return;
    }
    if (carrinho.length === 0) {
        couponFeedback.textContent = "Adicione produtos à sacola antes de aplicar o cupom.";
        couponFeedback.className = "cart-coupon-feedback is-error";
        return;
    }

    const requestId = ++couponPreviewRequest;
    applyCouponButton.disabled = true;
    couponFeedback.textContent = "Validando cupom...";
    couponFeedback.className = "cart-coupon-feedback";

    try {
        const { data, error } = await window.barberflow.client.rpc("preview_barberflow_order", {
            p_items: montarItensSolicitados(),
            p_coupon_code: code
        });
        if (error) throw error;
        if (requestId !== couponPreviewRequest) return;

        if (!data.valid) {
            appliedCoupon = "";
            couponPreview = data;
            couponFeedback.textContent = data.message || "Este cupom não está disponível.";
            couponFeedback.className = "cart-coupon-feedback is-error";
            atualizarResumoCarrinho();
            return;
        }

        appliedCoupon = code;
        couponPreview = data;
        couponFeedback.textContent = data.message || "Cupom aplicado.";
        couponFeedback.className = "cart-coupon-feedback is-success";
        atualizarResumoCarrinho();
    } catch (error) {
        console.error("Erro ao validar cupom:", error);
        if (requestId === couponPreviewRequest) {
            couponFeedback.textContent = "Não foi possível validar o cupom. Tente novamente.";
            couponFeedback.className = "cart-coupon-feedback is-error";
        }
    } finally {
        if (requestId === couponPreviewRequest) applyCouponButton.disabled = false;
    }
}

function atualizarPreviaCupom() {
    if (!appliedCoupon) return;
    if (carrinho.length === 0) {
        couponPreview = null;
        return;
    }
    const requestId = ++couponPreviewRequest;
    couponPreview = null;
    atualizarResumoCarrinho();
    window.barberflow.client.rpc("preview_barberflow_order", {
        p_items: montarItensSolicitados(),
        p_coupon_code: appliedCoupon
    }).then(({ data, error }) => {
        if (error) throw error;
        if (requestId !== couponPreviewRequest) return;
        if (!data.valid) {
            appliedCoupon = "";
            couponFeedback.textContent = data.message || "Este cupom não está mais disponível.";
            couponFeedback.className = "cart-coupon-feedback is-error";
        } else {
            couponPreview = data;
        }
        atualizarResumoCarrinho();
    }).catch(error => {
        console.error("Erro ao atualizar o desconto do cupom:", error);
        if (requestId === couponPreviewRequest) {
            couponPreview = null;
            atualizarResumoCarrinho();
            couponFeedback.textContent = "Não foi possível atualizar o cupom.";
            couponFeedback.className = "cart-coupon-feedback is-error";
        }
    });
}


/* =========================================================
   CARD DO PRODUTO
   ========================================================= */

function criarCardProduto(produto) {

    const precoOriginal = Number(produto.preco || 0);
    const preco = obterPrecoAtual(produto);
    const promocao = promocaoAtiva(produto);

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
                ${promocao ? '<span class="product-promotion-badge">Em promoção</span>' : ""}

                <p class="product-description">
                    ${escaparHTML(
                        produto.descricao || ""
                    )}
                </p>

                <div class="product-bottom">

                    <span class="product-prices">
                        ${promocao ? `<s>${formatarPreco(precoOriginal)}</s>` : ""}
                        <strong class="product-price">${formatarPreco(preco)}</strong>
                    </span>

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

    if (carrinho.length === 0 && appliedCoupon) {
        appliedCoupon = "";
        couponPreview = null;
        if (couponFeedback) {
            couponFeedback.textContent = "";
            couponFeedback.className = "cart-coupon-feedback";
        }
    }


    if (carrinho.length === 0) {

        cartItemsContainer.innerHTML = `
            <div class="cart-empty">
                <p>Seu carrinho está vazio.</p>
            </div>
        `;

        atualizarResumoCarrinho();
        atualizarPreviaCupom();

        return;
    }


    cartItemsContainer.innerHTML =
        carrinho
            .map(item => criarItemCarrinho(item))
            .join("");

    configurarFallbacksDeImagem(cartItemsContainer);


    adicionarEventosCarrinho();

    atualizarResumoCarrinho();
    atualizarPreviaCupom();

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

    const produto = produtos.find(
        atual => String(atual.id) === String(item.id)
    );
    const precoOriginal = Number(produto ? produto.preco : item.preco || 0);
    const preco = produto ? obterPrecoAtual(produto) : Number(item.preco || 0);
    const subtotal = preco * Number(item.quantidade || 1);
    const emPromocao = Boolean(produto && promocaoAtiva(produto));


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
                    ${emPromocao ? `<s>${formatarPreco(precoOriginal)}</s> ` : ""}
                    ${formatarPreco(preco)}
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


    const subtotal =
        carrinho.reduce(
            (valor, item) =>
                valor + Number(item.preco || 0) * Number(item.quantidade || 0),
            0
        );
    const totalPromocional = carrinho.reduce((valor, item) => {
        const produto = produtos.find(atual => String(atual.id) === String(item.id));
        const preco = produto ? obterPrecoAtual(produto) : Number(item.preco || 0);
        return valor + preco * Number(item.quantidade || 0);
    }, 0);
    const descontoPromocional = Math.max(0, subtotal - totalPromocional);
    const descontoCupom = appliedCoupon && couponPreview && couponPreview.valid
        ? Number(couponPreview.coupon_discount || 0)
        : 0;
    const total = Math.max(0, totalPromocional - descontoCupom);


    if (cartCount) {

        cartCount.textContent =
            quantidade;

    }


    if (cartTotal) {
        cartTotal.textContent = formatarPreco(total);
    }

    const subtotalElement = document.querySelector("#cart-subtotal");
    const promoDiscountRow = document.querySelector("#promotion-discount-row");
    const promoDiscountElement = document.querySelector("#promotion-discount");
    const couponDiscountRow = document.querySelector("#coupon-discount-row");
    const couponDiscountElement = document.querySelector("#coupon-discount");
    if (subtotalElement) subtotalElement.textContent = formatarPreco(subtotal);
    if (promoDiscountRow) promoDiscountRow.hidden = descontoPromocional <= 0;
    if (promoDiscountElement) promoDiscountElement.textContent = `− ${formatarPreco(descontoPromocional)}`;
    if (couponDiscountRow) couponDiscountRow.hidden = descontoCupom <= 0;
    if (couponDiscountElement) couponDiscountElement.textContent = `− ${formatarPreco(descontoCupom)}`;

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

    if (applyCouponButton) {
        applyCouponButton.addEventListener("click", validarCupom);
    }

    if (couponInput) {
        couponInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                validarCupom();
            }
        });
        couponInput.addEventListener("input", () => {
            if (appliedCoupon && couponInput.value.trim().toUpperCase() !== appliedCoupon) {
                appliedCoupon = "";
                couponPreview = null;
                couponFeedback.textContent = "";
                couponFeedback.className = "cart-coupon-feedback";
                atualizarResumoCarrinho();
            }
        });
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
    let descontoCupomPedido = 0;
    let codigoCupomPedido = "";

    try {
        if (pedidoRemoto) {
            const { data, error } = await window.barberflow.client.functions.invoke(
                "create-order",
                {
                    body: {
                        customer_name: nomeCliente.trim(),
                        items: itensSolicitados.map(item => ({
                            product_id: item.id,
                            quantity: item.quantidade
                        })),
                        coupon_code: appliedCoupon || null
                    }
                }
            );
            if (error) throw error;

            pedidoId = data.order_code;
            total = Number(data.total);
            descontoCupomPedido = Number(data.coupon_discount || 0);
            codigoCupomPedido = data.coupon_code || "";
            itensPedido = data.items.map(item => ({
                nome: item.nome,
                preco: Number(item.preco),
                precoOriginal: Number(item.preco_original ?? item.preco),
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
        let mensagemErro = erro instanceof Error ? erro.message : "";
        if (
            erro
            && typeof erro === "object"
            && "context" in erro
            && erro.context instanceof Response
        ) {
            try {
                const resposta = await erro.context.clone().json();
                if (typeof resposta.error === "string") {
                    mensagemErro = resposta.error;
                }
            } catch (erroResposta) {
                console.error("Não foi possível ler o erro retornado pelo serviço de pedidos:", erroResposta);
            }
        }

        if (pedidoRemoto) {
            try {
                await carregarProdutos();
                renderizarProdutos();
            } catch (erroAtualizacao) {
                console.error("Erro ao atualizar o catálogo após a falha no pedido:", erroAtualizacao);
            }
        }
        alert(
            mensagemErro && /dispon[ií]vel|estoque/i.test(mensagemErro)
                ? "Um produto acabou de ficar indisponível ou não há estoque suficiente. Atualizamos a loja; revise sua sacola."
                : mensagemErro || "Não foi possível registrar o pedido. Tente novamente."
        );
        if (checkoutButton) {
            checkoutButton.disabled = false;
            checkoutButton.innerHTML = originalLabel;
        }
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
            const promoText = item.precoOriginal > Number(item.preco)
                ? ` (promoção; antes ${formatarPreco(item.precoOriginal)})`
                : "";
            return `• ${item.nome} - ${item.quantidade}x - ${formatarPreco(subtotal)}${promoText}`;
        }),
        ...(codigoCupomPedido && descontoCupomPedido > 0
            ? ["", `*Cupom ${codigoCupomPedido}:* − ${formatarPreco(descontoCupomPedido)}`]
            : []),
        "",
        `*Total:* ${formatarPreco(total)}`
    ].join("\n");
    carrinho = [];
    appliedCoupon = "";
    couponPreview = null;
    if (couponInput) couponInput.value = "";
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