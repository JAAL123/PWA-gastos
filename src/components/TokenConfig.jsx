import { useState, useEffect } from "react";
import { getToken, setToken } from "../services/api";

export default function TokenConfig({ onTokenSaved, isVisible, onToggleVisible }) {
  const [tokenInput, setTokenInput] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const currentToken = getToken();
    if (currentToken) setTokenInput(currentToken);
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) return;
    setToken(trimmed);
    setSaved(true);
    if (onTokenSaved) onTokenSaved(trimmed);
    setTimeout(() => {
      setSaved(false);
      if (onToggleVisible) onToggleVisible(false); // Ocultar al guardar con éxito
    }, 1500);
  };

  if (!isVisible) {
    return (
      <div className="flex justify-end w-full max-w-2xl mb-2">
        <button
          onClick={() => onToggleVisible(true)}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition duration-200"
        >
          ⚙️ Configurar Token de Acceso
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-md mx-auto my-6 relative">
      <h2 className="text-lg font-bold text-gray-800 mb-1">Configuración de Seguridad</h2>
      <p className="text-xs text-gray-500 mb-4">
        Introduce tu <code className="bg-gray-100 px-1.5 py-0.5 rounded text-indigo-600 font-mono">API_SECRET_KEY</code> para conectar con el backend.
      </p>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
            API Secret Key
          </label>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Ej: r?e$Tu43ZI#q..."
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm"
            required
          />
        </div>

        <div className="flex space-x-2">
          <button
            type="submit"
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-xl transition duration-200 shadow-sm text-sm"
          >
            Guardar Token
          </button>
          {getToken() && (
            <button
              type="button"
              onClick={() => onToggleVisible(false)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium py-2 px-3 rounded-xl transition duration-200 text-sm"
            >
              Cancelar
            </button>
          )}
        </div>

        {saved && (
          <p className="text-xs text-emerald-600 text-center font-medium animate-pulse">
            ¡Token guardado exitosamente!
          </p>
        )}
      </form>
    </div>
  );
}