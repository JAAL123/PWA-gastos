import { useState, useEffect, useCallback } from "react";
import AuthView from "./components/AuthView";
import BalanceSummary from "./components/BalanceSummary";
import FixedExpensesSection from "./components/FixedExpensesSection";
import InstallPwaPrompt from "./components/InstallPwaPrompt";
import TransactionForm from "./components/TransactionForm";
import {
  clearSession,
  fetchApi,
  fetchCurrentUser,
  getCachedFixedExpenses,
  getCachedTransactions,
  getOfflineQueue,
  getStoredUser,
  getToken,
  removeOfflineQueueItem,
  setCachedFixedExpenses,
  setCachedTransactions,
  syncOfflineTransactions,
} from "./services/api";

export default function App() {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
  const [activeTab, setActiveTab] = useState("transactions"); // 'transactions' | 'fixed'
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const [transactions, setTransactions] = useState(() =>
    getToken() ? getCachedTransactions() : []
  );
  const [fixedExpenses, setFixedExpenses] = useState(() =>
    getToken() ? getCachedFixedExpenses() : []
  );
  const [offlineQueue, setOfflineQueue] = useState(() =>
    getToken() ? getOfflineQueue() : []
  );

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

  const showTempFeedback = useCallback((msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 3500);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setUser(null);
    setIsAuthenticated(false);
    setTransactions([]);
    setFixedExpenses([]);
    setOfflineQueue([]);
    setEditingTxId(null);
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!getToken()) {
      handleLogout();
      return;
    }

    setOfflineQueue(getOfflineQueue());

    if (!navigator.onLine) {
      setTransactions(getCachedTransactions());
      setFixedExpenses(getCachedFixedExpenses());
      return;
    }

    setLoading(true);
    setError("");

    try {
      const synced = await syncOfflineTransactions();
      if (synced > 0) {
        showTempFeedback(
          `☁️ Se sincronizaron ${synced} movimiento(s) pendientes.`
        );
      }
      setOfflineQueue(getOfflineQueue());

      const [meData, txData, fixedData] = await Promise.all([
        fetchCurrentUser(),
        fetchApi("/api/transactions"),
        fetchApi("/api/fixed-expenses"),
      ]);
      setUser(meData);
      setTransactions(txData || []);
      setFixedExpenses(fixedData || []);
      setCachedTransactions(txData || []);
      setCachedFixedExpenses(fixedData || []);
      setIsAuthenticated(true);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        handleLogout();
      } else if (err.isNetworkError) {
        setTransactions(getCachedTransactions());
        setFixedExpenses(getCachedFixedExpenses());
      } else {
        setError(err.message || "Error al cargar los datos.");
      }
    } finally {
      setLoading(false);
    }
  }, [handleLogout, showTempFeedback]);

  // Escuchar cambios de conectividad Online / Offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (getToken()) {
        loadDashboardData();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadDashboardData]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    async function initDashboard() {
      if (!navigator.onLine) return;
      try {
        await syncOfflineTransactions();
        const [meData, txData, fixedData] = await Promise.all([
          fetchCurrentUser(),
          fetchApi("/api/transactions"),
          fetchApi("/api/fixed-expenses"),
        ]);
        if (cancelled) return;
        setUser(meData);
        setTransactions(txData || []);
        setFixedExpenses(fixedData || []);
        setCachedTransactions(txData || []);
        setCachedFixedExpenses(fixedData || []);
        setOfflineQueue(getOfflineQueue());
      } catch (err) {
        if (cancelled) return;
        if (err.status === 401 || err.status === 403) {
          handleLogout();
        } else if (!err.isNetworkError) {
          setError(err.message || "Error al cargar los datos.");
        }
      }
    }

    initDashboard();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, handleLogout]);

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

  const handleDeleteTx = async (tx) => {
    if (tx.is_offline_pending) {
      removeOfflineQueueItem(tx.id);
      setOfflineQueue(getOfflineQueue());
      showTempFeedback("Movimiento pendiente eliminado.");
      return;
    }

    setTxActionLoadingId(tx.id);
    setError("");
    try {
      await fetchApi(`/api/transactions/${tx.id}`, {
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

  const combinedTransactions = [...offlineQueue, ...transactions];

  // Vista centrada vertical y horizontalmente cuando no ha iniciado sesión
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full bg-gray-50 text-gray-900 flex flex-col justify-center items-center px-4 py-10">
        <div className="w-full max-w-md flex flex-col items-center">
          <header className="w-full text-center mb-6">
            <h1 className="text-3xl font-extrabold text-indigo-600 tracking-tight">
              PWA Gastos Personales
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Control financiero rápido, seguro y conectado con Supabase
            </p>
          </header>

          <InstallPwaPrompt />

          <main className="w-full">
            <AuthView
              onAuthenticated={(loggedUser) => {
                setUser(loggedUser);
                setTransactions(getCachedTransactions());
                setFixedExpenses(getCachedFixedExpenses());
                setOfflineQueue(getOfflineQueue());
                setIsAuthenticated(true);
              }}
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900 flex flex-col items-center pt-6 pb-24 sm:py-8 px-4">
      <header className="w-full max-w-3xl flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <div className="text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-indigo-600 tracking-tight">
              PWA Gastos Personales
            </h1>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isOnline
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {isOnline ? "● En línea" : "● Offline"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Control financiero rápido, seguro y conectado con Supabase
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-right">
            <p className="text-[11px] text-gray-400 leading-none">
              Sesión activa
            </p>
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
      </header>

      <main className="w-full max-w-3xl">
        {/* Banner para instalar como PWA en Android, iOS o PC */}
        <InstallPwaPrompt />

        {/* Aviso de modo sin conexión o cola pendiente */}
        {(!isOnline || offlineQueue.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3.5 rounded-2xl mb-5 flex flex-wrap items-center justify-between gap-2">
            <span>
              {!isOnline
                ? "📡 Estás sin conexión. Puedes consultar tu historial guardado y registrar nuevos movimientos (se sincronizarán al volver a conectarte)."
                : `☁️ Tienes ${offlineQueue.length} movimiento(s) guardados sin conexión listos para sincronizar.`}
            </span>
            {isOnline && offlineQueue.length > 0 && (
              <button
                type="button"
                onClick={loadDashboardData}
                className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-lg text-xs font-bold transition"
              >
                Sincronizar ahora
              </button>
            )}
          </div>
        )}

        {/* Resumen de Balance */}
        <BalanceSummary
          transactions={combinedTransactions}
          fixedExpenses={fixedExpenses}
        />

        {feedback && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium p-3 rounded-xl mb-4 text-center">
            {feedback}
          </div>
        )}

        {/* Pestañas de Navegación en Escritorio / Tablet */}
        <div className="hidden sm:flex bg-gray-200/70 p-1 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("transactions")}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition duration-200 ${
              activeTab === "transactions"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            💸 Movimientos ({combinedTransactions.length})
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
            <TransactionForm
              onTransactionAdded={(info) => {
                if (info?.queuedOffline) {
                  setOfflineQueue(getOfflineQueue());
                  showTempFeedback(
                    "Guardado en el dispositivo (se sincronizará al tener internet)."
                  );
                } else {
                  loadDashboardData();
                }
              }}
            />

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

              {!loading && !error && combinedTransactions.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">
                    No hay transacciones registradas aún.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    ¡Usa el formulario superior para registrar la primera!
                  </p>
                </div>
              )}

              {combinedTransactions.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {combinedTransactions.map((tx) => {
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
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-gray-800">
                              {tx.description || "Sin descripción"}
                            </p>
                            {tx.is_offline_pending && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                ☁️ Pendiente de sincronizar
                              </span>
                            )}
                            {(tx.fixed_expense_id || tx.billing_period) && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                                ⚡ Cargo fijo automático
                              </span>
                            )}
                          </div>
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
                            {!tx.is_offline_pending && isOnline && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => startEditingTx(tx)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1 rounded-lg text-xs font-medium transition"
                              >
                                Editar
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDeleteTx(tx)}
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
                "Cobro adelantado registrado en tus movimientos."
              );
            }}
          />
        )}
      </main>

      {/* Barra de Navegación Inferior Móvil estilo App Nativa */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-2 flex justify-around items-center z-50 shadow-lg">
        <button
          type="button"
          onClick={() => {
            setActiveTab("transactions");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition ${
            activeTab === "transactions"
              ? "text-indigo-600 font-bold"
              : "text-gray-400 font-medium"
          }`}
        >
          <span className="text-lg leading-none">💸</span>
          <span className="text-[11px]">Movimientos</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("transactions");
            setTimeout(() => {
              document
                .getElementById("transaction-form-card")
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 50);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-sm flex items-center gap-1"
        >
          <span>＋</span>
          <span>Registrar</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("fixed");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition ${
            activeTab === "fixed"
              ? "text-indigo-600 font-bold"
              : "text-gray-400 font-medium"
          }`}
        >
          <span className="text-lg leading-none">📅</span>
          <span className="text-[11px]">Gastos Fijos</span>
        </button>
      </nav>
    </div>
  );
}