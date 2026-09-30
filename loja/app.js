/* =========================================================
   BARBERFLOW - APP.JS
   ========================================================= */

const STORAGE_KEY = "barberflow_produtos";
const PEDIDOS_STORAGE_KEY = "barberflow_pedidos";

let produtos = [];
let carrinho = [];


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
    document.querySelector(".cart-total");

const checkoutButton =
    document.querySelector(".checkout-button");


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    carregarProdutos();

    renderizarProdutos();

    renderizarCarrinho();

    configurarEventos();

});


/* =========================================================
   PRODUTOS
   ========================================================= */

function carregarProdutos() {

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

    if (produtosAtivos.length === 0) {

        productsContainer.innerHTML = `
            <div class="products-empty">
                <p>Nenhum produto disponível no momento.</p>
            </div>
        `;

        return;
    }


    productsContainer.innerHTML =
        produtosAtivos
            .map(produto => criarCardProduto(produto))
            .join("");


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


/* =========================================================
   CARD DO PRODUTO
   ========================================================= */

function criarCardProduto(produto) {

    const preco =
        Number(produto.preco || 0);

    const imagem =
        produto.imagem ||
        "img/produto-placeholder.jpg";

    return `
        <article class="product-card">

            <div class="product-image">

                <img
                    src="${escaparHTML(imagem)}"
                    alt="${escaparHTML(produto.nome)}"
                    onerror="this.src='img/produto-placeholder.jpg'"
                >

            </div>

            <div class="product-info">

                <h3>
                    ${escaparHTML(produto.nome)}
                </h3>

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


    adicionarEventosCarrinho();

    atualizarResumoCarrinho();

}


/* =========================================================
   ITEM DO CARRINHO
   ========================================================= */

function criarItemCarrinho(item) {

    const subtotal =
        Number(item.preco || 0) *
        Number(item.quantidade || 1);


    const imagem =
        item.imagem ||
        "img/produto-placeholder.jpg";


    return `
        <div
            class="cart-item"
            data-id="${escaparHTML(
                String(item.id)
            )}"
        >

            <div class="cart-item-image">

                <img
                    src="${escaparHTML(imagem)}"
                    alt="${escaparHTML(item.nome)}"
                    onerror="this.src='img/produto-placeholder.jpg'"
                >

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

function finalizarPedido() {

    if (carrinho.length === 0) {

        alert(
            "Seu carrinho está vazio."
        );

        return;
    }


    /* -----------------------------------------------------
       DADOS DO CLIENTE
       ----------------------------------------------------- */

    const nomeCliente =
        prompt(
            "Digite seu nome:"
        );


    if (
        !nomeCliente ||
        !nomeCliente.trim()
    ) {

        alert(
            "Digite seu nome para continuar."
        );

        return;
    }


    /* -----------------------------------------------------
       TOTAL DO PEDIDO
       ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       ID DO PEDIDO
       ----------------------------------------------------- */

    const pedidoId =
        gerarIdPedido();


    /* -----------------------------------------------------
       CRIAR PEDIDO
       ----------------------------------------------------- */

    const pedido = {

        id: pedidoId,

        cliente: {

            nome:
                nomeCliente.trim()

        },

        itens:

            carrinho.map(item => ({

                id:
                    item.id,

                nome:
                    item.nome,

                preco:
                    Number(item.preco || 0),

                quantidade:
                    Number(
                        item.quantidade || 1
                    ),

                imagem:
                    item.imagem || ""

            })),

        total:
            total,

        status:
            "pending",

        criadoEm:
            new Date().toISOString()

    };


    /* -----------------------------------------------------
       CARREGAR PEDIDOS EXISTENTES
       ----------------------------------------------------- */

    let pedidos = [];


    try {

        const pedidosSalvos =
            localStorage.getItem(
                PEDIDOS_STORAGE_KEY
            );


        if (pedidosSalvos) {

            const dados =
                JSON.parse(pedidosSalvos);


            if (Array.isArray(dados)) {

                pedidos = dados;

            }

        }

    } catch (erro) {

        console.error(
            "Erro ao carregar pedidos:",
            erro
        );

        pedidos = [];

    }


    /* -----------------------------------------------------
       ADICIONAR NOVO PEDIDO
       ----------------------------------------------------- */

    pedidos.push(pedido);


    localStorage.setItem(
        PEDIDOS_STORAGE_KEY,
        JSON.stringify(pedidos)
    );


    /* -----------------------------------------------------
       ATUALIZAR ESTOQUE
       ----------------------------------------------------- */

    carrinho.forEach(item => {

        const produto =
            produtos.find(
                produto =>
                    String(produto.id) ===
                    String(item.id)
            );


        if (!produto) {
            return;
        }


        const estoqueAtual =
            Number(
                produto.estoque || 0
            );


        const quantidadeComprada =
            Number(
                item.quantidade || 0
            );


        produto.estoque =
            Math.max(
                0,
                estoqueAtual -
                quantidadeComprada
            );

    });


    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(produtos)
    );


    /* -----------------------------------------------------
       MONTAR MENSAGEM DO WHATSAPP
       ----------------------------------------------------- */

    const telefoneLoja =
        "5582999999999";


    let mensagem =
        `Olá! Gostaria de fazer um pedido.%0A%0A`;


    mensagem +=
        `*Pedido:* ${pedidoId}%0A`;


    mensagem +=
        `*Cliente:* ${nomeCliente.trim()}%0A%0A`;


    mensagem +=
        `*Produtos:*%0A`;


    carrinho.forEach(item => {

        const subtotal =
            Number(item.preco || 0) *
            Number(item.quantidade || 0);


        mensagem +=
            `• ${item.nome} - ` +
            `${item.quantidade}x - ` +
            `${formatarPreco(subtotal)}%0A`;

    });


    mensagem +=
        `%0A*Total:* ${formatarPreco(total)}`;


    /* -----------------------------------------------------
       LIMPAR CARRINHO
       ----------------------------------------------------- */

    carrinho = [];


    renderizarCarrinho();

    renderizarProdutos();


    /* -----------------------------------------------------
       FECHAR CARRINHO
       ----------------------------------------------------- */

    fecharCarrinho();


    /* -----------------------------------------------------
       REDIRECIONAR PARA WHATSAPP
       ----------------------------------------------------- */

    const url =
        `https://wa.me/${telefoneLoja}?text=${mensagem}`;


    window.location.href = url;

}


    /* -----------------------------------------------------
       MENSAGEM WHATSAPP
       ----------------------------------------------------- */

    const telefoneLoja =
        "5582999999999";


    let mensagem =
        `Olá! Gostaria de fazer um pedido.%0A%0A`;


    mensagem +=
        `*Pedido:* ${pedidoId}%0A`;


    mensagem +=
        `*Cliente:* ${nomeCliente.trim()}%0A`;


    mensagem +=
        `*WhatsApp:* ${telefoneCliente.trim()}%0A%0A`;


    mensagem +=
        `*Produtos:*%0A`;


    carrinho.forEach(item => {

        const subtotal =
            Number(item.preco || 0) *
            Number(item.quantidade || 0);


        mensagem +=
            `• ${item.nome} - ` +
            `${item.quantidade}x - ` +
            `${formatarPreco(subtotal)}%0A`;

    });


    mensagem +=
        `%0A*Total:* ${formatarPreco(total)}`;


    /* -----------------------------------------------------
       LIMPAR CARRINHO
       ----------------------------------------------------- */

    carrinho = [];


    renderizarCarrinho();

    renderizarProdutos();

    fecharCarrinho();


    /* -----------------------------------------------------
       ABRIR WHATSAPP
       ----------------------------------------------------- */

    const url =
        `https://wa.me/${telefoneLoja}?text=${mensagem}`;


    window.open(
        url,
        "_blank"
    );


    /* -----------------------------------------------------
       CONFIRMAÇÃO
       ----------------------------------------------------- */

    alert(
        `Pedido criado com sucesso!\n\nID do pedido: ${pedidoId}`
    );




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
    event => {

        if (
            event.key ===
            STORAGE_KEY
        ) {

            carregarProdutos();

            renderizarProdutos();

            renderizarCarrinho();

        }

    }
);


/* =========================================================
   FIM DO APP.JS
   ========================================================= */