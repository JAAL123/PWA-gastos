import { useState, useEffect, useCallback } from "react";
import AuthView from "./components/AuthView";
import BalanceSummary from "./components/BalanceSummary";
import FixedExpensesSection from "./components/FixedExpensesSection";
import TransactionForm from "./components/TransactionForm";
import {
  clearSession,
  fetchApi,
  fetchCurrentUser,
  getStoredUser,
  getToken,
} from "./services/api";

export default function App() {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
  const [activeTab, setActiveTab] = useState("transactions"); // 'transactions' | 'fixed'

  const [transactions, setTransactions] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  // Estado de edición de transacciones
  const [editingTxId, setEditingTxId] = useState(null);
  const [editTxForm, setEditTxForm] = useState({
    type: "expense",
    amount: "",
    description: "",
    category: "General",
  });
  const [txActionLoadingId, setTxActionLoadingId] = useState(null);

  const handleLogout = useCallback(() => {
    clearSession();
    setUser(null);
    setIsAuthenticated(false);
    setTransactions([]);
    setFixedExpenses([]);
    setEditingTxId(null);
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!getToken()) {
      handleLogout();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [meData, txData, fixedData] = await Promise.all([
        fetchCurrentUser(),
        fetchApi("/api/transactions"),
        fetchApi("/api/fixed-expenses"),
      ]);
      setUser(meData);
      setTransactions(txData || []);
      setFixedExpenses(fixedData || []);
      setIsAuthenticated(true);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        handleLogout();
      } else {
        setError(err.message || "Error al cargar los datos.");
      }
    } finally {
      setLoading(false);
    }
  }, [handleLogout]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    async function initDashboard() {
      try {
        const [meData, txData, fixedData] = await Promise.all([
          fetchCurrentUser(),
          fetchApi("/api/transactions"),
          fetchApi("/api/fixed-expenses"),
        ]);
        if (cancelled) return;
        setUser(meData);
        setTransactions(txData || []);
        setFixedExpenses(fixedData || []);
      } catch (err) {
        if (cancelled) return;
        if (err.status === 401 || err.status === 403) {
          handleLogout();
        } else {
          setError(err.message || "Error al cargar los datos.");
        }
      }
    }

    initDashboard();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, handleLogout]);

  const showTempFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 3000);
  };

  const startEditingTx = (tx) => {
    setEditingTxId(tx.id);
    setEditTxForm({
      type: tx.type,
      amount: String(tx.amount),
      description: tx.description || "",
      category: tx.category || "General",
    });
  };

  const handleSaveTxEdit = async (txId) => {
    setTxActionLoadingId(txId);
    setError("");
    try {
      await fetchApi(`/api/transactions/${txId}`, {
        method: "PUT",
        body: JSON.stringify({
          type: editTxForm.type,
          amount: parseFloat(editTxForm.amount),
          description: editTxForm.description.trim(),
          category: editTxForm.category.trim() || "General",
        }),
      });
      setEditingTxId(null);
      await loadDashboardData();
      showTempFeedback("Transacción actualizada correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setTxActionLoadingId(null);
    }
  };

  const handleDeleteTx = async (txId) => {
    setTxActionLoadingId(txId);
    setError("");
    try {
      await fetchApi(`/api/transactions/${txId}`, {
        method: "DELETE",
      });
      await loadDashboardData();
      showTempFeedback("Transacción eliminada.");
    } catch (err) {
      setError(err.message);
    } finally {
      setTxActionLoadingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col items-center py-8 px-4">
      <header className="w-full max-w-3xl flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-indigo-600 tracking-tight">
            PWA Gastos Personales
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Control financiero rápido, seguro y conectado con Supabase
          </p>
        </div>

        {isAuthenticated && (
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100">
            <div className="text-right">
              <p className="text-[11px] text-gray-400 leading-none">Sesión activa</p>
              <p className="text-sm font-bold text-gray-800">
                @{user?.username || "usuario"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-xl text-xs font-semibold transition duration-200"
            >
              Cerrar Sesión
            </button>
          </div>
        )}
      </header>

      <main className="w-full max-w-3xl">
        {!isAuthenticated ? (
          <AuthView
            onAuthenticated={(loggedUser) => {
              setUser(loggedUser);
              setIsAuthenticated(true);
            }}
          />
        ) : (
          <div>
            {/* Resumen de Balance */}
            <BalanceSummary
              transactions={transactions}
              fixedExpenses={fixedExpenses}
            />

            {feedback && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium p-3 rounded-xl mb-4 text-center">
                {feedback}
              </div>
            )}

            {/* Pestañas de Navegación */}
            <div className="flex bg-gray-200/70 p-1 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => setActiveTab("transactions")}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition duration-200 ${
                  activeTab === "transactions"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                💸 Movimientos ({transactions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("fixed")}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition duration-200 ${
                  activeTab === "fixed"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                📅 Gastos Fijos ({fixedExpenses.length})
              </button>
            </div>

            {activeTab === "transactions" ? (
              <div className="space-y-6">
                <TransactionForm onTransactionAdded={loadDashboardData} />

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800">
                      Historial de Transacciones
                    </h2>
                    <button
                      onClick={loadDashboardData}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-medium transition duration-200"
                    >
                      Actualizar
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
                      <p className="text-sm text-gray-400">
                        No hay transacciones registradas aún.
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        ¡Usa el formulario superior para registrar la primera!
                      </p>
                    </div>
                  )}

                  {!loading && transactions.length > 0 && (
                    <div className="divide-y divide-gray-100">
                      {transactions.map((tx) => {
                        const isEditing = editingTxId === tx.id;
                        const isBusy = txActionLoadingId === tx.id;

                        if (isEditing) {
                          return (
                            <div key={tx.id} className="py-4 space-y-3">
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={editTxForm.type}
                                  onChange={(e) =>
                                    setEditTxForm({
                                      ...editTxForm,
                                      type: e.target.value,
                                    })
                                  }
                                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                                >
                                  <option value="expense">Gasto 🔴</option>
                                  <option value="income">Ingreso 🟢</option>
                                </select>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editTxForm.amount}
                                  onChange={(e) =>
                                    setEditTxForm({
                                      ...editTxForm,
                                      amount: e.target.value,
                                    })
                                  }
                                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                                  placeholder="Monto"
                                />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={editTxForm.description}
                                  onChange={(e) =>
                                    setEditTxForm({
                                      ...editTxForm,
                                      description: e.target.value,
                                    })
                                  }
                                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                                  placeholder="Descripción"
                                />
                                <input
                                  type="text"
                                  value={editTxForm.category}
                                  onChange={(e) =>
                                    setEditTxForm({
                                      ...editTxForm,
                                      category: e.target.value,
                                    })
                                  }
                                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                                  placeholder="Categoría"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleSaveTxEdit(tx.id)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-xs font-medium"
                                >
                                  Guardar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTxId(null)}
                                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-lg text-xs font-medium"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={tx.id}
                            className="py-3.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-sm"
                          >
                            <div>
                              <p className="font-semibold text-gray-800">
                                {tx.description || "Sin descripción"}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                  {tx.category || "General"}
                                </span>
                                {tx.date && (
                                  <span className="text-xs text-gray-400">
                                    {formatDate(tx.date)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3">
                              <span
                                className={`font-bold ${
                                  tx.type === "income"
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                                }`}
                              >
                                {tx.type === "income" ? "+" : "-"}$
                                {Number(tx.amount).toFixed(2)}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => startEditingTx(tx)}
                                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1 rounded-lg text-xs font-medium transition"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleDeleteTx(tx.id)}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-2.5 py-1 rounded-lg text-xs font-medium transition"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <FixedExpensesSection
                fixedExpenses={fixedExpenses}
                onChanged={loadDashboardData}
                onTransactionRecorded={async () => {
                  await loadDashboardData();
                  showTempFeedback(
                    "Pago de gasto fijo registrado en tus movimientos."
                  );
                }}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}