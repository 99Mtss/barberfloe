(() => {
    "use strict";

    const LOW_STOCK_LIMIT = 5;
    const CATEGORIES = {
        pomadas: "Pomadas e Finalizadores",
        "cuidados-capilares": "Cuidados Capilares",
        "cuidados-com-barba": "Cuidados com a Barba",
        shampoo: "Cuidados Capilares",
        barba: "Cuidados com a Barba"
    };
    const ORDER_STATUSES = {
        pending: "Pendente",
        confirmed: "Confirmado",
        completed: "Concluído",
        cancelled: "Cancelado"
    };

    const page = document.body.dataset.adminPage;
    const notice = document.querySelector("#admin-notice");
    let products = [];
    let orders = [];

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showNotice(message, type = "success") {
        if (!notice) return;
        notice.textContent = message;
        notice.className = `admin-notice is-${type}`;
        notice.hidden = false;
    }

    function formatPrice(value) {
        const amount = Number(value);
        return Number.isFinite(amount)
            ? amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            : "—";
    }

    function normalizeCategory(value) {
        const normalized = String(value || "")
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

        return aliases[normalized] || normalized;
    }

    function categoryLabel(value) {
        const key = normalizeCategory(value);
        return CATEGORIES[key] || String(value || "Outros");
    }

    function getClient() {
        if (!window.barberflow || !window.barberflow.isConfigured) {
            throw new Error("O Supabase ainda não está configurado.");
        }
        return window.barberflow.client;
    }

    function fromProductRow(row) {
        return {
            id: row.id,
            nome: row.name,
            categoria: row.category,
            preco: Number(row.price),
            estoque: Number(row.stock),
            status: row.status,
            imagem: row.image_url || "",
            descricao: row.description || "",
            promocaoPercentual: Number(row.promotion_percent) || null,
            promocaoInicio: row.promotion_starts_at || "",
            promocaoFim: row.promotion_ends_at || ""
        };
    }

    async function fetchProducts() {
        const { data, error } = await getClient()
            .from("products")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data.map(fromProductRow);
    }

    async function persistProduct(product, id) {
        const record = {
            name: product.nome,
            category: product.categoria,
            price: product.preco,
            stock: product.estoque,
            status: product.status,
            image_url: product.imagem,
            description: product.descricao,
            promotion_percent: product.promocaoPercentual ?? null,
            promotion_starts_at: product.promocaoInicio || null,
            promotion_ends_at: product.promocaoFim || null
        };
        const query = id
            ? getClient().from("products").update(record).eq("id", id)
            : getClient().from("products").insert(record);
        const { data, error } = await query.select("*").single();
        if (error) throw error;
        return fromProductRow(data);
    }

    function showOperationError(action, error) {
        console.error(`${action}:`, error);
        showNotice(`${action}. ${error.message || "Verifique sua conexão e tente novamente."}`, "error");
    }

    function getProductImageField() {
        return document.querySelector("#product-image-url");
    }

    function getProductImageFileInput() {
        return document.querySelector("#product-image-file");
    }

    function renderProductImagePreview(imageSource) {
        const preview = document.querySelector("#product-image-preview");
        const previewImage = document.querySelector("#product-image-preview-img");
        if (!preview || !previewImage) return;
        if (!imageSource) {
            preview.hidden = true;
            previewImage.src = "";
            return;
        }
        preview.hidden = false;
        previewImage.src = imageSource;
    }

    function clearProductImage() {
        const hidden = getProductImageField();
        const input = getProductImageFileInput();
        if (hidden) hidden.value = "";
        if (input) input.value = "";
        renderProductImagePreview("");
    }

    function readImageAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type || !file.type.startsWith("image/")) {
                reject(new Error("Selecione um arquivo de imagem válido."));
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                reject(new Error("A imagem deve ter no máximo 5 MB."));
                return;
            }

            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("Não foi possível ler a imagem do dispositivo."));
            reader.readAsDataURL(file);
        });
    }

    function getProduct(id) {
        return products.find(product => String(product.id) === String(id));
    }

    function renderProducts() {
        const body = document.querySelector("#products-table-body");
        const empty = document.querySelector("#products-empty");
        const search = document.querySelector("#product-search");
        if (!body || !empty) return;

        const query = search.value.trim().toLocaleLowerCase("pt-BR");
        const filtered = products.filter(product =>
            `${product.nome || ""} ${categoryLabel(product.categoria)}`
                .toLocaleLowerCase("pt-BR")
                .includes(query)
        );

        document.querySelector("#products-count").textContent =
            `${products.length} ${products.length === 1 ? "produto cadastrado" : "produtos cadastrados"}`;
        empty.hidden = filtered.length !== 0;
        empty.querySelector("strong").textContent = products.length === 0
            ? "Nenhum produto cadastrado"
            : "Nenhum produto encontrado";
        empty.querySelector("span").textContent = products.length === 0
            ? "Use o formulário acima para adicionar o primeiro produto."
            : "Tente buscar por outro nome ou categoria.";
        body.innerHTML = filtered.map(product => {
            const active = product.status === "active";
            const stock = Number(product.estoque);
            const stockClass = stock <= 0 ? "is-out" : stock <= LOW_STOCK_LIMIT ? "is-low" : "";
            return `
                <tr>
                    <td class="admin-product-name">${escapeHTML(product.nome || "Produto sem nome")}</td>
                    <td>${escapeHTML(categoryLabel(product.categoria))}</td>
                    <td>${formatPrice(product.preco)}</td>
                    <td><span class="admin-stock-value ${stockClass}">${Number.isFinite(stock) ? stock : 0}</span></td>
                    <td><span class="admin-order-status ${active ? "is-complete" : "is-cancelled"}">${active ? "Ativo" : "Inativo"}</span></td>
                    <td><div class="admin-row-actions">
                        <button class="admin-icon-button" type="button" data-edit-product="${escapeHTML(product.id)}" aria-label="Editar ${escapeHTML(product.nome || "produto")}" title="Editar"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
                        <button class="admin-icon-button" type="button" data-toggle-product="${escapeHTML(product.id)}" aria-label="${active ? "Desativar" : "Ativar"} ${escapeHTML(product.nome || "produto")}" title="${active ? "Desativar produto" : "Ativar produto"}"><i class="fa-solid ${active ? "fa-eye-slash" : "fa-eye"}" aria-hidden="true"></i></button>
                        <button class="admin-icon-button is-danger" type="button" data-delete-product="${escapeHTML(product.id)}" aria-label="Excluir ${escapeHTML(product.nome || "produto")}" title="Excluir"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
                    </div></td>
                </tr>
            `;
        }).join("");
    }

    function resetProductForm() {
        const form = document.querySelector("#product-form");
        form.reset();
        form.elements.namedItem("id").value = "";
        form.elements.namedItem("estoque").value = "0";
        form.elements.namedItem("status").value = "active";
        form.elements.namedItem("imagem").value = "";
        clearProductImage();
        document.querySelector("#product-form-title").textContent = "Novo produto";
        document.querySelector("#product-cancel-edit").hidden = true;
        form.elements.namedItem("nome").focus();
    }

    function startProductEdit(product) {
        const form = document.querySelector("#product-form");
        form.elements.namedItem("id").value = product.id;
        form.elements.namedItem("nome").value = product.nome || "";
        form.elements.namedItem("categoria").value = normalizeCategory(product.categoria);
        form.elements.namedItem("preco").value = product.preco ?? "";
        form.elements.namedItem("estoque").value = product.estoque ?? 0;
        form.elements.namedItem("status").value = product.status === "inactive" ? "inactive" : "active";
        form.elements.namedItem("imagem").value = product.imagem || "";
        renderProductImagePreview(product.imagem || "");
        form.elements.namedItem("descricao").value = product.descricao || "";
        document.querySelector("#product-form-title").textContent = "Editar produto";
        document.querySelector("#product-cancel-edit").hidden = false;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        form.elements.namedItem("nome").focus({ preventScroll: true });
    }

    function initProducts() {
        const form = document.querySelector("#product-form");
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const fields = form.elements;
            const price = Number(fields.namedItem("preco").value);
            const stock = Number(fields.namedItem("estoque").value);
            if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
                showNotice("Informe um preço maior que zero e uma quantidade inteira igual ou maior que zero.", "error");
                return;
            }

            const id = fields.namedItem("id").value;
            const existing = id ? getProduct(id) : null;
            const product = {
                nome: fields.namedItem("nome").value.trim(),
                categoria: fields.namedItem("categoria").value,
                preco: price,
                estoque: stock,
                status: fields.namedItem("status").value,
                imagem: fields.namedItem("imagem").value.trim(),
                descricao: fields.namedItem("descricao").value.trim(),
                promocaoPercentual: existing ? existing.promocaoPercentual : null,
                promocaoInicio: existing ? existing.promocaoInicio : "",
                promocaoFim: existing ? existing.promocaoFim : ""
            };
            const submitButton = form.querySelector('[type="submit"]');
            submitButton.disabled = true;
            try {
                const saved = await persistProduct(product, id || null);
                products = existing
                    ? products.map(item => String(item.id) === String(id) ? saved : item)
                    : [saved, ...products];
                renderProducts();
                resetProductForm();
                showNotice(existing ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.");
            } catch (error) {
                showOperationError("Não foi possível salvar o produto", error);
            } finally {
                submitButton.disabled = false;
            }
        });

        document.querySelector("#product-cancel-edit").addEventListener("click", resetProductForm);
        document.querySelector("#product-image-clear").addEventListener("click", clearProductImage);
        document.querySelector("#product-image-file").addEventListener("change", async event => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            try {
                const imageUrl = await readImageAsDataUrl(file);
                getProductImageField().value = imageUrl;
                renderProductImagePreview(imageUrl);
            } catch (error) {
                showOperationError("Não foi possível carregar a imagem", error);
                clearProductImage();
            }
        });
        document.querySelector("#product-search").addEventListener("input", renderProducts);
        document.querySelector("#products-table-body").addEventListener("click", async event => {
            const editButton = event.target.closest("[data-edit-product]");
            const toggleButton = event.target.closest("[data-toggle-product]");
            const deleteButton = event.target.closest("[data-delete-product]");
            if (editButton) {
                const product = getProduct(editButton.dataset.editProduct);
                if (product) startProductEdit(product);
            } else if (toggleButton) {
                const product = getProduct(toggleButton.dataset.toggleProduct);
                if (!product) return;
                try {
                    const updated = await persistProduct({
                        ...product,
                        status: product.status === "active" ? "inactive" : "active"
                    }, product.id);
                    products = products.map(item =>
                        String(item.id) === String(updated.id) ? updated : item
                    );
                    renderProducts();
                    showNotice("Status do produto atualizado.");
                } catch (error) {
                    showOperationError("Não foi possível atualizar o status do produto", error);
                }
            } else if (deleteButton) {
                const product = getProduct(deleteButton.dataset.deleteProduct);
                if (!product || !window.confirm(`Excluir "${product.nome}" do catálogo?`)) return;
                try {
                    const { error } = await getClient()
                        .from("products")
                        .delete()
                        .eq("id", product.id);
                    if (error) throw error;
                    products = products.filter(item => String(item.id) !== String(product.id));
                    renderProducts();
                    showNotice("Produto excluído do catálogo.");
                } catch (error) {
                    showOperationError("Não foi possível excluir o produto", error);
                }
            }
        });
        renderProducts();
    }

    function renderStock() {
        const body = document.querySelector("#stock-table-body");
        const empty = document.querySelector("#stock-empty");
        if (!body || !empty) return;
        const query = document.querySelector("#stock-search").value.trim().toLocaleLowerCase("pt-BR");
        const filtered = products.filter(product =>
            `${product.nome || ""} ${categoryLabel(product.categoria)}`
                .toLocaleLowerCase("pt-BR")
                .includes(query)
        );
        const quantities = products.map(product => {
            const value = Number(product.estoque);
            return Number.isFinite(value) && value >= 0 ? value : 0;
        });
        document.querySelector("#stock-product-count").textContent = String(products.length);
        document.querySelector("#stock-unit-count").textContent = String(quantities.reduce((sum, value) => sum + value, 0));
        document.querySelector("#stock-low-count").textContent = String(quantities.filter(value => value > 0 && value <= LOW_STOCK_LIMIT).length);
        document.querySelector("#stock-out-count").textContent = String(quantities.filter(value => value === 0).length);
        empty.hidden = products.length !== 0;
        body.innerHTML = filtered.map(product => {
            const quantity = Number(product.estoque);
            const stock = Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
            const level = stock === 0
                ? ["Sem estoque", "is-out"]
                : stock <= LOW_STOCK_LIMIT
                    ? ["Estoque baixo", "is-low"]
                    : ["Disponível", "is-complete"];
            return `
                <tr>
                    <td class="admin-product-name">${escapeHTML(product.nome || "Produto sem nome")}</td>
                    <td>${escapeHTML(categoryLabel(product.categoria))}</td>
                    <td><strong class="admin-stock-value ${level[1]}">${stock}</strong></td>
                    <td><span class="admin-order-status ${level[1]}">${level[0]}</span></td>
                    <td><form class="admin-stock-adjust" data-stock-form="${escapeHTML(product.id)}">
                        <label class="sr-only" for="stock-${escapeHTML(product.id)}">Nova quantidade para ${escapeHTML(product.nome || "produto")}</label>
                        <input id="stock-${escapeHTML(product.id)}" name="quantity" type="number" min="0" step="1" value="${stock}" required>
                        <button class="admin-button admin-button-compact" type="submit" aria-label="Salvar estoque de ${escapeHTML(product.nome || "produto")}"><i class="fa-solid fa-check" aria-hidden="true"></i><span>Salvar</span></button>
                    </form></td>
                </tr>
            `;
        }).join("");
        if (products.length > 0 && filtered.length === 0) {
            empty.hidden = false;
            empty.querySelector("strong").textContent = "Nenhum produto encontrado";
            empty.querySelector("span").textContent = "Tente buscar por outro nome ou categoria.";
            empty.querySelector("a").hidden = true;
        } else {
            empty.querySelector("strong").textContent = "Nenhum produto cadastrado";
            empty.querySelector("span").textContent = "Cadastre produtos para controlar o estoque.";
            empty.querySelector("a").hidden = false;
        }
    }

    function initStock() {
        document.querySelector("#stock-search").addEventListener("input", renderStock);
        document.querySelector("#stock-table-body").addEventListener("submit", async event => {
            const form = event.target.closest("[data-stock-form]");
            if (!form) return;
            event.preventDefault();
            const input = form.elements.namedItem("quantity");
            const quantity = Number(input.value);
            if (!Number.isInteger(quantity) || quantity < 0) {
                showNotice("A quantidade deve ser um número inteiro igual ou maior que zero.", "error");
                return;
            }
            const id = form.dataset.stockForm;
            const button = form.querySelector("button");
            button.disabled = true;
            try {
                const { data, error } = await getClient()
                    .from("products")
                    .update({ stock: quantity })
                    .eq("id", id)
                    .select("*")
                    .single();
                if (error) throw error;
                const updated = fromProductRow(data);
                products = products.map(product =>
                    String(product.id) === String(id) ? updated : product
                );
                renderStock();
                renderProducts();
                showNotice("Estoque atualizado. A disponibilidade na loja também foi atualizada.");
            } catch (error) {
                showOperationError("Não foi possível atualizar o estoque", error);
            } finally {
                button.disabled = false;
            }
        });
        renderStock();
    }

    function orderDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Data indisponível";
        return new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }

    function orderItemSummary(order) {
        const items = Array.isArray(order.itens) ? order.itens : [];
        const count = items.reduce((sum, item) => {
            const quantity = Number(item.quantidade);
            return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
        }, 0);
        return `${count} ${count === 1 ? "item" : "itens"}`;
    }

    function renderOrders() {
        const body = document.querySelector("#orders-table-body");
        const empty = document.querySelector("#orders-empty");
        if (!body || !empty) return;

        document.querySelector("#orders-total-count").textContent = String(orders.length);
        document.querySelector("#orders-pending-count").textContent = String(orders.filter(order => order.status === "pending").length);
        document.querySelector("#orders-completed-count").textContent = String(orders.filter(order => order.status === "completed").length);
        document.querySelector("#orders-cancelled-count").textContent = String(orders.filter(order => order.status === "cancelled").length);

        const query = document.querySelector("#order-search").value.trim().toLocaleLowerCase("pt-BR");
        const selectedStatus = document.querySelector("#order-status-filter").value;
        const filtered = orders.filter(order => {
            const name = order.cliente && order.cliente.nome ? order.cliente.nome : "";
            const matchesQuery = `${order.id || ""} ${name}`.toLocaleLowerCase("pt-BR").includes(query);
            const matchesStatus = selectedStatus === "all" || order.status === selectedStatus;
            return matchesQuery && matchesStatus;
        });
        empty.hidden = filtered.length !== 0;
        body.innerHTML = filtered.map(order => {
            const status = Object.prototype.hasOwnProperty.call(ORDER_STATUSES, order.status)
                ? order.status
                : "pending";
            const options = Object.entries(ORDER_STATUSES).map(([value, label]) =>
                `<option value="${value}"${value === status ? " selected" : ""}>${label}</option>`
            ).join("");
            return `
                <tr>
                    <td class="admin-order-id">${escapeHTML(order.id || "Sem identificação")}</td>
                    <td class="admin-product-name">${escapeHTML(order.cliente && order.cliente.nome || "Cliente")}</td>
                    <td>${orderItemSummary(order)}</td>
                    <td>${escapeHTML(orderDate(order.criadoEm))}</td>
                    <td>${formatPrice(order.total)}</td>
                    <td><label class="sr-only" for="order-${escapeHTML(order.dbId)}">Status do pedido ${escapeHTML(order.id)}</label>
                        <select class="admin-order-select" id="order-${escapeHTML(order.dbId)}" data-order-status="${escapeHTML(order.dbId)}">${options}</select>
                    </td>
                </tr>
            `;
        }).join("");
    }

    async function initOrders() {
        const { data, error } = await getClient()
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        orders = data.map(order => ({
            dbId: order.id,
            id: order.order_code,
            cliente: { nome: order.customer_name },
            itens: order.items,
            total: Number(order.total),
            status: order.status,
            criadoEm: order.created_at
        }));
        document.querySelector("#order-search").addEventListener("input", renderOrders);
        document.querySelector("#order-status-filter").addEventListener("change", renderOrders);
        document.querySelector("#orders-table-body").addEventListener("change", async event => {
            const select = event.target.closest("[data-order-status]");
            if (!select) return;
            const id = select.dataset.orderStatus;
            select.disabled = true;
            try {
                const { data: updated, error: updateError } = await getClient()
                    .from("orders")
                    .update({ status: select.value })
                    .eq("id", id)
                    .select("*")
                    .single();
                if (updateError) throw updateError;
                orders = orders.map(order => String(order.dbId) === String(id)
                    ? {
                        ...order,
                        status: updated.status,
                        total: Number(updated.total),
                        criadoEm: updated.created_at
                    }
                    : order
                );
                renderOrders();
                showNotice("Status do pedido atualizado.");
            } catch (error) {
                showOperationError("Não foi possível atualizar o pedido", error);
                renderOrders();
            }
        });
        renderOrders();
    }

    async function initialize() {
        if (!await window.barberflowAdminReady) return;
        products = await fetchProducts();

        if (page === "produtos") {
            initProducts();
            renderProducts();
        } else if (page === "estoque") {
            initStock();
        } else if (page === "pedidos") {
            await initOrders();
        }

        const client = getClient();
        const channel = client.channel(`admin-${page}-updates`)
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "products"
            }, async () => {
                try {
                    products = await fetchProducts();
                    renderProducts();
                    renderStock();
                } catch (error) {
                    showOperationError("Não foi possível sincronizar os produtos", error);
                }
            });

        if (page === "pedidos") {
            channel.on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "orders"
            }, async () => {
                try {
                    const { data, error } = await client
                        .from("orders")
                        .select("*")
                        .order("created_at", { ascending: false });
                    if (error) throw error;
                    orders = data.map(order => ({
                        dbId: order.id,
                        id: order.order_code,
                        cliente: { nome: order.customer_name },
                        itens: order.items,
                        total: Number(order.total),
                        status: order.status,
                        criadoEm: order.created_at
                    }));
                    renderOrders();
                } catch (error) {
                    showOperationError("Não foi possível sincronizar os pedidos", error);
                }
            });
        }

        channel.subscribe();
    }

    initialize().catch(error => {
        showOperationError("Não foi possível carregar os dados do painel", error);
    });
})();
