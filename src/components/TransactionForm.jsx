import { useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeft,
  Check,
} from "lucide-react";
import {
  DEFAULT_CATEGORIES,
  enqueueOfflineTransaction,
  fetchApi,
} from "../services/api";

const getTodayIso = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isoToDdMmYyyy = (isoStr) => {
  if (!isoStr) return "";
  const parts = isoStr.split("-");
  if (parts.length !== 3) return isoStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export default function TransactionForm({
  categories = DEFAULT_CATEGORIES,
  onTransactionAdded,
  onCancel,
}) {
  const categoryList =
    Array.isArray(categories) && categories.length > 0
      ? categories
      : DEFAULT_CATEGORIES;

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense"); // 'expense' o 'income'
  const [category, setCategory] = useState(
    () => categoryList[0]?.name || "General"
  );
  const [date, setDate] = useState(getTodayIso);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const selectedDate = date || getTodayIso();
    const payload = {
      description: description.trim(),
      amount: parseFloat(amount),
      type,
      category: category || "General",
      date: `${selectedDate}T12:00:00`,
    };

    try {
      if (!navigator.onLine) {
        enqueueOfflineTransaction(payload);
        setDescription("");
        setAmount("");
        setDate(getTodayIso());
        if (onTransactionAdded) onTransactionAdded({ queuedOffline: true });
        return;
      }

      await fetchApi("/api/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setDescription("");
      setAmount("");
      setDate(getTodayIso());
      if (onTransactionAdded) onTransactionAdded({ queuedOffline: false });
    } catch (err) {
      if (err.isNetworkError) {
        enqueueOfflineTransaction(payload);
        setDescription("");
        setAmount("");
        setDate(getTodayIso());
        if (onTransactionAdded) onTransactionAdded({ queuedOffline: true });
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="transaction-form-card"
      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-800">
            Registrar Movimiento
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Agrega un nuevo gasto o ingreso a tu cuenta
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver</span>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-xl mb-4 text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Selector de Tipo con íconos vectoriales */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
            Tipo de movimiento
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`py-2.5 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition ${
                type === "expense"
                  ? "bg-rose-50 border-rose-200 text-rose-700"
                  : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              <ArrowDownCircle
                className={`w-4 h-4 ${
                  type === "expense" ? "text-rose-600" : "text-gray-400"
                }`}
              />
              <span>Gasto</span>
            </button>

            <button
              type="button"
              onClick={() => setType("income")}
              className={`py-2.5 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition ${
                type === "income"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              <ArrowUpCircle
                className={`w-4 h-4 ${
                  type === "income" ? "text-emerald-600" : "text-gray-400"
                }`}
              />
              <span>Ingreso</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="min-w-0">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
              Monto ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-base sm:text-sm box-border"
              required
            />
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
              Categoría
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-base sm:text-sm bg-white box-border"
            >
              {categoryList.map((cat) => (
                <option key={cat.id || cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 overflow-hidden">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
              Fecha ({isoToDdMmYyyy(date)})
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
              className="block w-full max-w-full min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-base sm:text-sm bg-white box-border appearance-none"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
            Descripción
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Supermercado, Salario, etc."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-base sm:text-sm"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition duration-200 shadow-sm text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          <span>{loading ? "Guardando..." : "Guardar Transacción"}</span>
        </button>
      </form>
    </div>
  );
}
