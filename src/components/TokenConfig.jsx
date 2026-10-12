import { useState, useEffect } from "react";
import { getToken, setToken } from "../services/api";

export default function TokenConfig({ onTokenSaved }) {
  const [tokenInput, setTokenInput] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const currentToken = getToken();
    if (currentToken) {
      setTokenInput(currentToken);
    }
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    setToken(tokenInput.trim());
    setSaved(true);
    if (onTokenSaved) onTokenSaved(tokenInput.trim());
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 max-w-md mx-auto my-6">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Configuración de Seguridad</h2>
      <p className="text-sm text-gray-500 mb-4">
        Ingresa tu <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600 font-mono">API_SECRET_KEY</code> para autenticarte con el backend.
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 shadow-sm"
        >
          Guardar Token
        </button>

        {saved && (
          <p className="text-sm text-green-600 text-center font-medium animate-pulse">
            ¡Token guardado exitosamente en el navegador!
          </p>
        )}
      </form>
    </div>
  );
}