const CATEGORIES = [
  { id: "eletrica", label: "Elétrica" },
  { id: "mecanica", label: "Mecânica" },
  { id: "hidraulica", label: "Hidráulica" },
  { id: "pneumatica", label: "Pneumática" },
];

const STORAGE_KEY = "industrial-equipment-crm";
const SESSION_KEY = "industrial-equipment-crm-session";

const ROLE_LABELS = {
  admin: "Administrador",
  tecnico: "Técnico",
  consulta: "Consulta",
};

const ROLE_PERMISSIONS = {
  admin: { write: true, delete: true, manageUsers: true },
  tecnico: { write: true, delete: false, manageUsers: false },
  consulta: { write: false, delete: false, manageUsers: false },
};

const defaultData = {
  equipments: [
    {
      id: crypto.randomUUID(),
      name: "Prensa hidráulica 220T",
      manufacturer: "Atlas Industrial",
      model: "PH-220X",
      photo: "",
      specs:
        "Capacidade: 220 toneladas\nTensão: 380 V trifásico\nPressão nominal: 210 bar\nCurso útil: 500 mm",
      peripherals: {
        eletrica: [
          {
            id: crypto.randomUUID(),
            name: "Inversor de frequência",
            manufacturer: "WEG",
            model: "CFW500",
            photo: "",
            specs: "Potência: 15 cv\nEntrada: 380 V\nComunicação: Modbus RTU",
          },
        ],
        mecanica: [
          {
            id: crypto.randomUUID(),
            name: "Conjunto de guias lineares",
            manufacturer: "THK",
            model: "HSR35",
            photo: "",
            specs: "Carga dinâmica: 49 kN\nLubrificação: graxa industrial EP2",
          },
        ],
        hidraulica: [
          {
            id: crypto.randomUUID(),
            name: "Bomba hidráulica",
            manufacturer: "Parker",
            model: "PVP3336",
            photo: "",
            specs: "Vazão: 98 L/min\nPressão máxima: 250 bar\nRotação: 1800 rpm",
          },
        ],
        pneumatica: [],
      },
    },
  ],
  stockItems: [],
  preventives: [],
  correctives: [],
  users: [
    {
      id: crypto.randomUUID(),
      name: "Administrador",
      username: "admin",
      password: "admin123",
      role: "admin",
    },
  ],
};

let data = structuredClone(defaultData);
let state = {
  currentUserId: sessionStorage.getItem(SESSION_KEY),
  currentView: "equipments",
  selectedEquipmentId: null,
  selectedCategory: "eletrica",
  editingEquipmentId: null,
  editingComponent: null,
  editingStockId: null,
  editingPreventiveId: null,
  editingCorrectiveId: null,
  editingUserId: null,
};

const loginScreen = document.querySelector("#loginScreen");
const loginForm = document.querySelector("#loginForm");
const loginError = document.querySelector("#loginError");
const crmApp = document.querySelector("#crmApp");
const viewRoot = document.querySelector("#viewRoot");
const equipmentList = document.querySelector("#equipmentList");
const equipmentCount = document.querySelector("#equipmentCount");
const searchInput = document.querySelector("#searchInput");
const currentUserLabel = document.querySelector("#currentUserLabel");
const importInput = document.querySelector("#importInput");

const equipmentDialog = document.querySelector("#equipmentDialog");
const equipmentForm = document.querySelector("#equipmentForm");
const equipmentDialogTitle = document.querySelector("#equipmentDialogTitle");
const componentDialog = document.querySelector("#componentDialog");
const componentForm = document.querySelector("#componentForm");
const componentDialogTitle = document.querySelector("#componentDialogTitle");
const componentCategoryLabel = document.querySelector("#componentCategoryLabel");
const stockDialog = document.querySelector("#stockDialog");
const stockForm = document.querySelector("#stockForm");
const stockDialogTitle = document.querySelector("#stockDialogTitle");
const preventiveDialog = document.querySelector("#preventiveDialog");
const preventiveForm = document.querySelector("#preventiveForm");
const preventiveDialogTitle = document.querySelector("#preventiveDialogTitle");
const correctiveDialog = document.querySelector("#correctiveDialog");
const correctiveForm = document.querySelector("#correctiveForm");
const correctiveDialogTitle = document.querySelector("#correctiveDialogTitle");
const userDialog = document.querySelector("#userDialog");
const userForm = document.querySelector("#userForm");
const userDialogTitle = document.querySelector("#userDialogTitle");

function apiEnabled() {
  return ["http:", "https:"].includes(window.location.protocol);
}

async function loadData() {
  if (apiEnabled()) {
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      if (response.ok) {
        const remoteData = await response.json();
        if (remoteData) return normalizeData(remoteData);
      }
    } catch {
      // Fallback to browser storage when the static build is used without the Node API.
    }
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultData);

  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return normalizeData({ ...structuredClone(defaultData), equipments: parsed });
    }
    return normalizeData(parsed);
  } catch {
    return structuredClone(defaultData);
  }
}

function normalizeData(value) {
  const next = {
    equipments: Array.isArray(value.equipments) ? value.equipments : [],
    stockItems: Array.isArray(value.stockItems) ? value.stockItems : [],
    preventives: Array.isArray(value.preventives) ? value.preventives : [],
    correctives: Array.isArray(value.correctives) ? value.correctives : [],
    users: Array.isArray(value.users) && value.users.length ? value.users : structuredClone(defaultData.users),
  };

  next.equipments = next.equipments.map((equipment) => ({
    ...equipment,
    id: equipment.id || crypto.randomUUID(),
    criticalPoints: equipment.criticalPoints || "",
    peripherals: normalizePeripherals(equipment),
  }));
  next.stockItems = next.stockItems.map((item) => ({
    ...item,
    id: item.id || crypto.randomUUID(),
    category: item.category || "mecanica",
    quantity: Number(item.quantity || 0),
    minimum: Number(item.minimum || 0),
  }));
  next.preventives = next.preventives.map((item) => ({
    ...item,
    id: item.id || crypto.randomUUID(),
    materials: Array.isArray(item.materials) ? item.materials : [],
    materialsDeductedAt: item.materialsDeductedAt || "",
  }));
  next.correctives = next.correctives.map((item) => ({
    ...item,
    id: item.id || crypto.randomUUID(),
    materials: Array.isArray(item.materials) ? item.materials : [],
    materialsDeductedAt: item.materialsDeductedAt || "",
    openedAt: item.openedAt || new Date().toISOString(),
  }));
  return next;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (apiEnabled()) {
    fetch("/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {
      console.warn("Nao foi possivel salvar no servidor. Dados mantidos no navegador.");
    });
  }
}

function normalizePeripherals(equipment) {
  const current = equipment.peripherals || {};
  return {
    eletrica: current.eletrica || [],
    mecanica: current.mecanica || [],
    hidraulica: current.hidraulica || [],
    pneumatica: current.pneumatica || [],
  };
}

function currentUser() {
  return data.users.find((user) => user.id === state.currentUserId);
}

function can(permission) {
  const user = currentUser();
  return Boolean(user && ROLE_PERMISSIONS[user.role]?.[permission]);
}

function requirePermission(permission) {
  if (can(permission)) return true;
  alert("Seu usuário não tem permissão para esta ação.");
  return false;
}

function getSelectedEquipment() {
  return data.equipments.find((equipment) => equipment.id === state.selectedEquipmentId);
}

function getEquipment(id) {
  return data.equipments.find((equipment) => equipment.id === id);
}

function getUser(id) {
  return data.users.find((user) => user.id === id);
}

function getPreventiveResponsibleName(item) {
  return getUser(item.responsibleUserId)?.name || item.responsible || "Não definido";
}

function getCategoryLabel(id) {
  return CATEGORIES.find((category) => category.id === id)?.label || id;
}

function allComponents() {
  return data.equipments.flatMap((equipment) =>
    CATEGORIES.flatMap((category) =>
      (equipment.peripherals?.[category.id] || []).map((component) => ({
        ...component,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        categoryId: category.id,
        categoryLabel: category.label,
      })),
    ),
  );
}

function selectInitialEquipment() {
  if (!state.selectedEquipmentId && data.equipments.length > 0) {
    state.selectedEquipmentId = data.equipments[0].id;
  }
}

function boot() {
  const user = currentUser();
  if (!user) {
    state.currentUserId = null;
    sessionStorage.removeItem(SESSION_KEY);
    loginScreen.classList.remove("hidden");
    crmApp.classList.add("hidden");
    return;
  }

  loginScreen.classList.add("hidden");
  crmApp.classList.remove("hidden");
  currentUserLabel.textContent = `${user.name} · ${ROLE_LABELS[user.role]}`;
  selectInitialEquipment();
  render();
}

function render() {
  renderPermissions();
  renderNav();
  renderEquipmentList();
  renderCurrentView();
}

function renderPermissions() {
  document.querySelectorAll("[data-permission]").forEach((element) => {
    element.classList.toggle("hidden", !can(element.dataset.permission));
  });
}

function renderNav() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.currentView);
  });
}

function renderEquipmentList() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = data.equipments.filter((equipment) =>
    [equipment.name, equipment.manufacturer, equipment.model].join(" ").toLowerCase().includes(query),
  );

  equipmentCount.textContent = filtered.length;
  equipmentList.innerHTML = "";

  if (filtered.length === 0) {
    equipmentList.innerHTML = '<p class="empty-message">Nenhum equipamento encontrado.</p>';
    return;
  }

  filtered.forEach((equipment) => {
    const button = document.createElement("button");
    button.className = `equipment-item ${equipment.id === state.selectedEquipmentId ? "active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <strong>${escapeHtml(equipment.name)}</strong>
      <span>${escapeHtml(equipment.manufacturer)} · ${escapeHtml(equipment.model)}</span>
    `;
    button.addEventListener("click", () => {
      state.selectedEquipmentId = equipment.id;
      state.currentView = "equipments";
      render();
    });
    equipmentList.append(button);
  });
}

function renderCurrentView() {
  if (state.currentView === "products") return renderProductsView();
  if (state.currentView === "stock") return renderStockView();
  if (state.currentView === "preventives") return renderPreventivesView();
  if (state.currentView === "correctives") return renderCorrectivesView();
  if (state.currentView === "users") return can("manageUsers") ? renderUsersView() : renderEquipmentsView();
  return renderEquipmentsView();
}

function renderEquipmentsView() {
  const equipment = getSelectedEquipment();

  if (!equipment) {
    viewRoot.innerHTML = `
      <div class="empty-state">
        <h2>Nenhum equipamento selecionado</h2>
        <p>Cadastre uma máquina para organizar periféricos, estoque e preventivas.</p>
        ${can("write") ? '<button class="primary" type="button" data-action="new-equipment">Cadastrar equipamento</button>' : ""}
      </div>
    `;
    viewRoot.querySelector("[data-action='new-equipment']")?.addEventListener("click", openNewEquipment);
    return;
  }

  equipment.peripherals = normalizePeripherals(equipment);
  const activeCategory = CATEGORIES.find((category) => category.id === state.selectedCategory);
  const components = equipment.peripherals[state.selectedCategory] || [];

  viewRoot.innerHTML = `
    <article>
      <div class="detail-header">
        ${renderPhoto(equipment.photo, "Foto do equipamento")}
        <div class="detail-copy">
          <p class="eyebrow">Equipamento</p>
          <h2>${escapeHtml(equipment.name)}</h2>
          <div class="meta-row">
            <span>Fabricante: ${escapeHtml(equipment.manufacturer)}</span>
            <span>Modelo: ${escapeHtml(equipment.model)}</span>
          </div>
          <div class="detail-actions">
            ${can("write") ? '<button class="ghost" type="button" data-action="edit-equipment">Editar equipamento</button>' : ""}
            ${can("delete") ? '<button class="danger" type="button" data-action="delete-equipment">Excluir equipamento</button>' : ""}
          </div>
        </div>
      </div>

      <div class="spec-box">${escapeHtml(equipment.specs || "Sem especificações cadastradas.")}</div>
      <div class="spec-box critical-box"><strong>Pontos críticos:</strong><br>${escapeHtml(equipment.criticalPoints || "Nenhum ponto crítico cadastrado.")}</div>

      <nav class="category-tabs" aria-label="Categorias de periféricos">
        ${CATEGORIES.map(
          (category) => `
            <button class="tab-btn ${category.id === state.selectedCategory ? "active" : ""}"
              type="button"
              data-category="${category.id}">
              ${category.label} (${equipment.peripherals[category.id].length})
            </button>
          `,
        ).join("")}
      </nav>

      <section>
        <div class="category-header">
          <div>
            <p class="eyebrow">Periféricos</p>
            <h3>${activeCategory.label}</h3>
          </div>
          ${can("write") ? '<button class="primary" type="button" data-action="new-component">Novo produto</button>' : ""}
        </div>

        <div class="component-grid">
          ${
            components.length
              ? components.map((component) => renderComponentCard(component)).join("")
              : '<div class="empty-state compact"><h2>Nenhum produto cadastrado</h2><p>Adicione componentes, conjuntos ou itens de funcionamento para esta categoria.</p></div>'
          }
        </div>
      </section>
    </article>
  `;

  bindEquipmentViewActions();
}

function renderProductsView() {
  const query = document.querySelector("#productSearch")?.value || "";
  const category = document.querySelector("#productCategoryFilter")?.value || "all";
  const equipmentId = document.querySelector("#productEquipmentFilter")?.value || "all";
  const products = filterRows(allComponents(), query, ["name", "manufacturer", "model", "specs", "equipmentName"])
    .filter((item) => category === "all" || item.categoryId === category)
    .filter((item) => equipmentId === "all" || item.equipmentId === equipmentId);

  viewRoot.innerHTML = `
    <section class="view-stack">
      <div class="view-header">
        <div>
          <p class="eyebrow">Produtos</p>
          <h2>Pesquisa geral de produtos</h2>
        </div>
      </div>
      <div class="filter-bar">
        <input id="productSearch" type="search" placeholder="Pesquisar em todos os produtos..." value="${escapeAttr(query)}" />
        <select id="productCategoryFilter">
          <option value="all">Todas as categorias</option>
          ${CATEGORIES.map((item) => `<option value="${item.id}" ${item.id === category ? "selected" : ""}>${item.label}</option>`).join("")}
        </select>
        <select id="productEquipmentFilter">
          <option value="all">Todos os equipamentos</option>
          ${data.equipments.map((item) => `<option value="${item.id}" ${item.id === equipmentId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
        </select>
      </div>
      ${renderTable(
        ["Produto", "Fabricante", "Modelo", "Categoria", "Equipamento", "Especificações"],
        products.map((item) => [
          item.name,
          item.manufacturer,
          item.model,
          item.categoryLabel,
          item.equipmentName,
          item.specs || "-",
        ]),
      )}
    </section>
  `;

  bindLiveFilters(["productSearch", "productCategoryFilter", "productEquipmentFilter"], renderProductsView);
}

function renderStockView() {
  const query = document.querySelector("#stockSearch")?.value || "";
  const equipmentId = document.querySelector("#stockEquipmentFilter")?.value || "all";
  const category = document.querySelector("#stockCategoryFilter")?.value || "all";
  const items = filterRows(data.stockItems, query, ["name", "manufacturer", "model", "location", "specs"])
    .filter((item) => equipmentId === "all" || item.equipmentId === equipmentId)
    .filter((item) => category === "all" || item.category === category);

  viewRoot.innerHTML = `
    <section class="view-stack">
      <div class="view-header">
        <div>
          <p class="eyebrow">Estoque</p>
          <h2>Peças vinculadas aos equipamentos</h2>
        </div>
        ${can("write") ? '<button class="primary" type="button" data-action="new-stock">Nova peça</button>' : ""}
      </div>
      <div class="filter-bar">
        <input id="stockSearch" type="search" placeholder="Pesquisar peça, fabricante, código..." value="${escapeAttr(query)}" />
        <select id="stockEquipmentFilter">
          <option value="all">Todos os equipamentos</option>
          ${data.equipments.map((item) => `<option value="${item.id}" ${item.id === equipmentId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
        </select>
        <select id="stockCategoryFilter">
          <option value="all">Todas as categorias</option>
          ${CATEGORIES.map((item) => `<option value="${item.id}" ${item.id === category ? "selected" : ""}>${item.label}</option>`).join("")}
        </select>
      </div>
      <div class="card-table">
        ${items.length ? items.map(renderStockCard).join("") : renderEmptyLine("Nenhuma peça cadastrada no estoque.")}
      </div>
    </section>
  `;

  bindLiveFilters(["stockSearch", "stockEquipmentFilter", "stockCategoryFilter"], renderStockView);
  viewRoot.querySelector("[data-action='new-stock']")?.addEventListener("click", openNewStock);
  bindCardActions("edit-stock", openEditStock);
  bindCardActions("delete-stock", deleteStock);
}

function renderPreventivesView() {
  const query = document.querySelector("#preventiveSearch")?.value || "";
  const equipmentId = document.querySelector("#preventiveEquipmentFilter")?.value || "all";
  const status = document.querySelector("#preventiveStatusFilter")?.value || "all";
  const searchable = data.preventives.map((item) => ({
    ...item,
    responsibleName: getPreventiveResponsibleName(item),
  }));
  const items = filterRows(searchable, query, ["title", "frequency", "responsibleName", "notes", "status"])
    .filter((item) => equipmentId === "all" || item.equipmentId === equipmentId)
    .filter((item) => status === "all" || item.status === status)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));

  viewRoot.innerHTML = `
    <section class="view-stack">
      <div class="view-header">
        <div>
          <p class="eyebrow">Preventivas</p>
          <h2>Plano de manutenção preventiva</h2>
        </div>
        ${can("write") ? '<button class="primary" type="button" data-action="new-preventive">Nova preventiva</button>' : ""}
      </div>
      <div class="filter-bar">
        <input id="preventiveSearch" type="search" placeholder="Pesquisar preventiva..." value="${escapeAttr(query)}" />
        <select id="preventiveEquipmentFilter">
          <option value="all">Todos os equipamentos</option>
          ${data.equipments.map((item) => `<option value="${item.id}" ${item.id === equipmentId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
        </select>
        <select id="preventiveStatusFilter">
          <option value="all">Todos os status</option>
          ${["Pendente", "Em andamento", "Concluída"].map((item) => `<option value="${item}" ${item === status ? "selected" : ""}>${item}</option>`).join("")}
        </select>
      </div>
      <div class="card-table">
        ${items.length ? items.map(renderPreventiveCard).join("") : renderEmptyLine("Nenhuma preventiva cadastrada.")}
      </div>
    </section>
  `;

  bindLiveFilters(["preventiveSearch", "preventiveEquipmentFilter", "preventiveStatusFilter"], renderPreventivesView);
  viewRoot.querySelector("[data-action='new-preventive']")?.addEventListener("click", openNewPreventive);
  bindCardActions("complete-preventive", completePreventive);
  bindCardActions("edit-preventive", openEditPreventive);
  bindCardActions("delete-preventive", deletePreventive);
}

function renderCorrectivesView() {
  const query = document.querySelector("#correctiveSearch")?.value || "";
  const equipmentId = document.querySelector("#correctiveEquipmentFilter")?.value || "all";
  const status = document.querySelector("#correctiveStatusFilter")?.value || "all";
  const searchable = data.correctives.map((item) => ({
    ...item,
    responsibleName: getPreventiveResponsibleName(item),
  }));
  const items = filterRows(searchable, query, ["title", "criticalPoint", "responsibleName", "notes", "status"])
    .filter((item) => equipmentId === "all" || item.equipmentId === equipmentId)
    .filter((item) => status === "all" || item.status === status)
    .sort((a, b) => String(b.openedAt).localeCompare(String(a.openedAt)));

  viewRoot.innerHTML = `
    <section class="view-stack">
      <div class="view-header">
        <div>
          <p class="eyebrow">Corretivas</p>
          <h2>Ordens corretivas e pontos críticos</h2>
        </div>
        ${can("write") ? '<button class="primary" type="button" data-action="new-corrective">Nova corretiva</button>' : ""}
      </div>
      <div class="filter-bar">
        <input id="correctiveSearch" type="search" placeholder="Pesquisar corretiva, ponto crítico, responsável..." value="${escapeAttr(query)}" />
        <select id="correctiveEquipmentFilter">
          <option value="all">Todos os equipamentos</option>
          ${data.equipments.map((item) => `<option value="${item.id}" ${item.id === equipmentId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
        </select>
        <select id="correctiveStatusFilter">
          <option value="all">Todos os status</option>
          ${["Aberta", "Em andamento", "Concluída"].map((item) => `<option value="${item}" ${item === status ? "selected" : ""}>${item}</option>`).join("")}
        </select>
      </div>
      <div class="card-table">
        ${items.length ? items.map(renderCorrectiveCard).join("") : renderEmptyLine("Nenhuma corretiva cadastrada.")}
      </div>
    </section>
  `;

  bindLiveFilters(["correctiveSearch", "correctiveEquipmentFilter", "correctiveStatusFilter"], renderCorrectivesView);
  viewRoot.querySelector("[data-action='new-corrective']")?.addEventListener("click", openNewCorrective);
  bindCardActions("complete-corrective", completeCorrective);
  bindCardActions("edit-corrective", openEditCorrective);
  bindCardActions("delete-corrective", deleteCorrective);
}

function renderUsersView() {
  viewRoot.innerHTML = `
    <section class="view-stack">
      <div class="view-header">
        <div>
          <p class="eyebrow">Usuários</p>
          <h2>Login e permissões</h2>
        </div>
        <button class="primary" type="button" data-action="new-user">Novo usuário</button>
      </div>
      ${renderTable(
        ["Nome", "Usuário", "Permissão", "Ações"],
        data.users.map((user) => [
          escapeHtml(user.name),
          escapeHtml(user.username),
          escapeHtml(ROLE_LABELS[user.role]),
          `<button class="ghost small" type="button" data-action="edit-user" data-id="${user.id}">Editar</button>
           <button class="danger small" type="button" data-action="delete-user" data-id="${user.id}">Excluir</button>`,
        ]),
        true,
      )}
    </section>
  `;
  viewRoot.querySelector("[data-action='new-user']").addEventListener("click", openNewUser);
  bindCardActions("edit-user", openEditUser);
  bindCardActions("delete-user", deleteUser);
}

function renderPhoto(photo, fallback) {
  if (!photo) return `<div class="photo-frame"><span class="photo-placeholder">${fallback}</span></div>`;
  return `<div class="photo-frame"><img src="${photo}" alt="${fallback}" /></div>`;
}

function renderComponentCard(component) {
  return `
    <article class="component-card">
      ${renderPhoto(component.photo, "Foto do produto")}
      <div>
        <h4>${escapeHtml(component.name)}</h4>
        <p>${escapeHtml(component.manufacturer)} · ${escapeHtml(component.model)}</p>
      </div>
      <div class="component-specs">${escapeHtml(component.specs || "Sem especificações cadastradas.")}</div>
      <div class="card-actions">
        ${can("write") ? `<button class="ghost" type="button" data-action="edit-component" data-id="${component.id}">Editar</button>` : ""}
        ${can("delete") ? `<button class="danger" type="button" data-action="delete-component" data-id="${component.id}">Excluir</button>` : ""}
      </div>
    </article>
  `;
}

function renderStockCard(item) {
  const equipment = getEquipment(item.equipmentId);
  const low = Number(item.quantity) <= Number(item.minimum);
  return `
    <article class="record-card ${low ? "is-low" : ""}">
      ${renderPhoto(item.photo, "Foto da peça")}
      <div class="record-main">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.manufacturer)} · ${escapeHtml(item.model)}</p>
        <p>Categoria: ${escapeHtml(getCategoryLabel(item.category))}</p>
        <p>Equipamento: ${escapeHtml(equipment?.name || "Não encontrado")}</p>
        <p>Local: ${escapeHtml(item.location || "-")}</p>
        <div class="meta-row">
          <span>Qtd: ${Number(item.quantity)}</span>
          <span>Mínimo: ${Number(item.minimum)}</span>
          ${low ? "<span>Reposição necessária</span>" : ""}
        </div>
        <div class="component-specs">${escapeHtml(item.specs || "")}</div>
      </div>
      <div class="card-actions">
        ${can("write") ? `<button class="ghost" type="button" data-action="edit-stock" data-id="${item.id}">Editar</button>` : ""}
        ${can("delete") ? `<button class="danger" type="button" data-action="delete-stock" data-id="${item.id}">Excluir</button>` : ""}
      </div>
    </article>
  `;
}

function renderPreventiveCard(item) {
  const equipment = getEquipment(item.equipmentId);
  const isDone = item.status === "Concluída";
  return `
    <article class="record-card">
      <div class="date-block">
        <strong>${formatDate(item.dueDate)}</strong>
        <span>${escapeHtml(item.frequency)}</span>
      </div>
      <div class="record-main">
        <h3>${escapeHtml(item.title)}</h3>
        <p>Equipamento: ${escapeHtml(equipment?.name || "Não encontrado")}</p>
        <p>Responsável: ${escapeHtml(getPreventiveResponsibleName(item))}</p>
        <div class="meta-row">
          <span>${escapeHtml(item.status)}</span>
          ${item.completedAt ? `<span>Concluída em: ${escapeHtml(formatDateTime(item.completedAt))}</span>` : ""}
          ${item.completedByUserId ? `<span>Por: ${escapeHtml(getUser(item.completedByUserId)?.name || "-")}</span>` : ""}
        </div>
        <div class="component-specs">${escapeHtml(item.notes || "")}</div>
        ${renderMaterialsSummary(item.materials)}
      </div>
      <div class="card-actions">
        ${canCompletePreventive(item) && !isDone ? `<button class="primary" type="button" data-action="complete-preventive" data-id="${item.id}">Confirmar conclusão</button>` : ""}
        ${can("write") ? `<button class="ghost" type="button" data-action="edit-preventive" data-id="${item.id}">Editar</button>` : ""}
        ${can("delete") ? `<button class="danger" type="button" data-action="delete-preventive" data-id="${item.id}">Excluir</button>` : ""}
      </div>
    </article>
  `;
}

function renderCorrectiveCard(item) {
  const equipment = getEquipment(item.equipmentId);
  const isDone = item.status === "Concluída";
  return `
    <article class="record-card">
      <div class="date-block">
        <strong>${escapeHtml(formatDateTime(item.openedAt))}</strong>
        <span>Aberta</span>
      </div>
      <div class="record-main">
        <h3>${escapeHtml(item.title)}</h3>
        <p>Equipamento: ${escapeHtml(equipment?.name || "Não encontrado")}</p>
        <p>Responsável: ${escapeHtml(getPreventiveResponsibleName(item))}</p>
        <p>Ponto crítico: ${escapeHtml(item.criticalPoint || "-")}</p>
        <div class="meta-row">
          <span>${escapeHtml(item.status)}</span>
          ${item.completedAt ? `<span>Concluída em: ${escapeHtml(formatDateTime(item.completedAt))}</span>` : ""}
          ${item.materialsDeductedAt ? `<span>Estoque baixado em: ${escapeHtml(formatDateTime(item.materialsDeductedAt))}</span>` : ""}
        </div>
        <div class="component-specs">${escapeHtml(item.notes || "")}</div>
        ${renderMaterialsSummary(item.materials)}
      </div>
      <div class="card-actions">
        ${canCompleteCorrective(item) && !isDone ? `<button class="primary" type="button" data-action="complete-corrective" data-id="${item.id}">Concluir e baixar estoque</button>` : ""}
        ${can("write") ? `<button class="ghost" type="button" data-action="edit-corrective" data-id="${item.id}">Editar</button>` : ""}
        ${can("delete") ? `<button class="danger" type="button" data-action="delete-corrective" data-id="${item.id}">Excluir</button>` : ""}
      </div>
    </article>
  `;
}

function renderMaterialsSummary(materials = []) {
  const valid = materials.filter((item) => item.stockItemId && Number(item.quantity) > 0);
  if (!valid.length) return "";
  return `
    <div class="material-summary">
      <strong>Materiais do estoque</strong>
      ${valid
        .map((material) => {
          const stock = data.stockItems.find((item) => item.id === material.stockItemId);
          return `<span>${escapeHtml(stock?.name || "Item removido")} · ${Number(material.quantity)} un.</span>`;
        })
        .join("")}
    </div>
  `;
}

function renderTable(headers, rows, allowHtml = false) {
  if (!rows.length) return renderEmptyLine("Nenhum registro encontrado.");
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows
            .map(
              (row) =>
                `<tr>${row.map((cell) => `<td>${allowHtml ? cell : escapeHtml(cell)}</td>`).join("")}</tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderEmptyLine(text) {
  return `<div class="empty-state compact"><h2>${escapeHtml(text)}</h2></div>`;
}

function bindEquipmentViewActions() {
  viewRoot.querySelector("[data-action='edit-equipment']")?.addEventListener("click", openEditEquipment);
  viewRoot.querySelector("[data-action='delete-equipment']")?.addEventListener("click", deleteEquipment);
  viewRoot.querySelector("[data-action='new-component']")?.addEventListener("click", openNewComponent);
  viewRoot.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCategory = button.dataset.category;
      renderEquipmentsView();
    });
  });
  bindCardActions("edit-component", openEditComponent);
  bindCardActions("delete-component", deleteComponent);
}

function bindCardActions(action, handler) {
  viewRoot.querySelectorAll(`[data-action='${action}']`).forEach((button) => {
    button.addEventListener("click", () => handler(button.dataset.id));
  });
}

function bindLiveFilters(ids, renderer) {
  ids.forEach((id) => {
    const element = document.querySelector(`#${id}`);
    element?.addEventListener("input", renderer);
  });
}

function filterRows(rows, query, keys) {
  const term = query.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) => keys.map((key) => row[key]).join(" ").toLowerCase().includes(term));
}

function openNewEquipment() {
  if (!requirePermission("write")) return;
  state.editingEquipmentId = null;
  equipmentDialogTitle.textContent = "Novo equipamento";
  equipmentForm.reset();
  equipmentDialog.showModal();
}

function openEditEquipment() {
  if (!requirePermission("write")) return;
  const equipment = getSelectedEquipment();
  if (!equipment) return;
  state.editingEquipmentId = equipment.id;
  equipmentDialogTitle.textContent = "Editar equipamento";
  setFormValues(equipmentForm, equipment);
  equipmentForm.elements.photo.value = "";
  equipmentDialog.showModal();
}

async function submitEquipment(event) {
  event.preventDefault();
  if (!requirePermission("write")) return;
  const formData = new FormData(equipmentForm);
  const existing = data.equipments.find((equipment) => equipment.id === state.editingEquipmentId);
  const photo = await fileToDataUrl(formData.get("photo"));
  const payload = {
    id: existing?.id || crypto.randomUUID(),
    name: formData.get("name").trim(),
    manufacturer: formData.get("manufacturer").trim(),
    model: formData.get("model").trim(),
    photo: photo || existing?.photo || "",
    specs: formData.get("specs").trim(),
    criticalPoints: formData.get("criticalPoints").trim(),
    peripherals: existing ? normalizePeripherals(existing) : createEmptyPeripherals(),
  };

  data.equipments = existing
    ? data.equipments.map((equipment) => (equipment.id === existing.id ? payload : equipment))
    : [payload, ...data.equipments];
  state.selectedEquipmentId = payload.id;
  saveData();
  equipmentDialog.close();
  render();
}

function deleteEquipment() {
  if (!requirePermission("delete")) return;
  const equipment = getSelectedEquipment();
  if (!equipment || !confirm(`Excluir "${equipment.name}" e todos os seus vínculos?`)) return;
  data.equipments = data.equipments.filter((item) => item.id !== equipment.id);
  data.stockItems = data.stockItems.filter((item) => item.equipmentId !== equipment.id);
  data.preventives = data.preventives.filter((item) => item.equipmentId !== equipment.id);
  data.correctives = data.correctives.filter((item) => item.equipmentId !== equipment.id);
  state.selectedEquipmentId = data.equipments[0]?.id || null;
  saveData();
  render();
}

function openNewComponent() {
  if (!requirePermission("write")) return;
  const category = CATEGORIES.find((item) => item.id === state.selectedCategory);
  state.editingComponent = null;
  componentCategoryLabel.textContent = category.label;
  componentDialogTitle.textContent = "Novo produto";
  componentForm.reset();
  componentDialog.showModal();
}

function openEditComponent(componentId) {
  if (!requirePermission("write")) return;
  const equipment = getSelectedEquipment();
  const component = equipment?.peripherals[state.selectedCategory].find((item) => item.id === componentId);
  if (!component) return;
  state.editingComponent = { categoryId: state.selectedCategory, componentId };
  componentCategoryLabel.textContent = getCategoryLabel(state.selectedCategory);
  componentDialogTitle.textContent = "Editar produto";
  setFormValues(componentForm, component);
  componentForm.elements.photo.value = "";
  componentDialog.showModal();
}

async function submitComponent(event) {
  event.preventDefault();
  if (!requirePermission("write")) return;
  const equipment = getSelectedEquipment();
  if (!equipment) return;
  const formData = new FormData(componentForm);
  const categoryId = state.editingComponent?.categoryId || state.selectedCategory;
  const existing = equipment.peripherals[categoryId].find(
    (component) => component.id === state.editingComponent?.componentId,
  );
  const photo = await fileToDataUrl(formData.get("photo"));
  const payload = {
    id: existing?.id || crypto.randomUUID(),
    name: formData.get("name").trim(),
    manufacturer: formData.get("manufacturer").trim(),
    model: formData.get("model").trim(),
    photo: photo || existing?.photo || "",
    specs: formData.get("specs").trim(),
  };

  equipment.peripherals[categoryId] = existing
    ? equipment.peripherals[categoryId].map((component) => (component.id === existing.id ? payload : component))
    : [payload, ...equipment.peripherals[categoryId]];
  saveData();
  componentDialog.close();
  render();
}

function deleteComponent(componentId) {
  if (!requirePermission("delete")) return;
  const equipment = getSelectedEquipment();
  if (!equipment || !confirm("Excluir este produto da categoria selecionada?")) return;
  equipment.peripherals[state.selectedCategory] = equipment.peripherals[state.selectedCategory].filter(
    (component) => component.id !== componentId,
  );
  saveData();
  render();
}

function openNewStock() {
  if (!requirePermission("write")) return;
  state.editingStockId = null;
  stockDialogTitle.textContent = "Nova peça";
  stockForm.reset();
  hydrateEquipmentSelect(stockForm.elements.equipmentId, state.selectedEquipmentId);
  hydrateComponentSelect(stockForm.elements.componentId, stockForm.elements.equipmentId.value);
  stockDialog.showModal();
}

function openEditStock(id) {
  if (!requirePermission("write")) return;
  const item = data.stockItems.find((stockItem) => stockItem.id === id);
  if (!item) return;
  state.editingStockId = id;
  stockDialogTitle.textContent = "Editar peça";
  hydrateEquipmentSelect(stockForm.elements.equipmentId, item.equipmentId);
  hydrateComponentSelect(stockForm.elements.componentId, item.equipmentId, item.componentId);
  setFormValues(stockForm, item);
  stockForm.elements.photo.value = "";
  stockDialog.showModal();
}

async function submitStock(event) {
  event.preventDefault();
  if (!requirePermission("write")) return;
  const formData = new FormData(stockForm);
  const existing = data.stockItems.find((item) => item.id === state.editingStockId);
  const photo = await fileToDataUrl(formData.get("photo"));
  const payload = {
    id: existing?.id || crypto.randomUUID(),
    equipmentId: formData.get("equipmentId"),
    componentId: formData.get("componentId"),
    category: formData.get("category"),
    name: formData.get("name").trim(),
    manufacturer: formData.get("manufacturer").trim(),
    model: formData.get("model").trim(),
    location: formData.get("location").trim(),
    quantity: Number(formData.get("quantity")),
    minimum: Number(formData.get("minimum")),
    photo: photo || existing?.photo || "",
    specs: formData.get("specs").trim(),
  };
  data.stockItems = existing
    ? data.stockItems.map((item) => (item.id === existing.id ? payload : item))
    : [payload, ...data.stockItems];
  saveData();
  stockDialog.close();
  renderStockView();
}

function deleteStock(id) {
  if (!requirePermission("delete")) return;
  if (!confirm("Excluir esta peça do estoque?")) return;
  data.stockItems = data.stockItems.filter((item) => item.id !== id);
  saveData();
  renderStockView();
}

function openNewPreventive() {
  if (!requirePermission("write")) return;
  state.editingPreventiveId = null;
  preventiveDialogTitle.textContent = "Nova preventiva";
  preventiveForm.reset();
  hydrateEquipmentSelect(preventiveForm.elements.equipmentId, state.selectedEquipmentId);
  hydrateUserSelect(preventiveForm.elements.responsibleUserId, currentUser()?.id);
  renderMaterialRows(document.querySelector("#preventiveMaterials"), []);
  preventiveDialog.showModal();
}

function openEditPreventive(id) {
  if (!requirePermission("write")) return;
  const item = data.preventives.find((preventive) => preventive.id === id);
  if (!item) return;
  state.editingPreventiveId = id;
  preventiveDialogTitle.textContent = "Editar preventiva";
  hydrateEquipmentSelect(preventiveForm.elements.equipmentId, item.equipmentId);
  hydrateUserSelect(preventiveForm.elements.responsibleUserId, item.responsibleUserId || currentUser()?.id);
  setFormValues(preventiveForm, item);
  renderMaterialRows(document.querySelector("#preventiveMaterials"), item.materials || []);
  preventiveDialog.showModal();
}

function submitPreventive(event) {
  event.preventDefault();
  if (!requirePermission("write")) return;
  const formData = new FormData(preventiveForm);
  const existing = data.preventives.find((item) => item.id === state.editingPreventiveId);
  const payload = {
    id: existing?.id || crypto.randomUUID(),
    equipmentId: formData.get("equipmentId"),
    title: formData.get("title").trim(),
    frequency: formData.get("frequency"),
    dueDate: formData.get("dueDate"),
    responsibleUserId: formData.get("responsibleUserId"),
    responsible: getUser(formData.get("responsibleUserId"))?.name || "",
    status: formData.get("status"),
    completedAt: existing?.completedAt || "",
    completedByUserId: existing?.completedByUserId || "",
    materials: collectMaterials(document.querySelector("#preventiveMaterials")),
    materialsDeductedAt: existing?.materialsDeductedAt || "",
    notes: formData.get("notes").trim(),
  };
  if (payload.status === "Concluída" && !payload.completedAt) {
    payload.completedAt = new Date().toISOString();
    payload.completedByUserId = currentUser()?.id || "";
  }
  if (payload.status !== "Concluída") {
    payload.completedAt = "";
    payload.completedByUserId = "";
    payload.materialsDeductedAt = "";
  }
  if (payload.status === "Concluída" && !payload.materialsDeductedAt && !applyMaterialUsage(payload)) {
    return;
  }
  data.preventives = existing
    ? data.preventives.map((item) => (item.id === existing.id ? payload : item))
    : [payload, ...data.preventives];
  saveData();
  preventiveDialog.close();
  renderPreventivesView();
}

function canCompletePreventive(item) {
  const user = currentUser();
  if (!user || item.status === "Concluída") return false;
  return user.role === "admin" || item.responsibleUserId === user.id || (!item.responsibleUserId && can("write"));
}

function completePreventive(id) {
  const item = data.preventives.find((preventive) => preventive.id === id);
  if (!item || !canCompletePreventive(item)) {
    alert("Somente o responsável indicado ou um administrador pode concluir esta preventiva.");
    return;
  }
  item.status = "Concluída";
  item.completedAt = new Date().toISOString();
  item.completedByUserId = currentUser()?.id || "";
  if (!applyMaterialUsage(item)) return;
  saveData();
  renderPreventivesView();
}

function deletePreventive(id) {
  if (!requirePermission("delete")) return;
  if (!confirm("Excluir esta preventiva?")) return;
  data.preventives = data.preventives.filter((item) => item.id !== id);
  saveData();
  renderPreventivesView();
}

function openNewCorrective() {
  if (!requirePermission("write")) return;
  state.editingCorrectiveId = null;
  correctiveDialogTitle.textContent = "Nova corretiva";
  correctiveForm.reset();
  hydrateEquipmentSelect(correctiveForm.elements.equipmentId, state.selectedEquipmentId);
  hydrateUserSelect(correctiveForm.elements.responsibleUserId, currentUser()?.id);
  correctiveForm.elements.openedAt.value = toDateTimeLocal(new Date());
  renderMaterialRows(document.querySelector("#correctiveMaterials"), []);
  correctiveDialog.showModal();
}

function openEditCorrective(id) {
  if (!requirePermission("write")) return;
  const item = data.correctives.find((corrective) => corrective.id === id);
  if (!item) return;
  state.editingCorrectiveId = id;
  correctiveDialogTitle.textContent = "Editar corretiva";
  hydrateEquipmentSelect(correctiveForm.elements.equipmentId, item.equipmentId);
  hydrateUserSelect(correctiveForm.elements.responsibleUserId, item.responsibleUserId || currentUser()?.id);
  setFormValues(correctiveForm, item);
  correctiveForm.elements.openedAt.value = toDateTimeLocal(item.openedAt || new Date());
  renderMaterialRows(document.querySelector("#correctiveMaterials"), item.materials || []);
  correctiveDialog.showModal();
}

function submitCorrective(event) {
  event.preventDefault();
  if (!requirePermission("write")) return;
  const formData = new FormData(correctiveForm);
  const existing = data.correctives.find((item) => item.id === state.editingCorrectiveId);
  const payload = {
    id: existing?.id || crypto.randomUUID(),
    equipmentId: formData.get("equipmentId"),
    responsibleUserId: formData.get("responsibleUserId"),
    responsible: getUser(formData.get("responsibleUserId"))?.name || "",
    title: formData.get("title").trim(),
    openedAt: formData.get("openedAt"),
    criticalPoint: formData.get("criticalPoint").trim(),
    status: formData.get("status"),
    notes: formData.get("notes").trim(),
    materials: collectMaterials(document.querySelector("#correctiveMaterials")),
    completedAt: existing?.completedAt || "",
    completedByUserId: existing?.completedByUserId || "",
    materialsDeductedAt: existing?.materialsDeductedAt || "",
  };
  if (payload.status === "Concluída" && !payload.completedAt) {
    payload.completedAt = new Date().toISOString();
    payload.completedByUserId = currentUser()?.id || "";
  }
  if (payload.status !== "Concluída") {
    payload.completedAt = "";
    payload.completedByUserId = "";
    payload.materialsDeductedAt = "";
  }
  if (payload.status === "Concluída" && !payload.materialsDeductedAt && !applyMaterialUsage(payload)) {
    return;
  }

  data.correctives = existing
    ? data.correctives.map((item) => (item.id === existing.id ? payload : item))
    : [payload, ...data.correctives];
  saveData();
  correctiveDialog.close();
  renderCorrectivesView();
}

function canCompleteCorrective(item) {
  const user = currentUser();
  if (!user || item.status === "Concluída") return false;
  return user.role === "admin" || item.responsibleUserId === user.id || (!item.responsibleUserId && can("write"));
}

function completeCorrective(id) {
  const item = data.correctives.find((corrective) => corrective.id === id);
  if (!item || !canCompleteCorrective(item)) {
    alert("Somente o responsável indicado ou um administrador pode concluir esta corretiva.");
    return;
  }
  if (!applyMaterialUsage(item)) return;
  item.status = "Concluída";
  item.completedAt = new Date().toISOString();
  item.completedByUserId = currentUser()?.id || "";
  saveData();
  renderCorrectivesView();
}

function deleteCorrective(id) {
  if (!requirePermission("delete")) return;
  if (!confirm("Excluir esta corretiva?")) return;
  data.correctives = data.correctives.filter((item) => item.id !== id);
  saveData();
  renderCorrectivesView();
}

function openNewUser() {
  if (!requirePermission("manageUsers")) return;
  state.editingUserId = null;
  userDialogTitle.textContent = "Novo usuário";
  userForm.reset();
  userForm.elements.password.required = true;
  userDialog.showModal();
}

function openEditUser(id) {
  if (!requirePermission("manageUsers")) return;
  const user = data.users.find((item) => item.id === id);
  if (!user) return;
  state.editingUserId = id;
  userDialogTitle.textContent = "Editar usuário";
  setFormValues(userForm, user);
  userForm.elements.password.value = "";
  userForm.elements.password.required = false;
  userDialog.showModal();
}

function submitUser(event) {
  event.preventDefault();
  if (!requirePermission("manageUsers")) return;
  const formData = new FormData(userForm);
  const existing = data.users.find((user) => user.id === state.editingUserId);
  const username = formData.get("username").trim();
  const duplicate = data.users.some((user) => user.username === username && user.id !== existing?.id);
  if (duplicate) {
    alert("Já existe um usuário com este login.");
    return;
  }
  const payload = {
    id: existing?.id || crypto.randomUUID(),
    name: formData.get("name").trim(),
    username,
    password: formData.get("password") || existing?.password,
    role: formData.get("role"),
  };
  data.users = existing
    ? data.users.map((user) => (user.id === existing.id ? payload : user))
    : [payload, ...data.users];
  saveData();
  userDialog.close();
  renderUsersView();
}

function deleteUser(id) {
  if (!requirePermission("manageUsers")) return;
  if (id === state.currentUserId) {
    alert("Você não pode excluir o usuário logado.");
    return;
  }
  const remainingAdmins = data.users.filter((user) => user.id !== id && user.role === "admin").length;
  if (remainingAdmins === 0) {
    alert("Mantenha pelo menos um usuário administrador no CRM.");
    return;
  }
  if (!confirm("Excluir este usuário?")) return;
  data.users = data.users.filter((user) => user.id !== id);
  saveData();
  renderUsersView();
}

function hydrateEquipmentSelect(select, selectedId = "") {
  select.innerHTML = data.equipments
    .map((equipment) => `<option value="${equipment.id}" ${equipment.id === selectedId ? "selected" : ""}>${escapeHtml(equipment.name)}</option>`)
    .join("");
}

function hydrateUserSelect(select, selectedId = "") {
  select.innerHTML = data.users
    .map((user) => `<option value="${user.id}" ${user.id === selectedId ? "selected" : ""}>${escapeHtml(user.name)} · ${escapeHtml(ROLE_LABELS[user.role])}</option>`)
    .join("");
}

function hydrateComponentSelect(select, equipmentId, selectedId = "") {
  const equipment = getEquipment(equipmentId);
  const options = allComponents()
    .filter((component) => component.equipmentId === equipment?.id)
    .map(
      (component) =>
        `<option value="${component.id}" ${component.id === selectedId ? "selected" : ""}>${escapeHtml(component.categoryLabel)} · ${escapeHtml(component.name)}</option>`,
    );
  select.innerHTML = `<option value="">Sem vínculo específico</option>${options.join("")}`;
}

function stockOptionHtml(selectedId = "") {
  return data.stockItems
    .map((item) => {
      const label = `${item.name} · ${getCategoryLabel(item.category)} · saldo ${Number(item.quantity)}`;
      return `<option value="${item.id}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function renderMaterialRows(container, materials = []) {
  container.innerHTML = "";
  if (!materials.length) {
    addMaterialRow(container);
    return;
  }
  materials.forEach((material) => addMaterialRow(container, material));
}

function addMaterialRow(container, material = {}) {
  const row = document.createElement("div");
  row.className = "material-row";
  row.innerHTML = `
    <select data-material-field="stockItemId">
      <option value="">Selecione uma peça</option>
      ${stockOptionHtml(material.stockItemId)}
    </select>
    <input data-material-field="quantity" type="number" min="0" step="1" value="${Number(material.quantity || 1)}" />
    <button class="danger small" type="button" data-action="remove-material">Remover</button>
  `;
  row.querySelector("[data-action='remove-material']").addEventListener("click", () => row.remove());
  container.append(row);
}

function collectMaterials(container) {
  return Array.from(container.querySelectorAll(".material-row"))
    .map((row) => ({
      stockItemId: row.querySelector("[data-material-field='stockItemId']").value,
      quantity: Number(row.querySelector("[data-material-field='quantity']").value || 0),
    }))
    .filter((item) => item.stockItemId && item.quantity > 0);
}

function applyMaterialUsage(record) {
  if (record.materialsDeductedAt) return true;
  const materials = Array.isArray(record.materials) ? record.materials : [];

  for (const material of materials) {
    const stock = data.stockItems.find((item) => item.id === material.stockItemId);
    const quantity = Number(material.quantity || 0);
    if (!stock) {
      alert("Um dos materiais selecionados não existe mais no estoque.");
      return false;
    }
    if (Number(stock.quantity) < quantity) {
      alert(`Estoque insuficiente para "${stock.name}". Saldo atual: ${stock.quantity}.`);
      return false;
    }
  }

  materials.forEach((material) => {
    const stock = data.stockItems.find((item) => item.id === material.stockItemId);
    stock.quantity = Number(stock.quantity) - Number(material.quantity || 0);
  });
  record.materialsDeductedAt = new Date().toISOString();
  return true;
}

function setFormValues(form, values) {
  Array.from(form.elements).forEach((element) => {
    if (!element.name || element.type === "file") return;
    if (Object.hasOwn(values, element.name)) {
      element.value = values[element.name] ?? "";
    }
  });
}

function createEmptyPeripherals() {
  return CATEGORIES.reduce((acc, category) => {
    acc[category.id] = [];
    return acc;
  }, {});
}

function fileToDataUrl(file) {
  if (!file || file.size === 0) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "crm-equipamentos-industriais.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      data = normalizeData(Array.isArray(imported) ? { ...structuredClone(defaultData), equipments: imported } : imported);
      state.selectedEquipmentId = data.equipments[0]?.id || null;
      saveData();
      render();
    } catch {
      alert("Não foi possível importar o arquivo. Verifique se é um JSON exportado pelo CRM.");
    } finally {
      importInput.value = "";
    }
  };
  reader.readAsText(file);
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDateTimeLocal(value) {
  const date = value instanceof Date ? value : new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const user = data.users.find(
    (item) => item.username === formData.get("username").trim() && item.password === formData.get("password"),
  );
  if (!user) {
    loginError.textContent = "Usuário ou senha inválidos.";
    return;
  }
  loginError.textContent = "";
  state.currentUserId = user.id;
  sessionStorage.setItem(SESSION_KEY, user.id);
  boot();
});

document.querySelector("#logoutBtn").addEventListener("click", () => {
  state.currentUserId = null;
  sessionStorage.removeItem(SESSION_KEY);
  loginForm.reset();
  boot();
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.currentView = button.dataset.view;
    render();
  });
});

document.querySelector("#newEquipmentBtn").addEventListener("click", openNewEquipment);
document.querySelector("#exportBtn").addEventListener("click", exportData);
document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeModal}`).close());
});
importInput.addEventListener("change", importData);
searchInput.addEventListener("input", renderEquipmentList);
equipmentForm.addEventListener("submit", submitEquipment);
componentForm.addEventListener("submit", submitComponent);
stockForm.addEventListener("submit", submitStock);
preventiveForm.addEventListener("submit", submitPreventive);
correctiveForm.addEventListener("submit", submitCorrective);
userForm.addEventListener("submit", submitUser);
stockForm.elements.equipmentId.addEventListener("input", () => {
  hydrateComponentSelect(stockForm.elements.componentId, stockForm.elements.equipmentId.value);
});
document.querySelector("[data-action='add-preventive-material']").addEventListener("click", () => {
  addMaterialRow(document.querySelector("#preventiveMaterials"));
});
document.querySelector("[data-action='add-corrective-material']").addEventListener("click", () => {
  addMaterialRow(document.querySelector("#correctiveMaterials"));
});

async function init() {
  data = await loadData();
  saveData();
  boot();
}

init();
