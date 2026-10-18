// Obtener la URL base dependiendo de si estás en local o producción
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "" : "http://127.0.0.1:8000");

const TOKEN_STORAGE_KEY = "pwa_auth_token";
const USER_STORAGE_KEY = "pwa_auth_user";

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

// Función genérica para hacer peticiones autenticadas al backend
export async function fetchApi(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

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
      data?.detail || "Sesión expirada o credenciales inválidas. Inicia sesión nuevamente.";
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