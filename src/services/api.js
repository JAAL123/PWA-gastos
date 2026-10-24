// Obtener la URL base dependiendo de si estás en local o producción
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "" : "http://127.0.0.1:8000");

const TOKEN_STORAGE_KEY = "pwa_auth_token";
const USER_STORAGE_KEY = "pwa_auth_user";
const OFFLINE_QUEUE_KEY = "pwa_offline_tx_queue";

// Limpiar el antiguo token estático si existiera
localStorage.removeItem("pwa_api_token");

export const getToken = () => localStorage.getItem(TOKEN_STORAGE_KEY) || "";
export const setToken = (token) => localStorage.setItem(TOKEN_STORAGE_KEY, token);

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user) => {
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
};

// --- CACHÉ LOCAL Y COLA OFFLINE ---
const getUserCacheSuffix = () => {
  const user = getStoredUser();
  return user?.id || user?.username || "default";
};

const EMPTY_TX_PAYLOAD = {
  items: [],
  total: 0,
  page: 1,
  page_size: 10,
  total_pages: 1,
  summary: {
    total_income: 0,
    total_expense: 0,
    net_balance: 0,
    income_count: 0,
    expense_count: 0,
  },
};

export const getCachedTransactions = () => {
  try {
    const raw = localStorage.getItem(`pwa_cache_tx_${getUserCacheSuffix()}`);
    if (!raw) return EMPTY_TX_PAYLOAD;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        ...EMPTY_TX_PAYLOAD,
        items: parsed,
        total: parsed.length,
      };
    }
    return {
      ...EMPTY_TX_PAYLOAD,
      ...parsed,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      summary: { ...EMPTY_TX_PAYLOAD.summary, ...(parsed.summary || {}) },
    };
  } catch {
    return EMPTY_TX_PAYLOAD;
  }
};

export const setCachedTransactions = (payload) => {
  try {
    localStorage.setItem(
      `pwa_cache_tx_${getUserCacheSuffix()}`,
      JSON.stringify(payload || EMPTY_TX_PAYLOAD)
    );
  } catch {
    // Ignore storage quota errors
  }
};

export const getCachedFixedExpenses = () => {
  try {
    const raw = localStorage.getItem(`pwa_cache_fixed_${getUserCacheSuffix()}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const setCachedFixedExpenses = (list) => {
  try {
    localStorage.setItem(
      `pwa_cache_fixed_${getUserCacheSuffix()}`,
      JSON.stringify(list || [])
    );
  } catch {
    // Ignore storage quota errors
  }
};

export const DEFAULT_CATEGORIES = [
  { id: 1, name: "General" },
  { id: 2, name: "Comida" },
  { id: 3, name: "PC" },
  { id: 4, name: "Ropa" },
  { id: 5, name: "Movil" },
  { id: 6, name: "Tarjeta" },
];

export const getCachedCategories = () => {
  try {
    const raw = localStorage.getItem("pwa_cache_categories");
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
};

export const setCachedCategories = (list) => {
  try {
    if (Array.isArray(list) && list.length > 0) {
      localStorage.setItem("pwa_cache_categories", JSON.stringify(list));
    }
  } catch {
    // Ignore storage quota errors
  }
};

export const getOfflineQueue = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const all = raw ? JSON.parse(raw) : [];
    const suffix = String(getUserCacheSuffix());
    return all.filter((item) => String(item.user_key) === suffix);
  } catch {
    return [];
  }
};

const saveFullOfflineQueue = (allItems) => {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(allItems));
};

export const enqueueOfflineTransaction = (payload) => {
  let all;
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    all = raw ? JSON.parse(raw) : [];
  } catch {
    all = [];
  }

  const entry = {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user_key: String(getUserCacheSuffix()),
    type: payload.type,
    amount: Number(payload.amount),
    category: payload.category || "General",
    description: payload.description || "",
    date: new Date().toISOString(),
    is_offline_pending: true,
  };

  all.unshift(entry);
  saveFullOfflineQueue(all);
  return entry;
};

export const removeOfflineQueueItem = (entryId) => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const all = raw ? JSON.parse(raw) : [];
    saveFullOfflineQueue(all.filter((item) => item.id !== entryId));
  } catch {
    // Ignore
  }
};

// Función genérica para hacer peticiones autenticadas al backend
export async function fetchApi(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkErr) {
    const err = new Error(
      "Sin conexión con el servidor. Verifica tu internet."
    );
    err.isNetworkError = true;
    err.cause = networkErr;
    throw err;
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (response.status === 401 || response.status === 403) {
    const detail =
      data?.detail ||
      "Sesión expirada o credenciales inválidas. Inicia sesión nuevamente.";
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  if (!response.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : `Error en la petición (${response.status})`;
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function syncOfflineTransactions() {
  if (!navigator.onLine || !getToken()) return 0;
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  let syncedCount = 0;
  // Enviar en orden cronológico (del más antiguo al más reciente)
  for (const item of [...queue].reverse()) {
    try {
      await fetchApi("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          type: item.type,
          amount: item.amount,
          category: item.category,
          description: item.description,
          date: item.date,
        }),
      });
      removeOfflineQueueItem(item.id);
      syncedCount += 1;
    } catch (err) {
      if (err.isNetworkError) break;
    }
  }
  return syncedCount;
}

export async function loginUser(username, password) {
  const data = await fetchApi("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(data.access_token);
  setStoredUser(data.user);
  return data;
}

export async function registerUser(username, password) {
  const data = await fetchApi("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(data.access_token);
  setStoredUser(data.user);
  return data;
}

export async function fetchCurrentUser() {
  const user = await fetchApi("/api/auth/me");
  setStoredUser(user);
  return user;
}