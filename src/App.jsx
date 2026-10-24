import { useState, useEffect, useCallback } from "react";
import {
  LayoutList,
  Plus,
  CalendarClock,
  LogOut,
  RefreshCw,
  Pencil,
  Trash2,
  Zap,
  CloudOff,
  Wifi,
  WifiOff,
  Tag,
  Filter,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Calendar,
} from "lucide-react";
import AuthView from "./components/AuthView";
import BalanceSummary from "./components/BalanceSummary";
import FixedExpensesSection from "./components/FixedExpensesSection";
import InstallPwaPrompt from "./components/InstallPwaPrompt";
import TransactionForm from "./components/TransactionForm";
import {
  clearSession,
  DEFAULT_CATEGORIES,
  fetchApi,
  fetchCurrentUser,
  getCachedCategories,
  getCachedFixedExpenses,
  getCachedTransactions,
  getOfflineQueue,
  getStoredUser,
  getToken,
  removeOfflineQueueItem,
  setCachedCategories,
  setCachedFixedExpenses,
  setCachedTransactions,
  syncOfflineTransactions,
} from "./services/api";

const PAGE_SIZE = 10;

// Helpers de fechas por defecto: desde el día 01 del mes actual hasta hoy
const getDefaultDateRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${day}`,
  };
};

// Convierte YYYY-MM-DD a DD/MM/YYYY para mostrar y enviar al backend
const isoToDdMmYyyy = (isoStr) => {
  if (!isoStr) return "";
  const parts = isoStr.split("-");
  if (parts.length !== 3) return isoStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export default function App() {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
  const [activeTab, setActiveTab] = useState("transactions"); // 'transactions' | 'new' | 'fixed'
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  // Filtros y paginación del Historial de Transacciones (por defecto: 01 del mes actual hasta hoy, sin categoría)
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState(
    () => getDefaultDateRange().from
  );
  const [filterDateTo, setFilterDateTo] = useState(
    () => getDefaultDateRange().to
  );
  const [page, setPage] = useState(1);

  const [txPayload, setTxPayload] = useState(() =>
    getToken() ? getCachedTransactions() : getCachedTransactions()
  );
  const [fixedExpenses, setFixedExpenses] = useState(() =>
    getToken() ? getCachedFixedExpenses() : []
  );
  const [categories, setCategories] = useState(() => getCachedCategories());
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
    setTxPayload(getCachedTransactions());
    setFixedExpenses([]);
    setOfflineQueue([]);
    setEditingTxId(null);
    setActiveTab("transactions");
  }, []);

  const buildTransactionsEndpoint = useCallback(
    (targetPage, categoryVal, fromVal, toVal) => {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("page_size", String(PAGE_SIZE));
      if (categoryVal) {
        params.set("category", categoryVal);
      }
      if (fromVal) {
        params.set("date_from", isoToDdMmYyyy(fromVal));
      }
      if (toVal) {
        params.set("date_to", isoToDdMmYyyy(toVal));
      }
      return `/api/transactions?${params.toString()}`;
    },
    []
  );

  const loadDashboardData = useCallback(
    async (overridePage) => {
      if (!getToken()) {
        handleLogout();
        return;
      }

      const activePage = overridePage ?? page;
      setOfflineQueue(getOfflineQueue());

      if (!navigator.onLine) {
        setTxPayload(getCachedTransactions());
        setFixedExpenses(getCachedFixedExpenses());
        setCategories(getCachedCategories());
        return;
      }

      setLoading(true);
      setError("");

      try {
        const synced = await syncOfflineTransactions();
        if (synced > 0) {
          showTempFeedback(
            `Se sincronizaron ${synced} movimiento(s) pendientes.`
          );
        }
        setOfflineQueue(getOfflineQueue());

        const txEndpoint = buildTransactionsEndpoint(
          activePage,
          filterCategory,
          filterDateFrom,
          filterDateTo
        );

        const [meData, txData, fixedData, catData] = await Promise.all([
          fetchCurrentUser(),
          fetchApi(txEndpoint),
          fetchApi("/api/fixed-expenses"),
          fetchApi("/api/categories").catch(() => getCachedCategories()),
        ]);

        setUser(meData);
        setTxPayload(txData);
        if (txData?.page && txData.page !== activePage) {
          setPage(txData.page);
        }
        setFixedExpenses(fixedData || []);
        setCategories(
          Array.isArray(catData) && catData.length > 0
            ? catData
            : DEFAULT_CATEGORIES
        );
        setCachedTransactions(txData);
        setCachedFixedExpenses(fixedData || []);
        if (Array.isArray(catData) && catData.length > 0) {
          setCachedCategories(catData);
        }
        setIsAuthenticated(true);
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          handleLogout();
        } else if (err.isNetworkError) {
          setTxPayload(getCachedTransactions());
          setFixedExpenses(getCachedFixedExpenses());
          setCategories(getCachedCategories());
        } else {
          setError(err.message || "Error al cargar los datos.");
        }
      } finally {
        setLoading(false);
      }
    },
    [
      page,
      filterCategory,
      filterDateFrom,
      filterDateTo,
      buildTransactionsEndpoint,
      handleLogout,
      showTempFeedback,
    ]
  );

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

  // Cargar datos cuando cambian los filtros o la página
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    async function fetchFilteredDashboard() {
      if (!navigator.onLine) return;
      setLoading(true);
      setError("");
      try {
        await syncOfflineTransactions();
        const txEndpoint = buildTransactionsEndpoint(
          page,
          filterCategory,
          filterDateFrom,
          filterDateTo
        );
        const [meData, txData, fixedData, catData] = await Promise.all([
          fetchCurrentUser(),
          fetchApi(txEndpoint),
          fetchApi("/api/fixed-expenses"),
          fetchApi("/api/categories").catch(() => getCachedCategories()),
        ]);
        if (cancelled) return;
        setUser(meData);
        setTxPayload(txData);
        setFixedExpenses(fixedData || []);
        if (Array.isArray(catData) && catData.length > 0) {
          setCategories(catData);
          setCachedCategories(catData);
        }
        setCachedTransactions(txData);
        setCachedFixedExpenses(fixedData || []);
        setOfflineQueue(getOfflineQueue());
      } catch (err) {
        if (cancelled) return;
        if (err.status === 401 || err.status === 403) {
          handleLogout();
        } else if (!err.isNetworkError) {
          setError(err.message || "Error al cargar los datos.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchFilteredDashboard();
    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    page,
    filterCategory,
    filterDateFrom,
    filterDateTo,
    buildTransactionsEndpoint,
    handleLogout,
  ]);

  const handleResetFilters = () => {
    const defaults = getDefaultDateRange();
    setFilterCategory("");
    setFilterDateFrom(defaults.from);
    setFilterDateTo(defaults.to);
    setPage(1);
  };

  const defaultRange = getDefaultDateRange();
  const hasCustomFilters =
    filterCategory !== "" ||
    filterDateFrom !== defaultRange.from ||
    filterDateTo !== defaultRange.to;

  const startEditingTx = (tx) => {
    setEditingTxId(tx.id);
    setEditTxForm({
      type: tx.type,
      amount: String(tx.amount),
      description: tx.description || "",
      category: tx.category || categories[0]?.name || "General",
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
          category: editTxForm.category || "General",
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
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const getEditCategoryOptions = (currentCat) => {
    const names = categories.map((c) => c.name);
    if (currentCat && !names.includes(currentCat)) {
      return [{ id: "custom", name: currentCat }, ...categories];
    }
    return categories;
  };

  const pageItems = Array.isArray(txPayload?.items) ? txPayload.items : [];
  const totalCount = Number(txPayload?.total || 0);
  const currentPage = Number(txPayload?.page || page || 1);
  const totalPages = Math.max(1, Number(txPayload?.total_pages || 1));

  // Si estamos en la página 1, mostrar también en la parte superior cualquier movimiento offline pendiente
  const visibleTransactions =
    currentPage === 1 ? [...offlineQueue, ...pageItems] : pageItems;

  // Vista centrada vertical y horizontalmente cuando no ha iniciado sesión
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full bg-gray-50 text-gray-900 flex flex-col justify-center items-center px-4 py-10">
        <div className="w-full max-w-md flex flex-col items-center">
          <header className="w-full text-center mb-6">
            <h1 className="text-3xl font-extrabold text-indigo-600 tracking-tight">
              Control de gastos
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
                setTxPayload(getCachedTransactions());
                setFixedExpenses(getCachedFixedExpenses());
                setCategories(getCachedCategories());
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
    <div className="min-h-screen w-full bg-gray-50 text-gray-900 flex flex-col items-center pwa-safe-top pb-28 sm:py-8 px-4">
      <header className="w-full max-w-3xl flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <div className="text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-indigo-600 tracking-tight">
              Control de gastos
            </h1>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                isOnline
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3" />
                  <span>En línea</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  <span>Offline</span>
                </>
              )}
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
            className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-xl text-xs font-semibold transition duration-200 inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </header>

      <main className="w-full max-w-3xl">
        {/* Banner para instalar como PWA en Android, iOS o PC */}
        <InstallPwaPrompt />

        {/* Aviso de modo sin conexión o cola pendiente */}
        {(!isOnline || offlineQueue.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3.5 rounded-2xl mb-5 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <CloudOff className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                {!isOnline
                  ? "Estás sin conexión. Puedes consultar tu historial guardado y registrar nuevos movimientos (se sincronizarán al volver a conectarte)."
                  : `Tienes ${offlineQueue.length} movimiento(s) guardados sin conexión listos para sincronizar.`}
              </span>
            </span>
            {isOnline && offlineQueue.length > 0 && (
              <button
                type="button"
                onClick={() => loadDashboardData()}
                className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-lg text-xs font-bold transition"
              >
                Sincronizar ahora
              </button>
            )}
          </div>
        )}

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
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition duration-200 inline-flex items-center justify-center gap-2 ${
              activeTab === "transactions"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <LayoutList className="w-4 h-4" />
            <span>Movimientos ({totalCount + offlineQueue.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition duration-200 inline-flex items-center justify-center gap-2 ${
              activeTab === "new"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Registrar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("fixed")}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition duration-200 inline-flex items-center justify-center gap-2 ${
              activeTab === "fixed"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            <span>Gastos Fijos ({fixedExpenses.length})</span>
          </button>
        </div>

        {/* PANTALLA 1: Resumen de Balance + Historial de Movimientos Paginado y Filtrado */}
        {activeTab === "transactions" && (
          <div className="space-y-6">
            <BalanceSummary
              summary={txPayload?.summary}
              offlineQueue={offlineQueue}
              fixedExpenses={fixedExpenses}
            />

            <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    Historial de Transacciones
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5 inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>
                      Del {isoToDdMmYyyy(filterDateFrom)} al{" "}
                      {isoToDdMmYyyy(filterDateTo)}
                      {filterCategory ? ` · Categoría: ${filterCategory}` : ""}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {hasCustomFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-xl text-xs font-medium transition duration-200 inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Mes actual</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => loadDashboardData()}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-medium transition duration-200 inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Actualizar</span>
                  </button>
                </div>
              </div>

              {/* Barra de Filtros: Categoría, Desde (dd/mm/yyyy), Hasta (dd/mm/yyyy) */}
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 mb-5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2.5">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Filtrar movimientos</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Categoría
                    </label>
                    <select
                      value={filterCategory}
                      onChange={(e) => {
                        setFilterCategory(e.target.value);
                        setPage(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-base sm:text-xs bg-white"
                    >
                      <option value="">Todas las categorías</option>
                      {categories.map((cat) => (
                        <option key={cat.id || cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Desde ({isoToDdMmYyyy(filterDateFrom)})
                    </label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      max={filterDateTo || undefined}
                      onChange={(e) => {
                        if (e.target.value) {
                          setFilterDateFrom(e.target.value);
                          setPage(1);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-base sm:text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Hasta ({isoToDdMmYyyy(filterDateTo)})
                    </label>
                    <input
                      type="date"
                      value={filterDateTo}
                      min={filterDateFrom || undefined}
                      onChange={(e) => {
                        if (e.target.value) {
                          setFilterDateTo(e.target.value);
                          setPage(1);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-base sm:text-xs bg-white"
                    />
                  </div>
                </div>
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

              {!loading && !error && visibleTransactions.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">
                    No se encontraron transacciones en este rango o categoría.
                  </p>
                  <div className="flex justify-center gap-2 mt-3">
                    {hasCustomFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Limpiar filtros</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab("new")}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Registrar transacción</span>
                    </button>
                  </div>
                </div>
              )}

              {!loading && visibleTransactions.length > 0 && (
                <>
                  <div className="divide-y divide-gray-100">
                    {visibleTransactions.map((tx) => {
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
                                className="px-3 py-2 border border-gray-200 rounded-lg text-base sm:text-sm bg-white"
                              >
                                <option value="expense">Gasto</option>
                                <option value="income">Ingreso</option>
                              </select>
                              <input
                                type="number"
                                step="0.01"
                                inputMode="decimal"
                                value={editTxForm.amount}
                                onChange={(e) =>
                                  setEditTxForm({
                                    ...editTxForm,
                                    amount: e.target.value,
                                  })
                                }
                                className="px-3 py-2 border border-gray-200 rounded-lg text-base sm:text-sm"
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
                                className="px-3 py-2 border border-gray-200 rounded-lg text-base sm:text-sm"
                                placeholder="Descripción"
                              />
                              <select
                                value={editTxForm.category}
                                onChange={(e) =>
                                  setEditTxForm({
                                    ...editTxForm,
                                    category: e.target.value,
                                  })
                                }
                                className="px-3 py-2 border border-gray-200 rounded-lg text-base sm:text-sm bg-white"
                              >
                                {getEditCategoryOptions(
                                  editTxForm.category
                                ).map((cat) => (
                                  <option
                                    key={cat.id || cat.name}
                                    value={cat.name}
                                  >
                                    {cat.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleSaveTxEdit(tx.id)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTxId(null)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium"
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
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                                  <CloudOff className="w-3 h-3" />
                                  <span>Pendiente de sincronizar</span>
                                </span>
                              )}
                              {(tx.fixed_expense_id || tx.billing_period) && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 inline-flex items-center gap-1">
                                  <Zap className="w-3 h-3" />
                                  <span>Cargo fijo automático</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                <Tag className="w-3 h-3" />
                                <span>{tx.category || "General"}</span>
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
                                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>Editar</span>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleDeleteTx(tx)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-2.5 py-1.5 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Controles de Paginación (Backend) */}
                  <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
                    <span>
                      Mostrando{" "}
                      <strong>
                        {totalCount === 0
                          ? 0
                          : (currentPage - 1) * PAGE_SIZE + 1}
                      </strong>{" "}
                      a{" "}
                      <strong>
                        {Math.min(currentPage * PAGE_SIZE, totalCount)}
                      </strong>{" "}
                      de <strong>{totalCount}</strong> movimientos
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={currentPage <= 1 || loading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium inline-flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none transition"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Anterior</span>
                      </button>

                      <span className="px-2.5 py-1 font-semibold text-gray-700">
                        Página {currentPage} de {totalPages}
                      </span>

                      <button
                        type="button"
                        disabled={currentPage >= totalPages || loading}
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium inline-flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none transition"
                      >
                        <span>Siguiente</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* PANTALLA 2: Pantalla dedicada para Registrar Gastos e Ingresos */}
        {activeTab === "new" && (
          <TransactionForm
            categories={categories}
            onCancel={() => setActiveTab("transactions")}
            onTransactionAdded={async (info) => {
              if (info?.queuedOffline) {
                setOfflineQueue(getOfflineQueue());
                setActiveTab("transactions");
                showTempFeedback(
                  "Guardado en el dispositivo (se sincronizará al tener internet)."
                );
              } else {
                setPage(1);
                await loadDashboardData(1);
                setActiveTab("transactions");
                showTempFeedback("Transacción registrada exitosamente.");
              }
            }}
          />
        )}

        {/* PANTALLA 3: Gestión de Gastos Fijos */}
        {activeTab === "fixed" && (
          <FixedExpensesSection
            fixedExpenses={fixedExpenses}
            categories={categories}
            onChanged={() => loadDashboardData()}
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
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 pt-2 pwa-safe-bottom-nav flex justify-around items-center z-50 shadow-lg">
        <button
          type="button"
          onClick={() => {
            setActiveTab("transactions");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition ${
            activeTab === "transactions"
              ? "text-indigo-600 font-bold"
              : "text-gray-400 font-medium"
          }`}
        >
          <LayoutList className="w-5 h-5" />
          <span className="text-[11px]">Movimientos</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("new");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`px-4 py-2 rounded-2xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition ${
            activeTab === "new"
              ? "bg-indigo-700 text-white ring-2 ring-indigo-300"
              : "bg-indigo-600 text-white"
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Registrar</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("fixed");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition ${
            activeTab === "fixed"
              ? "text-indigo-600 font-bold"
              : "text-gray-400 font-medium"
          }`}
        >
          <CalendarClock className="w-5 h-5" />
          <span className="text-[11px]">Gastos Fijos</span>
        </button>
      </nav>
    </div>
  );
}
