(() => {
    "use strict";

    const currency = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "—";
        return new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }

    function statusLabel(status) {
        const labels = {
            pending: ["Pendente", "is-pending"],
            confirmed: ["Confirmado", "is-pending"],
            completed: ["Concluído", "is-complete"],
            cancelled: ["Cancelado", "is-cancelled"]
        };
        return labels[status] || ["Pendente", "is-pending"];
    }

    function renderChart(orders) {
        const container = document.querySelector("#dashboard-chart-bars");
        const today = new Date();
        const days = [];

        for (let offset = 6; offset >= 0; offset--) {
            const date = new Date(today);
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - offset);
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            const count = orders.filter(order => {
                const created = new Date(order.created_at);
                return created >= date && created < nextDate;
            }).length;
            days.push({
                label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
                    .format(date)
                    .replace(".", ""),
                count
            });
        }

        const max = Math.max(1, ...days.map(day => day.count));
        container.innerHTML = days.map(day => {
            const height = day.count === 0 ? 3 : Math.max(12, (day.count / max) * 92);
            return `<div class="admin-chart-column" title="${day.count} ${day.count === 1 ? "pedido" : "pedidos"}">
                <span style="--bar-height: ${height}%"></span>
                <small>${escapeHTML(day.label)}</small>
            </div>`;
        }).join("");
    }

    async function renderDashboard() {
        const client = window.barberflow.client;
        const [productResult, orderResult] = await Promise.all([
            client.from("products").select("status, stock"),
            client.from("orders")
                .select("id, order_code, customer_name, total, status, created_at")
                .order("created_at", { ascending: false })
        ]);
        if (productResult.error) throw productResult.error;
        if (orderResult.error) throw orderResult.error;

        const products = productResult.data;
        const orders = orderResult.data;
        const now = new Date();
        const monthOrders = orders.filter(order => {
            const date = new Date(order.created_at);
            return date.getFullYear() === now.getFullYear()
                && date.getMonth() === now.getMonth();
        });
        const monthTotal = monthOrders
            .filter(order => order.status !== "cancelled")
            .reduce((sum, order) => sum + Number(order.total), 0);

        document.querySelector("#dashboard-month-total").textContent = currency.format(monthTotal);
        document.querySelector("#dashboard-order-count").textContent = String(monthOrders.length);
        document.querySelector("#dashboard-product-count").textContent = String(
            products.filter(product => product.status === "active").length
        );
        document.querySelector("#dashboard-low-stock").textContent = String(
            products.filter(product => product.status === "active" && Number(product.stock) <= 5).length
        );

        const tableBody = document.querySelector("#dashboard-recent-orders");
        tableBody.innerHTML = orders.slice(0, 4).map(order => {
            const [label, statusClass] = statusLabel(order.status);
            return `<tr>
                <td class="admin-order-id">${escapeHTML(order.order_code)}</td>
                <td>${escapeHTML(order.customer_name)}</td>
                <td>${escapeHTML(formatDate(order.created_at))}</td>
                <td>${currency.format(Number(order.total))}</td>
                <td><span class="admin-order-status ${statusClass}">${label}</span></td>
            </tr>`;
        }).join("");
        if (orders.length === 0) {
            tableBody.innerHTML = '<tr><td class="admin-empty-row" colspan="5">Ainda não há pedidos registrados.</td></tr>';
        }

        renderChart(orders);
    }

    (async () => {
        if (!await window.barberflowAdminReady) return;
        try {
            await renderDashboard();
            const refresh = () => {
                renderDashboard().catch(error => {
                    console.error("Erro ao atualizar a visão geral:", error);
                });
            };
            window.barberflow.client.channel("dashboard-updates")
                .on("postgres_changes", { event: "*", schema: "public", table: "products" }, refresh)
                .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refresh)
                .subscribe();
        } catch (error) {
            console.error("Erro ao carregar a visão geral:", error);
            const tableBody = document.querySelector("#dashboard-recent-orders");
            tableBody.innerHTML = '<tr><td class="admin-empty-row" colspan="5">Não foi possível carregar os dados. Tente atualizar a página.</td></tr>';
        }
    })();
})();
