import { useState, useEffect } from "react";
import TokenConfig from "./components/TokenConfig";
import TransactionForm from "./components/TransactionForm";
import { fetchApi, getToken } from "./services/api";

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasToken, setHasToken] = useState(!!getToken());
  const [showTokenConfig, setShowTokenConfig] = useState(!getToken());

  const loadTransactions = async () => {
    if (!getToken()) {
      setHasToken(false);
      setShowTokenConfig(true);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await fetchApi("/api/transactions");
      setTransactions(data || []);
      setHasToken(true);
    } catch (err) {
      setError(err.message);
      if (err.message.includes("Token") || err.message.includes("autorizado")) {
        setHasToken(false);
        setShowTokenConfig(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasToken) {
      loadTransactions();
    }
  }, [hasToken]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col items-center py-10 px-4">
      <header className="w-full max-w-2xl text-center mb-8">
        <h1 className="text-3xl font-extrabold text-indigo-600 tracking-tight">
          PWA Gastos Personales
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Control financiero rápido, seguro y conectado con Supabase
        </p>
      </header>

      <main className="w-full max-w-2xl">
        {/* Configuración del Token (Se oculta automáticamente al guardar) */}
        <TokenConfig 
          isVisible={showTokenConfig}
          onToggleVisible={setShowTokenConfig}
          onTokenSaved={() => {
            setHasToken(true);
            loadTransactions();
          }} 
        />

        {/* Panel Principal al estar autenticado */}
        {hasToken && (
          <div className="space-y-6">
            {/* Formulario para agregar transacciones */}
            <TransactionForm onTransactionAdded={loadTransactions} />

            {/* Listado de Transacciones */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-800">Historial de Transacciones</h2>
                <button
                  onClick={loadTransactions}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-medium transition duration-200"
                >
                  Actualizar Lista
                </button>
              </div>

              {loading && (
                <p className="text-sm text-indigo-600 text-center py-6 animate-pulse">
                  Cargando movimientos...
                </p>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-xl mb-4 text-center">
                  {error}
                </div>
              )}

              {!loading && !error && transactions.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">No hay transacciones registradas aún.</p>
                  <p className="text-xs text-gray-400 mt-1">¡Usa el formulario superior para registrar la primera!</p>
                </div>
              )}

              {!loading && transactions.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {transactions.map((tx, index) => (
                    <div key={index} className="py-3 flex justify-between items-center text-sm">
                      <div>
                        <p className="font-medium text-gray-800">{tx.description}</p>
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
                          {tx.category || "General"}
                        </span>
                      </div>
                      <span className={`font-bold ${tx.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                        {tx.type === "income" ? "+" : "-"}${tx.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}