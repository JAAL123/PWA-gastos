// Obtener la URL base dependiendo de si estás en local o producción
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const getToken = () => localStorage.getItem("pwa_api_token") || "";
export const setToken = (token) => localStorage.setItem("pwa_api_token", token);

// Función genérica para hacer peticiones seguras
export async function fetchApi(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 403 || response.status === 401) {
    throw new Error("Token inválido o no autorizado. Por favor verifica tu clave secreta.");
  }

  if (!response.ok) {
    throw new Error(`Error en la petición: ${response.statusText}`);
  }

  // Si la respuesta no está vacía, parseamos a JSON
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}