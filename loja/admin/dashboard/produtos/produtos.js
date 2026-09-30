/* =========================================================
   BARBERFLOW - GERENCIAMENTO DE PRODUTOS
   ========================================================= */

const PRODUTOS_STORAGE_KEY = "barberflow_produtos";

const ESTOQUE_BAIXO_LIMITE = 5;


/* =========================================================
   ELEMENTOS
   ========================================================= */

const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");

const menuButton = document.getElementById("menu-button");
const closeSidebarButton = document.getElementById("close-sidebar");

const addProductButton = document.getElementById("add-product-button");
const emptyAddProductButton = document.getElementById("empty-add-product");

const productModal = document.getElementById("product-modal");
const deleteModal = document.getElementById("delete-modal");

const closeModalButton = document.getElementById("close-modal");
const cancelProductButton = document.getElementById("cancel-product");

const cancelDeleteButton = document.getElementById("cancel-delete");
const confirmDeleteButton = document.getElementById("confirm-delete");

const productForm = document.getElementById("product-form");

const modalTitle = document.getElementById("modal-title");

const productIdInput = document.getElementById("product-id");
const productNameInput = document.getElementById("product-name");
const productCategoryInput = document.getElementById("product-category");
const productPriceInput = document.getElementById("product-price");
const productStockInput = document.getElementById("product-stock");
const productStatusInput = document.getElementById("product-status");
const productImageInput = document.getElementById("product-image");
const productDescriptionInput = document.getElementById("product-description");

const searchProductInput = document.getElementById("search-product");
const categoryFilter = document.getElementById("category-filter");
const statusFilter = document.getElementById("status-filter");

const productsTable = document.getElementById("products-table");
const emptyProducts = document.getElementById("empty-products");

const totalProductsElement = document.getElementById("total-products");
const activeProductsElement = document.getElementById("active-products");
const lowStockProductsElement = document.getElementById("low-stock-products");
const outStockProductsElement = document.getElementById("out-stock-products");

const productsCountElement = document.getElementById("products-count");


/* =========================================================
   ESTADO
   ========================================================= */

let produtos = [];

let produtoParaExcluir = null;


document.addEventListener("DOMContentLoaded", () => {

    carregarProdutos();

    renderizarProdutos();

    atualizarEstatisticas();

    configurarEventos();

    abrirProdutoDaURL();

});


/* =========================================================
   CARREGAR PRODUTOS
   ========================================================= */

function carregarProdutos() {

    try {

        const produtosSalvos =
            localStorage.getItem(PRODUTOS_STORAGE_KEY);

        if (!produtosSalvos) {

            produtos = [];

            return;
        }

        const dados = JSON.parse(produtosSalvos);

        if (Array.isArray(dados)) {

            produtos = dados;

        } else {

            produtos = [];

        }

    } catch (erro) {

        console.error(
            "Erro ao carregar produtos:",
            erro
        );

        produtos = [];
    }

}


/* =========================================================
   SALVAR PRODUTOS
   ========================================================= */

function salvarProdutos() {

    try {

        localStorage.setItem(
            PRODUTOS_STORAGE_KEY,
            JSON.stringify(produtos)
        );

    } catch (erro) {

        console.error(
            "Erro ao salvar produtos:",
            erro
        );

        alert(
            "Não foi possível salvar os produtos."
        );
    }

}


/* =========================================================
   EVENTOS
   ========================================================= */

function configurarEventos() {

    /* Menu mobile */

    menuButton?.addEventListener(
        "click",
        abrirSidebar
    );

    closeSidebarButton?.addEventListener(
        "click",
        fecharSidebar
    );

    sidebarOverlay?.addEventListener(
        "click",
        fecharSidebar
    );


    /* Abrir modal */

    addProductButton?.addEventListener(
        "click",
        abrirModalNovoProduto
    );

    emptyAddProductButton?.addEventListener(
        "click",
        abrirModalNovoProduto
    );


    /* Fechar modal */

    closeModalButton?.addEventListener(
        "click",
        fecharModalProduto
    );

    cancelProductButton?.addEventListener(
        "click",
        fecharModalProduto
    );


    /* Formulário */

    productForm?.addEventListener(
        "submit",
        salvarProduto
    );


    /* Exclusão */

    cancelDeleteButton?.addEventListener(
        "click",
        fecharModalExcluir
    );

    confirmDeleteButton?.addEventListener(
        "click",
        confirmarExclusao
    );


    /* Pesquisa */

    searchProductInput?.addEventListener(
        "input",
        renderizarProdutos
    );


    /* Filtros */

    categoryFilter?.addEventListener(
        "change",
        renderizarProdutos
    );

    statusFilter?.addEventListener(
        "change",
        renderizarProdutos
    );


    /* Fechar modais clicando fora */

    productModal?.addEventListener(
        "click",
        (evento) => {

            if (evento.target === productModal) {
                fecharModalProduto();
            }

        }
    );

    deleteModal?.addEventListener(
        "click",
        (evento) => {

            if (evento.target === deleteModal) {
                fecharModalExcluir();
            }

        }
    );


    /* ESC */

    document.addEventListener(
        "keydown",
        (evento) => {

            if (evento.key !== "Escape") {
                return;
            }

            fecharModalProduto();

            fecharModalExcluir();

            fecharSidebar();

        }
    );


    /* Notificação */

    const notificationButton =
        document.getElementById(
            "notification-button"
        );

    notificationButton?.addEventListener(
        "click",
        () => {

            const produtosBaixoEstoque =
                produtos.filter(produto => {

                    const estoque =
                        Number(produto.estoque || 0);

                    return (
                        estoque > 0 &&
                        estoque <= ESTOQUE_BAIXO_LIMITE
                    );

                });

            const produtosSemEstoque =
                produtos.filter(produto => {

                    return Number(produto.estoque || 0) <= 0;

                });


            if (
                produtosBaixoEstoque.length === 0 &&
                produtosSemEstoque.length === 0
            ) {

                alert(
                    "Não há alertas de estoque no momento."
                );

                return;
            }


            let mensagem =
                "Alertas de estoque:\n\n";


            if (produtosSemEstoque.length > 0) {

                mensagem +=
                    `Sem estoque: ${produtosSemEstoque.length}\n`;

            }


            if (produtosBaixoEstoque.length > 0) {

                mensagem +=
                    `Estoque baixo: ${produtosBaixoEstoque.length}`;

            }


            alert(mensagem);

        }
    );

}


/* =========================================================
   RENDERIZAR PRODUTOS
   ========================================================= */

function renderizarProdutos() {

    const produtosFiltrados =
        obterProdutosFiltrados();


    productsTable.innerHTML = "";


    produtosFiltrados.forEach(produto => {

        const linha =
            criarLinhaProduto(produto);

        productsTable.appendChild(linha);

    });


    atualizarContador(produtosFiltrados.length);


    if (produtosFiltrados.length === 0) {

        emptyProducts.classList.add("show");

    } else {

        emptyProducts.classList.remove("show");

    }


    atualizarEstatisticas();

}


/* =========================================================
   FILTROS
   ========================================================= */

function obterProdutosFiltrados() {

    const pesquisa =
        (searchProductInput?.value || "")
            .trim()
            .toLowerCase();


    const categoria =
        categoryFilter?.value || "all";


    const status =
        statusFilter?.value || "all";


    return produtos.filter(produto => {

        const nome =
            String(produto.nome || "")
                .toLowerCase();

        const descricao =
            String(produto.descricao || "")
                .toLowerCase();


        const correspondePesquisa =
            !pesquisa ||
            nome.includes(pesquisa) ||
            descricao.includes(pesquisa);


        const correspondeCategoria =
            categoria === "all" ||
            String(produto.categoria) === categoria;


        const correspondeStatus =
            status === "all" ||
            String(produto.status || "active") === status;


        return (
            correspondePesquisa &&
            correspondeCategoria &&
            correspondeStatus
        );

    });

}


/* =========================================================
   CRIAR LINHA
   ========================================================= */

function criarLinhaProduto(produto) {

    const tr =
        document.createElement("tr");


    const estoque =
        Number(produto.estoque || 0);


    const categoria =
        formatarCategoria(produto.categoria);


    const status =
        produto.status === "inactive"
            ? "inactive"
            : "active";


    const statusTexto =
        status === "active"
            ? "Ativo"
            : "Inativo";


    let classeEstoque = "";

    if (estoque <= 0) {

        classeEstoque = "out";

    } else if (
        estoque <= ESTOQUE_BAIXO_LIMITE
    ) {

        classeEstoque = "low";

    }


    tr.innerHTML = `

        <td>

            <div class="product-info">

                <div class="product-image">

                    ${
                        produto.imagem
                            ? `
                                <img
                                    src="${escaparHTML(produto.imagem)}"
                                    alt="${escaparHTML(produto.nome)}"
                                    onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
                                >

                                <i
                                    class="fa-solid fa-image"
                                    style="display:none;"
                                ></i>
                            `
                            : `
                                <i class="fa-solid fa-image"></i>
                            `
                    }

                </div>


                <div class="product-name">

                    <strong>
                        ${escaparHTML(produto.nome || "Sem nome")}
                    </strong>

                    <span>
                        ID: ${escaparHTML(String(produto.id || ""))}
                    </span>

                </div>

            </div>

        </td>


        <td>

            <span class="category-badge">

                ${categoria}

            </span>

        </td>


        <td>

            <span class="product-price">

                ${formatarPreco(produto.preco)}

            </span>

        </td>


        <td>

            <span class="stock-value ${classeEstoque}">

                ${estoque}

            </span>

        </td>


        <td>

            <span class="status-badge ${status}">

                ${statusTexto}

            </span>

        </td>


        <td>

            <div class="product-actions">

                <button
                    type="button"
                    class="action-button"
                    title="Editar produto"
                    data-action="edit"
                    data-id="${escaparHTML(String(produto.id))}"
                >

                    <i class="fa-solid fa-pen"></i>

                </button>


                <button
                    type="button"
                    class="action-button delete"
                    title="Excluir produto"
                    data-action="delete"
                    data-id="${escaparHTML(String(produto.id))}"
                >

                    <i class="fa-solid fa-trash"></i>

                </button>

            </div>

        </td>

    `;


    const editButton =
        tr.querySelector(
            '[data-action="edit"]'
        );

    const deleteButton =
        tr.querySelector(
            '[data-action="delete"]'
        );


    editButton?.addEventListener(
        "click",
        () => editarProduto(produto.id)
    );


    deleteButton?.addEventListener(
        "click",
        () => abrirModalExcluir(produto.id)
    );


    return tr;

}


/* =========================================================
   NOVO PRODUTO
   ========================================================= */

function abrirModalNovoProduto() {

    productForm.reset();


    productIdInput.value = "";


    productStatusInput.value =
        "active";


    modalTitle.textContent =
        "Novo produto";


    productModal.classList.add("active");


    setTimeout(() => {

        productNameInput.focus();

    }, 100);

}


/* =========================================================
   EDITAR PRODUTO
   ========================================================= */

function editarProduto(id) {

    const produto =
        produtos.find(
            item => String(item.id) === String(id)
        );


    if (!produto) {

        alert(
            "Produto não encontrado."
        );

        return;
    }


    productIdInput.value =
        produto.id || "";


    productNameInput.value =
        produto.nome || "";


    productCategoryInput.value =
        produto.categoria || "";


    productPriceInput.value =
        Number(produto.preco || 0);


    productStockInput.value =
        Number(produto.estoque || 0);


    productStatusInput.value =
        produto.status || "active";


    productImageInput.value =
        produto.imagem || "";


    productDescriptionInput.value =
        produto.descricao || "";


    modalTitle.textContent =
        "Editar produto";


    productModal.classList.add("active");


    setTimeout(() => {

        productNameInput.focus();

    }, 100);

}


/* =========================================================
   SALVAR PRODUTO
   ========================================================= */

function salvarProduto(evento) {

    evento.preventDefault();


    const nome =
        productNameInput.value.trim();


    const categoria =
        productCategoryInput.value;


    const preco =
        Number(productPriceInput.value);


    const estoque =
        Number(productStockInput.value);


    const status =
        productStatusInput.value;


    const imagem =
        productImageInput.value.trim();


    const descricao =
        productDescriptionInput.value.trim();


    /* Validações */

    if (!nome) {

        alert(
            "Digite o nome do produto."
        );

        productNameInput.focus();

        return;
    }


    if (!categoria) {

        alert(
            "Selecione uma categoria."
        );

        productCategoryInput.focus();

        return;
    }


    if (
        !Number.isFinite(preco) ||
        preco < 0
    ) {

        alert(
            "Digite um preço válido."
        );

        productPriceInput.focus();

        return;
    }


    if (
        !Number.isFinite(estoque) ||
        estoque < 0
    ) {

        alert(
            "Digite um estoque válido."
        );

        productStockInput.focus();

        return;
    }


    const idExistente =
        productIdInput.value.trim();


    /* =====================================================
       EDITAR
       ===================================================== */

    if (idExistente) {

        const indice =
            produtos.findIndex(
                produto =>
                    String(produto.id) ===
                    String(idExistente)
            );


        if (indice === -1) {

            alert(
                "Produto não encontrado."
            );

            return;
        }


        produtos[indice] = {

            ...produtos[indice],

            nome,
            categoria,
            preco,
            estoque,
            status,
            imagem,
            descricao

        };


        salvarProdutos();

        renderizarProdutos();

        fecharModalProduto();


        alert(
            "Produto atualizado com sucesso!"
        );


        return;
    }


    /* =====================================================
       NOVO
       ===================================================== */

    const novoProduto = {

        id: gerarIdProduto(),

        nome,

        categoria,

        preco,

        estoque,

        imagem,

        status,

        descricao,

        criadoEm:
            new Date().toISOString()

    };


    produtos.push(novoProduto);


    salvarProdutos();

    renderizarProdutos();

    fecharModalProduto();


    alert(
        "Produto cadastrado com sucesso!"
    );

}


/* =========================================================
   GERAR ID
   ========================================================= */

function gerarIdProduto() {

    const agora =
        Date.now().toString(36);


    const aleatorio =
        Math.random()
            .toString(36)
            .substring(2, 7);


    return `PROD-${agora}-${aleatorio}`.toUpperCase();

}


/* =========================================================
   EXCLUIR
   ========================================================= */

function abrirModalExcluir(id) {

    const produto =
        produtos.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!produto) {

        alert(
            "Produto não encontrado."
        );

        return;
    }


    produtoParaExcluir =
        produto.id;


    deleteModal.classList.add("active");

}


function fecharModalExcluir() {

    deleteModal.classList.remove("active");

    produtoParaExcluir = null;

}


function confirmarExclusao() {

    if (!produtoParaExcluir) {

        fecharModalExcluir();

        return;
    }


    const indice =
        produtos.findIndex(
            produto =>
                String(produto.id) ===
                String(produtoParaExcluir)
        );


    if (indice === -1) {

        fecharModalExcluir();

        return;
    }


    produtos.splice(indice, 1);


    salvarProdutos();

    renderizarProdutos();

    fecharModalExcluir();


    alert(
        "Produto excluído com sucesso!"
    );

}


/* =========================================================
   ESTATÍSTICAS
   ========================================================= */

function atualizarEstatisticas() {

    const total =
        produtos.length;


    const ativos =
        produtos.filter(
            produto =>
                (produto.status || "active") ===
                "active"
        ).length;


    const estoqueBaixo =
        produtos.filter(produto => {

            const estoque =
                Number(produto.estoque || 0);

            return (
                estoque > 0 &&
                estoque <= ESTOQUE_BAIXO_LIMITE
            );

        }).length;


    const semEstoque =
        produtos.filter(produto => {

            return Number(produto.estoque || 0) <= 0;

        }).length;


    totalProductsElement.textContent =
        total;


    activeProductsElement.textContent =
        ativos;


    lowStockProductsElement.textContent =
        estoqueBaixo;


    outStockProductsElement.textContent =
        semEstoque;

}


/* =========================================================
   CONTADOR
   ========================================================= */

function atualizarContador(quantidade) {

    productsCountElement.textContent =
        quantidade === 1
            ? "1 produto"
            : `${quantidade} produtos`;

}


/* =========================================================
   CATEGORIA
   ========================================================= */

function formatarCategoria(categoria) {

    const categorias = {

        pomadas: "Pomadas",

        shampoo: "Shampoo",

        barba: "Barba",

        acessorios: "Acessórios",

        outros: "Outros"

    };


    return (
        categorias[categoria] ||
        "Outros"
    );

}


/* =========================================================
   PREÇO
   ========================================================= */

function formatarPreco(valor) {

    const numero =
        Number(valor || 0);


    return numero.toLocaleString(
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
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   MODAL PRODUTO
   ========================================================= */

function fecharModalProduto() {

    productModal.classList.remove("active");

    productForm.reset();

    productIdInput.value = "";

}


/* =========================================================
   SIDEBAR
   ========================================================= */

function abrirSidebar() {

    sidebar.classList.add("open");

    sidebarOverlay.classList.add("active");

}


function fecharSidebar() {

    sidebar.classList.remove("open");

    sidebarOverlay.classList.remove("active");

}


/* =========================================================
   ATUALIZAÇÃO ENTRE ABAS
   ========================================================= */

window.addEventListener(
    "storage",
    (evento) => {

        if (
            evento.key !==
            PRODUTOS_STORAGE_KEY
        ) {
            return;
        }


        carregarProdutos();

        renderizarProdutos();

    }
);


/* =========================================================
   VOLTAR PARA A PÁGINA E ATUALIZAR
   ========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState !==
            "visible"
        ) {
            return;
        }


        carregarProdutos();

        renderizarProdutos();

    }
);