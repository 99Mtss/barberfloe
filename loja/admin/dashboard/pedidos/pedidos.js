/* =========================================================
   BARBERFLOW - PEDIDOS
   ========================================================= */

const PEDIDOS_STORAGE_KEY = "barberflow_pedidos";
const PRODUTOS_STORAGE_KEY = "barberflow_produtos";

let pedidos = [];
let pedidoSelecionado = null;


/* =========================================================
   ELEMENTOS
   ========================================================= */

const ordersTable = document.getElementById("orders-table");
const emptyOrders = document.getElementById("empty-orders");

const totalOrders = document.getElementById("total-orders");
const pendingOrders = document.getElementById("pending-orders");
const processingOrders = document.getElementById("processing-orders");
const completedOrders = document.getElementById("completed-orders");

const ordersCount = document.getElementById("orders-count");

const searchOrder = document.getElementById("search-order");
const statusFilter = document.getElementById("status-filter");
const periodFilter = document.getElementById("period-filter");

const orderModal = document.getElementById("order-modal");
const closeOrderModal = document.getElementById("close-order-modal");

const modalOrderId = document.getElementById("modal-order-id");
const detailCustomer = document.getElementById("detail-customer");
const detailStatus = document.getElementById("detail-status");
const detailTotal = document.getElementById("detail-total");
const detailDate = document.getElementById("detail-date");
const orderItems = document.getElementById("order-items");

const saveStatusButton = document.getElementById("save-status");

const menuButton = document.getElementById("menu-button");
const closeSidebar = document.getElementById("close-sidebar");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");

const notificationButton = document.getElementById(
    "notification-button"
);


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    carregarPedidos();

    renderizarPedidos();

    atualizarEstatisticas();

    configurarEventos();

    abrirPedidoDaURL();

});


/* =========================================================
   CARREGAR PEDIDOS
   ========================================================= */

function carregarPedidos() {

    try {

        const dados = localStorage.getItem(
            PEDIDOS_STORAGE_KEY
        );

        if (!dados) {
            pedidos = [];
            return;
        }

        const dadosConvertidos = JSON.parse(dados);

        pedidos = Array.isArray(dadosConvertidos)
            ? dadosConvertidos
            : [];

    } catch (erro) {

        console.error(
            "Erro ao carregar pedidos:",
            erro
        );

        pedidos = [];

    }

}


/* =========================================================
   SALVAR PEDIDOS
   ========================================================= */

function salvarPedidos() {

    try {

        localStorage.setItem(
            PEDIDOS_STORAGE_KEY,
            JSON.stringify(pedidos)
        );

    } catch (erro) {

        console.error(
            "Erro ao salvar pedidos:",
            erro
        );

        alert(
            "Não foi possível salvar as alterações."
        );

    }

}


/* =========================================================
   RENDERIZAR PEDIDOS
   ========================================================= */

function renderizarPedidos() {

    const pedidosFiltrados =
        obterPedidosFiltrados();

    ordersTable.innerHTML = "";

    ordersCount.textContent =
        `${pedidosFiltrados.length} ${
            pedidosFiltrados.length === 1
                ? "pedido"
                : "pedidos"
        }`;


    if (pedidosFiltrados.length === 0) {

        emptyOrders.style.display = "flex";

        return;

    }


    emptyOrders.style.display = "none";


    pedidosFiltrados.forEach(pedido => {

        const tr =
            document.createElement("tr");

        const quantidadeProdutos =
            calcularQuantidadeItens(pedido);

        const status =
            obterStatusPedido(
                pedido.status
            );

        tr.innerHTML = `

            <td>

                <span class="order-id">
                    ${escaparHTML(
                        pedido.id || "-"
                    )}
                </span>

            </td>


            <td>

                <span class="customer-name">
                    ${escaparHTML(
                        pedido.cliente?.nome ||
                        "Cliente"
                    )}
                </span>

            </td>


            <td>

                <span class="products-count">

                    ${quantidadeProdutos}

                    ${
                        quantidadeProdutos === 1
                            ? "produto"
                            : "produtos"
                    }

                </span>

            </td>


            <td>

                <span class="order-price">
                    ${formatarPreco(
                        pedido.total
                    )}
                </span>

            </td>


            <td>

                <span class="order-date-cell">

                    ${formatarData(
                        pedido.criadoEm
                    )}

                </span>

            </td>


            <td>

                <span
                    class="status-badge ${status.classe}"
                >

                    ${status.nome}

                </span>

            </td>


            <td>

                <div class="order-actions">

                    <button
                        class="action-button"
                        title="Ver pedido"
                        data-action="view"
                        data-id="${escaparHTML(
                            pedido.id
                        )}"
                    >

                        <i class="fa-solid fa-eye"></i>

                    </button>

                </div>

            </td>

        `;


        ordersTable.appendChild(tr);

    });

}


/* =========================================================
   FILTRAR PEDIDOS
   ========================================================= */

function obterPedidosFiltrados() {

    const busca =
        searchOrder.value
            .trim()
            .toLowerCase();

    const statusSelecionado =
        statusFilter.value;

    const periodoSelecionado =
        periodFilter.value;


    let resultado = [...pedidos];


    /* BUSCA */

    if (busca) {

        resultado =
            resultado.filter(pedido => {

                const id =
                    String(
                        pedido.id || ""
                    ).toLowerCase();

                const nome =
                    String(
                        pedido.cliente?.nome || ""
                    ).toLowerCase();

                return (
                    id.includes(busca) ||
                    nome.includes(busca)
                );

            });

    }


    /* STATUS */

    if (
        statusSelecionado !== "all"
    ) {

        resultado =
            resultado.filter(
                pedido =>
                    obterStatusNormalizado(
                        pedido.status
                    ) === statusSelecionado
            );

    }


    /* PERÍODO */

    if (
        periodoSelecionado !== "all"
    ) {

        resultado =
            resultado.filter(
                pedido =>
                    pedidoDentroDoPeriodo(
                        pedido,
                        periodoSelecionado
                    )
            );

    }


    /* MAIS RECENTES PRIMEIRO */

    resultado.sort((a, b) => {

        const dataA =
            new Date(
                a.criadoEm || 0
            ).getTime();

        const dataB =
            new Date(
                b.criadoEm || 0
            ).getTime();

        return dataB - dataA;

    });


    return resultado;

}


/* =========================================================
   VERIFICAR PERÍODO
   ========================================================= */

function pedidoDentroDoPeriodo(
    pedido,
    periodo
) {

    if (!pedido.criadoEm) {
        return false;
    }


    const dataPedido =
        new Date(pedido.criadoEm);


    if (
        Number.isNaN(
            dataPedido.getTime()
        )
    ) {

        return false;

    }


    const agora = new Date();


    if (periodo === "today") {

        return (
            dataPedido.getDate() ===
                agora.getDate() &&

            dataPedido.getMonth() ===
                agora.getMonth() &&

            dataPedido.getFullYear() ===
                agora.getFullYear()
        );

    }


    const dias =
        Number(periodo);


    if (!dias) {
        return true;
    }


    const limite =
        new Date(agora);


    limite.setDate(
        limite.getDate() - dias
    );


    return dataPedido >= limite;

}


/* =========================================================
   ESTATÍSTICAS
   ========================================================= */

function atualizarEstatisticas() {

    const total =
        pedidos.length;


    const pendentes =
        pedidos.filter(
            pedido =>
                obterStatusNormalizado(
                    pedido.status
                ) === "pending"
        ).length;


    const andamento =
        pedidos.filter(
            pedido =>
                obterStatusNormalizado(
                    pedido.status
                ) === "processing"
        ).length;


    const concluidos =
        pedidos.filter(
            pedido =>
                obterStatusNormalizado(
                    pedido.status
                ) === "completed"
        ).length;


    totalOrders.textContent =
        total;

    pendingOrders.textContent =
        pendentes;

    processingOrders.textContent =
        andamento;

    completedOrders.textContent =
        concluidos;

}


/* =========================================================
   ABRIR PEDIDO
   ========================================================= */

function abrirDetalhesPedido(id) {

    const pedido =
        pedidos.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!pedido) {

        alert(
            "Pedido não encontrado."
        );

        return;

    }


    pedidoSelecionado =
        pedido;


    modalOrderId.textContent =
        `Pedido #${pedido.id || "-"}`;


    detailCustomer.textContent =
        pedido.cliente?.nome ||
        "Cliente";


    detailStatus.value =
        obterStatusNormalizado(
            pedido.status
        );


    detailTotal.textContent =
        formatarPreco(
            pedido.total
        );


    detailDate.textContent =
        formatarDataCompleta(
            pedido.criadoEm
        );


    renderizarItensPedido(
        pedido
    );


    orderModal.classList.add(
        "active"
    );


    document.body.style.overflow =
        "hidden";

}


/* =========================================================
   ABRIR PEDIDO PELA URL
   ========================================================= */

function abrirPedidoDaURL() {

    const parametros =
        new URLSearchParams(
            window.location.search
        );

    const pedidoId =
        parametros.get("pedido");


    if (!pedidoId) {
        return;
    }


    const pedidoExiste =
        pedidos.some(
            pedido =>
                String(pedido.id) ===
                String(pedidoId)
        );


    if (!pedidoExiste) {

        alert(
            "O pedido selecionado não foi encontrado."
        );

        return;

    }


    abrirDetalhesPedido(
        pedidoId
    );

}


/* =========================================================
   RENDERIZAR ITENS
   ========================================================= */

function renderizarItensPedido(
    pedido
) {

    orderItems.innerHTML = "";


    if (
        !Array.isArray(
            pedido.itens
        ) ||
        pedido.itens.length === 0
    ) {

        orderItems.innerHTML = `

            <div class="order-item">

                <div class="order-item-info">

                    <strong>
                        Nenhum produto informado
                    </strong>

                    <span>
                        Este pedido não possui
                        itens registrados.
                    </span>

                </div>

            </div>

        `;

        return;

    }


    pedido.itens.forEach(item => {

        const quantidade =
            Number(
                item.quantidade || 1
            );


        const preco =
            Number(
                item.preco || 0
            );


        const subtotal =
            preco * quantidade;


        const imagem =
            item.imagem ||
            "https://via.placeholder.com/80x80?text=Produto";


        const div =
            document.createElement(
                "div"
            );


        div.className =
            "order-item";


        div.innerHTML = `

            <img
                class="order-item-image"
                src="${escaparAtributo(
                    imagem
                )}"
                alt="${escaparAtributo(
                    item.nome ||
                    "Produto"
                )}"
                onerror="
                    this.src='https://via.placeholder.com/80x80?text=Produto'
                "
            >


            <div class="order-item-info">

                <strong>
                    ${escaparHTML(
                        item.nome ||
                        "Produto"
                    )}
                </strong>

                <span>
                    ${quantidade}x
                    ${formatarPreco(
                        preco
                    )}
                </span>

            </div>


            <span class="order-item-price">

                ${formatarPreco(
                    subtotal
                )}

            </span>

        `;


        orderItems.appendChild(
            div
        );

    });

}


/* =========================================================
   ATUALIZAR STATUS
   ========================================================= */

function atualizarStatusPedido() {

    if (!pedidoSelecionado) {
        return;
    }


    const novoStatus =
        obterStatusNormalizado(
            detailStatus.value
        );


    const indice =
        pedidos.findIndex(
            pedido =>
                String(pedido.id) ===
                String(
                    pedidoSelecionado.id
                )
        );


    if (indice === -1) {

        alert(
            "Pedido não encontrado."
        );

        return;

    }


    const statusAnterior =
        obterStatusNormalizado(
            pedidos[indice].status
        );


    /* Nada mudou */

    if (
        statusAnterior ===
        novoStatus
    ) {

        fecharModalPedido();

        return;

    }


    /*
       Se estava cancelado e voltou
       para um status ativo:
       retira novamente do estoque.
    */

    if (
        statusAnterior ===
            "cancelled" &&
        novoStatus !==
            "cancelled"
    ) {

        const sucesso =
            alterarEstoqueDoPedido(
                pedidos[indice],
                "diminuir"
            );


        if (!sucesso) {

            return;

        }

    }


    /*
       Se estava ativo e foi cancelado:
       devolve os produtos ao estoque.
    */

    if (
        statusAnterior !==
            "cancelled" &&
        novoStatus ===
            "cancelled"
    ) {

        alterarEstoqueDoPedido(
            pedidos[indice],
            "aumentar"
        );

    }


    pedidos[indice].status =
        novoStatus;


    salvarPedidos();


    atualizarEstatisticas();

    renderizarPedidos();


    pedidoSelecionado =
        pedidos[indice];


    detailStatus.value =
        novoStatus;


    alert(
        "Status do pedido atualizado com sucesso!"
    );

}


/* =========================================================
   ALTERAR ESTOQUE DO PEDIDO
   ========================================================= */

function alterarEstoqueDoPedido(
    pedido,
    operacao
) {

    let produtos = [];


    try {

        const dados =
            localStorage.getItem(
                PRODUTOS_STORAGE_KEY
            );


        if (dados) {

            const convertidos =
                JSON.parse(dados);


            if (
                Array.isArray(
                    convertidos
                )
            ) {

                produtos =
                    convertidos;

            }

        }

    } catch (erro) {

        console.error(
            "Erro ao carregar estoque:",
            erro
        );

        alert(
            "Não foi possível atualizar o estoque."
        );

        return false;

    }


    if (
        !Array.isArray(
            pedido.itens
        )
    ) {

        return true;

    }


    /*
       Quando um pedido cancelado
       volta para ativo, verificamos
       se existe estoque suficiente.
    */

    if (
        operacao ===
        "diminuir"
    ) {

        for (
            const item of pedido.itens
        ) {

            const produto =
                produtos.find(
                    produto =>
                        String(
                            produto.id
                        ) ===
                        String(
                            item.id
                        )
                );


            if (!produto) {

                alert(
                    `O produto "${item.nome || "Produto"}" não foi encontrado no estoque.`
                );

                return false;

            }


            const estoqueAtual =
                Number(
                    produto.estoque || 0
                );


            const quantidade =
                Number(
                    item.quantidade || 0
                );


            if (
                estoqueAtual <
                quantidade
            ) {

                alert(
                    `Estoque insuficiente para "${produto.nome}".`
                );

                return false;

            }

        }

    }


    /*
       Agora efetivamente altera
       o estoque.
    */

    pedido.itens.forEach(
        item => {

            const produto =
                produtos.find(
                    produto =>
                        String(
                            produto.id
                        ) ===
                        String(
                            item.id
                        )
                );


            if (!produto) {
                return;
            }


            const quantidade =
                Number(
                    item.quantidade || 0
                );


            const estoqueAtual =
                Number(
                    produto.estoque || 0
                );


            if (
                operacao ===
                "diminuir"
            ) {

                produto.estoque =
                    Math.max(
                        0,
                        estoqueAtual -
                        quantidade
                    );

            } else {

                produto.estoque =
                    estoqueAtual +
                    quantidade;

            }

        }
    );


    try {

        localStorage.setItem(
            PRODUTOS_STORAGE_KEY,
            JSON.stringify(
                produtos
            )
        );

        return true;

    } catch (erro) {

        console.error(
            "Erro ao salvar estoque:",
            erro
        );

        alert(
            "Não foi possível salvar a alteração do estoque."
        );

        return false;

    }

}


/* =========================================================
   FECHAR MODAL
   ========================================================= */

function fecharModalPedido() {

    orderModal.classList.remove(
        "active"
    );

    document.body.style.overflow =
        "";

    pedidoSelecionado =
        null;

}


/* =========================================================
   EVENTOS
   ========================================================= */

function configurarEventos() {

    /* PESQUISA */

    searchOrder.addEventListener(
        "input",
        renderizarPedidos
    );


    /* FILTROS */

    statusFilter.addEventListener(
        "change",
        renderizarPedidos
    );


    periodFilter.addEventListener(
        "change",
        renderizarPedidos
    );


    /* AÇÕES DA TABELA */

    ordersTable.addEventListener(
        "click",
        evento => {

            const botao =
                evento.target.closest(
                    "[data-action]"
                );


            if (!botao) {
                return;
            }


            const id =
                botao.dataset.id;


            if (
                botao.dataset.action ===
                "view"
            ) {

                abrirDetalhesPedido(
                    id
                );

            }

        }
    );


    /* SALVAR STATUS */

    saveStatusButton.addEventListener(
        "click",
        atualizarStatusPedido
    );


    /* FECHAR MODAL */

    closeOrderModal.addEventListener(
        "click",
        fecharModalPedido
    );


    /* CLICAR FORA */

    orderModal.addEventListener(
        "click",
        evento => {

            if (
                evento.target ===
                orderModal
            ) {

                fecharModalPedido();

            }

        }
    );


    /* ESC */

    document.addEventListener(
        "keydown",
        evento => {

            if (
                evento.key ===
                "Escape"
            ) {

                fecharModalPedido();

                fecharMenuMobile();

            }

        }
    );


    /* MENU MOBILE */

    menuButton.addEventListener(
        "click",
        abrirMenuMobile
    );


    closeSidebar.addEventListener(
        "click",
        fecharMenuMobile
    );


    sidebarOverlay.addEventListener(
        "click",
        fecharMenuMobile
    );


    /* NOTIFICAÇÕES */

    notificationButton.addEventListener(
        "click",
        () => {

            const pendentes =
                pedidos.filter(
                    pedido =>
                        obterStatusNormalizado(
                            pedido.status
                        ) === "pending"
                ).length;


            if (
                pendentes > 0
            ) {

                alert(
                    `Você possui ${pendentes} ${
                        pendentes === 1
                            ? "pedido pendente"
                            : "pedidos pendentes"
                    }.`
                );

            } else {

                alert(
                    "Não há pedidos pendentes."
                );

            }

        }
    );


    /* STORAGE */

    window.addEventListener(
        "storage",
        evento => {

            if (
                evento.key ===
                PEDIDOS_STORAGE_KEY
            ) {

                carregarPedidos();

                atualizarEstatisticas();

                renderizarPedidos();

            }


            if (
                evento.key ===
                PRODUTOS_STORAGE_KEY
            ) {

                /* Apenas mantém
                   os dados sincronizados. */

            }

        }
    );


    /* VOLTAR PARA A PÁGINA */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                carregarPedidos();

                atualizarEstatisticas();

                renderizarPedidos();

            }

        }
    );

}


/* =========================================================
   MENU MOBILE
   ========================================================= */

function abrirMenuMobile() {

    sidebar.classList.add(
        "open"
    );

}


function fecharMenuMobile() {

    sidebar.classList.remove(
        "open"
    );

}


/* =========================================================
   STATUS
   ========================================================= */

function obterStatusNormalizado(
    status
) {

    const statusAtual =
        String(status || "")
            .toLowerCase()
            .trim();


    const statusPermitidos = [
        "pending",
        "processing",
        "completed",
        "cancelled"
    ];


    if (
        statusPermitidos.includes(
            statusAtual
        )
    ) {

        return statusAtual;

    }


    return "pending";

}


function obterStatusPedido(
    status
) {

    const statusNormalizado =
        obterStatusNormalizado(
            status
        );


    const statusMap = {

        pending: {
            nome: "Pendente",
            classe: "pending"
        },

        processing: {
            nome: "Em andamento",
            classe: "processing"
        },

        completed: {
            nome: "Concluído",
            classe: "completed"
        },

        cancelled: {
            nome: "Cancelado",
            classe: "cancelled"
        }

    };


    return statusMap[
        statusNormalizado
    ];

}


/* =========================================================
   QUANTIDADE DE PRODUTOS
   ========================================================= */

function calcularQuantidadeItens(
    pedido
) {

    if (
        !Array.isArray(
            pedido.itens
        )
    ) {

        return 0;

    }


    return pedido.itens.reduce(
        (total, item) => {

            return (
                total +
                Number(
                    item.quantidade || 0
                )
            );

        },
        0
    );

}


/* =========================================================
   FORMATAÇÃO DE PREÇO
   ========================================================= */

function formatarPreco(
    valor
) {

    const numero =
        Number(
            valor || 0
        );


    return numero.toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );

}


/* =========================================================
   FORMATAÇÃO DE DATA
   ========================================================= */

function formatarData(
    data
) {

    if (!data) {
        return "-";
    }


    const dataObj =
        new Date(data);


    if (
        Number.isNaN(
            dataObj.getTime()
        )
    ) {

        return "-";

    }


    return dataObj.toLocaleDateString(
        "pt-BR"
    );

}


function formatarDataCompleta(
    data
) {

    if (!data) {
        return "-";
    }


    const dataObj =
        new Date(data);


    if (
        Number.isNaN(
            dataObj.getTime()
        )
    ) {

        return "-";

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


/* =========================================================
   SEGURANÇA HTML
   ========================================================= */

function escaparHTML(
    valor
) {

    return String(
        valor ?? ""
    )
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


function escaparAtributo(
    valor
) {

    return escaparHTML(
        valor
    );

}