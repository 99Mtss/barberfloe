/* =========================================
   BARBERFLOW — ADMIN.JS
   Dashboard Administrativo
========================================= */


/* =========================================
   CONFIGURAÇÕES
========================================= */

const PRODUTOS_STORAGE_KEY = "barberflow_produtos";
const PEDIDOS_STORAGE_KEY = "barberflow_pedidos";

const ESTOQUE_BAIXO_LIMITE = 5;


/* =========================================
   ELEMENTOS DO DOM
========================================= */

const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menu-toggle");
const sidebarClose = document.getElementById("sidebar-close");
const sidebarOverlay = document.getElementById("sidebar-overlay");

const salesPeriod = document.getElementById("sales-period");

const notificationButton =
    document.querySelector(".notification-button");

const navItems =
    document.querySelectorAll(".nav-item");

const quickActions =
    document.querySelectorAll(".quick-action");

const viewAllLinks =
    document.querySelectorAll(".view-all");


const recentOrdersContainer =
    document.getElementById("recent-orders");

const topProductsContainer =
    document.getElementById("top-products");

const lowStockContainer =
    document.getElementById("low-stock-list");

const salesChartContainer =
    document.getElementById("sales-chart");


/* =========================================
   FUNÇÕES AUXILIARES
========================================= */


/*
    Formata valores para Real brasileiro.
*/
function formatarMoeda(valor) {

    return Number(valor || 0).toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );

}


/*
    Formata uma data.
*/
function formatarData(data) {

    if (!data) {
        return "--";
    }

    const dataObj = new Date(data);

    if (isNaN(dataObj.getTime())) {
        return "--";
    }

    return dataObj.toLocaleDateString(
        "pt-BR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );

}


/*
    Formata data e horário.
*/
function formatarDataHora(data) {

    if (!data) {
        return "--";
    }

    const dataObj = new Date(data);

    if (isNaN(dataObj.getTime())) {
        return "--";
    }

    return dataObj.toLocaleString(
        "pt-BR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/*
    Evita que nomes ou textos
    inseridos nos dados quebrem o HTML.
*/
function escaparHTML(valor) {

    if (
        valor === null ||
        valor === undefined
    ) {
        return "";
    }

    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================
   NAVEGAÇÃO ENTRE MÓDULOS
========================================= */


/*
    Abre a página de pedidos
    já indicando qual pedido deve ser aberto.
*/
function abrirPedido(pedidoId) {

    if (!pedidoId) {
        window.location.href = "../pedidos/pedidos.html";
        return;
    }

    const url =
        `../pedidos/pedidos.html?pedido=${encodeURIComponent(pedidoId)}`;

    window.location.href = url;

}


/*
    Abre a página de produtos
    já pesquisando pelo produto.
*/
function abrirProduto(produtoId, nomeProduto = "") {

    const termo =
        produtoId || nomeProduto;

    if (!termo) {
        window.location.href = "../produtos/produtos.html";
        return;
    }

    const url =
        `../produtos/produtos.html?produto=${encodeURIComponent(termo)}`;

    window.location.href = url;

}


/*
    Permite abrir um pedido clicando
    em qualquer parte do item.
*/
function configurarLinksPedidos() {

    if (!recentOrdersContainer) {
        return;
    }

    const itens =
        recentOrdersContainer.querySelectorAll(
            ".dashboard-order-item"
        );

    itens.forEach(item => {

        item.style.cursor = "pointer";

        item.addEventListener(
            "click",
            function () {

                const pedidoId =
                    item.dataset.pedidoId;

                if (pedidoId) {
                    abrirPedido(pedidoId);
                }

            }
        );

    });

}


/*
    Permite abrir um produto clicando
    no item de estoque baixo.
*/
function configurarLinksEstoque() {

    if (!lowStockContainer) {
        return;
    }

    const itens =
        lowStockContainer.querySelectorAll(
            ".dashboard-stock-item"
        );

    itens.forEach(item => {

        item.style.cursor = "pointer";

        item.addEventListener(
            "click",
            function () {

                const produtoId =
                    item.dataset.produtoId;

                const nome =
                    item.dataset.produtoNome || "";

                if (produtoId || nome) {
                    abrirProduto(
                        produtoId,
                        nome
                    );
                }

            }
        );

    });

}


/* =========================================
   LOCAL STORAGE
========================================= */


/*
    Carrega produtos da loja.
*/
function carregarProdutos() {

    try {

        const dados =
            localStorage.getItem(
                PRODUTOS_STORAGE_KEY
            );

        if (!dados) {
            return [];
        }

        const produtos =
            JSON.parse(dados);

        return Array.isArray(produtos)
            ? produtos
            : [];

    } catch (erro) {

        console.error(
            "Erro ao carregar produtos:",
            erro
        );

        return [];

    }

}


/*
    Carrega pedidos da loja.
*/
function carregarPedidos() {

    try {

        const dados =
            localStorage.getItem(
                PEDIDOS_STORAGE_KEY
            );

        if (!dados) {
            return [];
        }

        const pedidos =
            JSON.parse(dados);

        return Array.isArray(pedidos)
            ? pedidos
            : [];

    } catch (erro) {

        console.error(
            "Erro ao carregar pedidos:",
            erro
        );

        return [];

    }

}


/* =========================================
   SIDEBAR
========================================= */


/*
    Abre o menu.
*/
function abrirSidebar() {

    if (!sidebar) {
        return;
    }

    sidebar.classList.add("open");

    if (sidebarOverlay) {

        sidebarOverlay.classList.add(
            "active"
        );

    }

    document.body.style.overflow =
        "hidden";

}


/*
    Fecha o menu.
*/
function fecharSidebar() {

    if (!sidebar) {
        return;
    }

    sidebar.classList.remove("open");

    if (sidebarOverlay) {

        sidebarOverlay.classList.remove(
            "active"
        );

    }

    document.body.style.overflow = "";

}


/* =========================================
   BOTÃO MENU
========================================= */

if (menuToggle) {

    menuToggle.addEventListener(
        "click",
        abrirSidebar
    );

}


/* =========================================
   BOTÃO FECHAR
========================================= */

if (sidebarClose) {

    sidebarClose.addEventListener(
        "click",
        fecharSidebar
    );

}


/* =========================================
   OVERLAY
========================================= */

if (sidebarOverlay) {

    sidebarOverlay.addEventListener(
        "click",
        fecharSidebar
    );

}


/* =========================================
   NAVEGAÇÃO
========================================= */

navItems.forEach(item => {

    item.addEventListener(
        "click",
        function (event) {

            const link =
                item.getAttribute("href");

            /*
                Links ainda não disponíveis.
            */
            if (link === "#") {

                event.preventDefault();

            }

            /*
                Atualiza item ativo.
            */
            navItems.forEach(nav => {

                nav.classList.remove(
                    "active"
                );

            });

            item.classList.add("active");

            /*
                Fecha menu no celular.
            */
            if (
                window.innerWidth <= 950
            ) {

                fecharSidebar();

            }

        }
    );

});


/* =========================================
   LINKS VER TODOS
========================================= */

viewAllLinks.forEach(link => {

    link.addEventListener(
        "click",
        function (event) {

            if (
                link.getAttribute("href") === "#"
            ) {

                event.preventDefault();

            }

        }
    );

});


/* =========================================
   ACESSO RÁPIDO
========================================= */

quickActions.forEach(action => {

    action.addEventListener(
        "click",
        function (event) {

            if (
                action.getAttribute("href") === "#"
            ) {

                event.preventDefault();

            }

        }
    );

});


/* =========================================
   CARDS DO DASHBOARD
========================================= */

function atualizarCards() {

    const produtos =
        carregarProdutos();

    const pedidos =
        carregarPedidos();

    /*
        Rendimento:

        somente pedidos concluídos.
    */
    const rendimento =
        pedidos
            .filter(
                pedido =>
                    pedido.status === "completed"
            )
            .reduce(
                (total, pedido) =>
                    total +
                    Number(
                        pedido.total || 0
                    ),
                0
            );

    /*
        Produtos com estoque baixo.
    */
    const estoqueBaixo =
        produtos.filter(produto => {

            const estoque =
                Number(
                    produto.estoque || 0
                );

            return (
                estoque > 0 &&
                estoque <=
                ESTOQUE_BAIXO_LIMITE
            );

        }).length;

    const cards =
        document.querySelectorAll(
            ".stat-card"
        );

    if (cards[0]) {

        const valor =
            cards[0].querySelector(
                ".stat-value"
            );

        if (valor) {

            valor.textContent =
                formatarMoeda(
                    rendimento
                );

        }

    }


    if (cards[1]) {

        const valor =
            cards[1].querySelector(
                ".stat-value"
            );

        if (valor) {

            valor.textContent =
                pedidos.length;

        }

    }


    if (cards[2]) {

        const valor =
            cards[2].querySelector(
                ".stat-value"
            );

        if (valor) {

            valor.textContent =
                produtos.length;

        }

    }


    if (cards[3]) {

        const valor =
            cards[3].querySelector(
                ".stat-value"
            );

        if (valor) {

            valor.textContent =
                estoqueBaixo;

        }

    }

}


/* =========================================
   PEDIDOS RECENTES
========================================= */

function atualizarPedidosRecentes() {

    if (!recentOrdersContainer) {
        return;
    }

    const pedidos =
        carregarPedidos();

    /*
        Mais recentes primeiro.
    */
    const pedidosOrdenados =
        [...pedidos].sort(
            (a, b) =>
                new Date(
                    b.criadoEm
                ) -
                new Date(
                    a.criadoEm
                )
        );

    const pedidosRecentes =
        pedidosOrdenados.slice(0, 5);

    /*
        Nenhum pedido.
    */
    if (
        pedidosRecentes.length === 0
    ) {

        recentOrdersContainer.innerHTML = `

            <div class="empty-state">

                <i class="fa-solid fa-receipt"></i>

                <p>
                    Nenhum pedido encontrado.
                </p>

            </div>

        `;

        return;

    }


    recentOrdersContainer.innerHTML =
        pedidosRecentes.map(
            pedido => {

                const nome =
                    pedido.cliente &&
                    pedido.cliente.nome
                        ? pedido.cliente.nome
                        : "Cliente";

                const total =
                    Number(
                        pedido.total || 0
                    );

                const status =
                    pedido.status ||
                    "pending";

                let statusTexto =
                    "Pendente";

                if (
                    status === "processing"
                ) {

                    statusTexto =
                        "Em andamento";

                }

                if (
                    status === "completed"
                ) {

                    statusTexto =
                        "Concluído";

                }

                if (
                    status === "cancelled"
                ) {

                    statusTexto =
                        "Cancelado";

                }

                return `

                    <div
                        class="dashboard-order-item"
                        data-pedido-id="${escaparHTML(
                            pedido.id || ""
                        )}"
                        style="
                            display:flex;
                            align-items:center;
                            justify-content:space-between;
                            gap:15px;
                            padding:15px 0;
                            border-bottom:1px solid rgba(255,255,255,.07);
                            cursor:pointer;
                        "
                        title="Clique para abrir este pedido"
                    >

                        <div
                            style="
                                min-width:0;
                                flex:1;
                            "
                        >

                            <strong
                                style="
                                    display:block;
                                    font-size:12px;
                                "
                            >
                                ${escaparHTML(
                                    pedido.id ||
                                    "Pedido"
                                )}
                            </strong>


                            <span
                                style="
                                    display:block;
                                    margin-top:5px;
                                    color:#a7adb9;
                                    font-size:11px;
                                "
                            >
                                ${escaparHTML(
                                    nome
                                )}
                            </span>


                            <span
                                style="
                                    display:block;
                                    margin-top:4px;
                                    color:#707785;
                                    font-size:10px;
                                "
                            >
                                ${formatarDataHora(
                                    pedido.criadoEm
                                )}
                            </span>

                        </div>


                        <div
                            style="
                                text-align:right;
                                white-space:nowrap;
                            "
                        >

                            <strong
                                style="
                                    display:block;
                                    font-size:12px;
                                "
                            >
                                ${formatarMoeda(
                                    total
                                )}
                            </strong>


                            <span
                                style="
                                    display:inline-block;
                                    margin-top:6px;
                                    padding:4px 8px;
                                    border-radius:20px;
                                    background:rgba(255,255,255,.06);
                                    font-size:9px;
                                    color:${
                                        status === "completed"
                                            ? "#35c98a"
                                            : status === "cancelled"
                                                ? "#e35d6a"
                                                : status === "processing"
                                                    ? "#4f8cff"
                                                    : "#e5a83b"
                                    };
                                "
                            >
                                ${statusTexto}
                            </span>

                        </div>

                    </div>

                `;

            }
        ).join("");

    configurarLinksPedidos();

}


/* =========================================
   PRODUTOS MAIS VENDIDOS
========================================= */

function atualizarProdutosMaisVendidos() {

    if (!topProductsContainer) {
        return;
    }

    const pedidos =
        carregarPedidos();

    const produtosVendidos = {};


    /*
        Soma os produtos de todos
        os pedidos não cancelados.
    */
    pedidos
        .filter(
            pedido =>
                pedido.status !== "cancelled"
        )
        .forEach(pedido => {

            if (
                !Array.isArray(
                    pedido.itens
                )
            ) {

                return;

            }


            pedido.itens.forEach(item => {

                const id =
                    String(
                        item.id ??
                        item.nome ??
                        "produto"
                    );


                if (
                    !produtosVendidos[id]
                ) {

                    produtosVendidos[id] = {

                        nome:
                            item.nome ||
                            "Produto",

                        quantidade: 0,

                        valor: 0

                    };

                }


                const quantidade =
                    Number(
                        item.quantidade || 0
                    );


                const preco =
                    Number(
                        item.preco || 0
                    );


                produtosVendidos[id]
                    .quantidade +=
                    quantidade;


                produtosVendidos[id]
                    .valor +=
                    quantidade *
                    preco;

            });

        });


    const ranking =
        Object.values(
            produtosVendidos
        )
        .sort(
            (a, b) =>
                b.quantidade -
                a.quantidade
        )
        .slice(0, 5);


    if (ranking.length === 0) {

        topProductsContainer.innerHTML = `

            <div class="empty-state">

                <i class="fa-solid fa-box-open"></i>

                <p>
                    Nenhuma venda registrada.
                </p>

            </div>

        `;

        return;

    }


    topProductsContainer.innerHTML =
        ranking.map(
            (produto, index) => {

                return `

                    <div
                        style="
                            display:flex;
                            align-items:center;
                            gap:12px;
                            padding:14px 0;
                            border-bottom:1px solid rgba(255,255,255,.07);
                        "
                    >

                        <div
                            style="
                                width:32px;
                                height:32px;
                                min-width:32px;
                                display:flex;
                                align-items:center;
                                justify-content:center;
                                border-radius:50%;
                                background:rgba(212,175,55,.09);
                                color:#d4af37;
                                font-size:11px;
                                font-weight:700;
                            "
                        >
                            ${index + 1}
                        </div>


                        <div
                            style="
                                min-width:0;
                                flex:1;
                            "
                        >

                            <strong
                                style="
                                    display:block;
                                    overflow:hidden;
                                    text-overflow:ellipsis;
                                    white-space:nowrap;
                                    font-size:12px;
                                "
                            >
                                ${escaparHTML(
                                    produto.nome
                                )}
                            </strong>


                            <span
                                style="
                                    display:block;
                                    margin-top:4px;
                                    color:#707785;
                                    font-size:10px;
                                "
                            >
                                ${
                                    produto.quantidade
                                }
                                ${
                                    produto.quantidade === 1
                                        ? "unidade"
                                        : "unidades"
                                }
                                vendidas
                            </span>

                        </div>


                        <strong
                            style="
                                white-space:nowrap;
                                font-size:11px;
                            "
                        >
                            ${formatarMoeda(
                                produto.valor
                            )}
                        </strong>

                    </div>

                `;

            }
        ).join("");

}


/* =========================================
   ESTOQUE BAIXO
========================================= */

function atualizarEstoqueBaixo() {

    if (!lowStockContainer) {
        return;
    }

    const produtos =
        carregarProdutos();


    const produtosBaixoEstoque =
        produtos
            .filter(produto => {

                const estoque =
                    Number(
                        produto.estoque || 0
                    );

                return (
                    estoque > 0 &&
                    estoque <=
                    ESTOQUE_BAIXO_LIMITE
                );

            })
            .sort(
                (a, b) =>
                    Number(
                        a.estoque || 0
                    ) -
                    Number(
                        b.estoque || 0
                    )
            )
            .slice(0, 5);


    if (
        produtosBaixoEstoque.length === 0
    ) {

        lowStockContainer.innerHTML = `

            <div class="empty-state">

                <i class="fa-solid fa-box"></i>

                <p>
                    Nenhum produto com estoque baixo.
                </p>

            </div>

        `;

        return;

    }


    lowStockContainer.innerHTML =
        produtosBaixoEstoque
            .map(
                produto => {

                    const estoque =
                        Number(
                            produto.estoque || 0
                        );


                    return `

                        <div
                            class="dashboard-stock-item"
                            data-produto-id="${escaparHTML(
                                produto.id || ""
                            )}"
                            data-produto-nome="${escaparHTML(
                                produto.nome || ""
                            )}"
                            style="
                                display:flex;
                                align-items:center;
                                justify-content:space-between;
                                gap:15px;
                                padding:14px 0;
                                border-bottom:1px solid rgba(255,255,255,.07);
                                cursor:pointer;
                            "
                            title="Clique para abrir este produto"
                        >

                            <div
                                style="
                                    min-width:0;
                                    flex:1;
                                "
                            >

                                <strong
                                    style="
                                        display:block;
                                        overflow:hidden;
                                        text-overflow:ellipsis;
                                        white-space:nowrap;
                                        font-size:12px;
                                    "
                                >
                                    ${escaparHTML(
                                        produto.nome
                                    )}
                                </strong>


                                <span
                                    style="
                                        display:block;
                                        margin-top:4px;
                                        color:#707785;
                                        font-size:10px;
                                    "
                                >
                                    Estoque atual
                                </span>

                            </div>


                            <div
                                style="
                                    text-align:right;
                                    white-space:nowrap;
                                "
                            >

                                <strong
                                    style="
                                        color:#e5a83b;
                                        font-size:13px;
                                    "
                                >
                                    ${estoque}
                                    ${
                                        estoque === 1
                                            ? " unidade"
                                            : " unidades"
                                    }
                                </strong>


                                <span
                                    style="
                                        display:block;
                                        margin-top:3px;
                                        color:#707785;
                                        font-size:9px;
                                    "
                                >
                                    Reposição necessária
                                </span>

                            </div>

                        </div>

                    `;

                }
            )
            .join("");

    configurarLinksEstoque();

}


/* =========================================
   GRÁFICO
========================================= */


/*
    Remove o horário de uma data.
*/
function dataSemHorario(data) {

    const novaData =
        new Date(data);

    novaData.setHours(
        0,
        0,
        0,
        0
    );

    return novaData;

}


/*
    Cria uma chave de data.
*/
function chaveData(data) {

    const ano =
        data.getFullYear();

    const mes =
        String(
            data.getMonth() + 1
        ).padStart(2, "0");

    const dia =
        String(
            data.getDate()
        ).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;

}


/*
    Cria o período do gráfico.
*/
function atualizarGrafico(periodo = 7) {

    if (!salesChartContainer) {
        return;
    }


    const quantidadeDias =
        Number(periodo);


    const hoje =
        dataSemHorario(
            new Date()
        );


    const dataInicial =
        new Date(hoje);


    dataInicial.setDate(
        dataInicial.getDate() -
        (
            quantidadeDias -
            1
        )
    );


    const vendasPorDia = {};

    const datas = [];


    /*
        Cria todos os dias.
    */
    for (
        let data =
            new Date(dataInicial);

        data <= hoje;

        data.setDate(
            data.getDate() + 1
        )
    ) {

        const dataAtual =
            new Date(data);

        const chave =
            chaveData(
                dataAtual
            );


        vendasPorDia[chave] = 0;

        datas.push(
            dataAtual
        );

    }


    /*
        Carrega pedidos.
    */
    const pedidos =
        carregarPedidos();


    /*
        Apenas pedidos concluídos
        entram no gráfico.
    */
    pedidos
        .filter(
            pedido =>
                pedido.status ===
                "completed"
        )
        .forEach(pedido => {

            if (!pedido.criadoEm) {
                return;
            }


            const dataPedido =
                dataSemHorario(
                    pedido.criadoEm
                );


            if (
                dataPedido <
                    dataInicial ||
                dataPedido >
                    hoje
            ) {

                return;

            }


            const chave =
                chaveData(
                    dataPedido
                );


            if (
                vendasPorDia[chave] !==
                undefined
            ) {

                vendasPorDia[chave] +=
                    Number(
                        pedido.total || 0
                    );

            }

        });


    const valores =
        Object.values(
            vendasPorDia
        );


    const maiorVenda =
        Math.max(
            ...valores,
            0
        );


    /*
        Verifica se existe venda.
    */
    const possuiVenda =
        valores.some(
            valor =>
                valor > 0
        );


    if (!possuiVenda) {

        salesChartContainer.innerHTML = `

            <div class="chart-empty">

                <i class="fa-solid fa-chart-column"></i>

                <p>
                    Nenhuma venda concluída.
                </p>

                <span>
                    As vendas concluídas aparecerão aqui.
                </span>

            </div>

        `;

        return;

    }


    /*
        Cria as barras.
    */
    const barras =
        datas.map(data => {

            const chave =
                chaveData(data);


            const valor =
                vendasPorDia[chave] || 0;


            let altura = 0;


            if (
                maiorVenda > 0 &&
                valor > 0
            ) {

                altura =
                    (
                        valor /
                        maiorVenda
                    ) * 100;


                altura =
                    Math.max(
                        altura,
                        8
                    );

            }


            const label =
                data.toLocaleDateString(
                    "pt-BR",
                    {
                        day: "2-digit",
                        month: "2-digit"
                    }
                );


            return `

                <div
                    style="
                        flex:1;
                        min-width:24px;
                        height:245px;
                        display:flex;
                        flex-direction:column;
                        align-items:center;
                        justify-content:flex-end;
                        gap:6px;
                    "
                    title="${formatarMoeda(
                        valor
                    )}"
                >

                    <span
                        style="
                            height:15px;
                            color:#a7adb9;
                            font-size:9px;
                            white-space:nowrap;
                        "
                    >
                        ${
                            valor > 0
                                ? formatarMoeda(
                                    valor
                                )
                                : ""
                        }
                    </span>


                    <div
                        style="
                            width:70%;
                            max-width:40px;
                            height:185px;
                            display:flex;
                            align-items:flex-end;
                        "
                    >

                        <div
                            style="
                                width:100%;
                                height:${altura}%;
                                min-height:${
                                    valor > 0
                                        ? "5px"
                                        : "0"
                                };
                                border-radius:6px 6px 2px 2px;
                                background:#d4af37;
                                transition:height .3s ease;
                            "
                        ></div>

                    </div>


                    <span
                        style="
                            color:#707785;
                            font-size:9px;
                            white-space:nowrap;
                        "
                    >
                        ${label}
                    </span>

                </div>

            `;

        }).join("");


    /*
        Para períodos maiores,
        permitimos rolagem horizontal.
    */
    const larguraMinima =
        quantidadeDias <= 7
            ? "100%"
            : `${quantidadeDias * 28}px`;


    salesChartContainer.innerHTML = `

        <div
            style="
                width:100%;
                overflow-x:auto;
                overflow-y:hidden;
                padding-bottom:8px;
            "
        >

            <div
                style="
                    min-width:${larguraMinima};
                    height:265px;
                    display:flex;
                    align-items:flex-end;
                    gap:7px;
                    padding:0 8px;
                "
            >

                ${barras}

            </div>

        </div>

    `;

}


/* =========================================
   ATUALIZAR DASHBOARD
========================================= */

function atualizarDashboard() {

    atualizarCards();

    atualizarPedidosRecentes();

    atualizarProdutosMaisVendidos();

    atualizarEstoqueBaixo();


    const periodo =
        salesPeriod
            ? salesPeriod.value
            : 7;


    atualizarGrafico(
        periodo
    );

}


/* =========================================
   FILTRO DO GRÁFICO
========================================= */

if (salesPeriod) {

    salesPeriod.addEventListener(
        "change",
        function () {

            atualizarGrafico(
                salesPeriod.value
            );

        }
    );

}


/* =========================================
   NOTIFICAÇÕES
========================================= */

if (notificationButton) {

    notificationButton.addEventListener(
        "click",
        function () {

            const pedidos =
                carregarPedidos();


            const pendentes =
                pedidos.filter(
                    pedido =>
                        pedido.status ===
                        "pending"
                );


            if (
                pendentes.length > 0
            ) {

                alert(
                    `Você possui ${pendentes.length} pedido(s) pendente(s).`
                );

            } else {

                alert(
                    "Você não possui novas notificações."
                );

            }

        }
    );

}


/* =========================================
   ATUALIZAÇÃO AUTOMÁTICA
========================================= */


/*
    Atualiza quando outra página
    modifica o localStorage.
*/
window.addEventListener(
    "storage",
    function (event) {

        if (
            event.key ===
                PRODUTOS_STORAGE_KEY ||
            event.key ===
                PEDIDOS_STORAGE_KEY
        ) {

            atualizarDashboard();

        }

    }
);


/*
    Atualiza quando o usuário
    volta para a aba.
*/
document.addEventListener(
    "visibilitychange",
    function () {

        if (
            document.visibilityState ===
            "visible"
        ) {

            atualizarDashboard();

        }

    }
);


/*
    Atualização de segurança
    a cada 30 segundos.
*/
setInterval(
    atualizarDashboard,
    30000
);


/* =========================================
   TECLA ESC
========================================= */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape"
        ) {

            fecharSidebar();

        }

    }
);


/* =========================================
   REDIMENSIONAMENTO
========================================= */

window.addEventListener(
    "resize",
    function () {

        if (
            window.innerWidth > 950
        ) {

            fecharSidebar();

        }

    }
);


/* =========================================
   INICIALIZAÇÃO
========================================= */

function iniciarDashboard() {

    console.log(
        "BarberFlow Admin iniciado."
    );

    console.log(
        "Dashboard carregado."
    );

    atualizarDashboard();

}


/* =========================================
   INICIAR
========================================= */

iniciarDashboard();