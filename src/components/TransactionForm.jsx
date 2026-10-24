import { useState } from "react";
import { enqueueOfflineTransaction, fetchApi } from "../services/api";

export default function TransactionForm({ onTransactionAdded }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense"); // 'expense' o 'income'
  const [category, setCategory] = useState("General");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      description: description.trim(),
      amount: parseFloat(amount),
      type,
      category: category.trim() || "General",
    };

    try {
      if (!navigator.onLine) {
        enqueueOfflineTransaction(payload);
        setDescription("");
        setAmount("");
        if (onTransactionAdded) onTransactionAdded({ queuedOffline: true });
        return;
      }

      await fetchApi("/api/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setDescription("");
      setAmount("");
      if (onTransactionAdded) onTransactionAdded({ queuedOffline: false });
    } catch (err) {
      if (err.isNetworkError) {
        enqueueOfflineTransaction(payload);
        setDescription("");
        setAmount("");
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
      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6"
    >
      <h3 className="text-base font-bold text-gray-800 mb-4">
        Nueva Transacción
      </h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-xl mb-4 text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
              Tipo
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-base sm:text-sm bg-white"
            >
              <option value="expense">Gasto 🔴</option>
              <option value="income">Ingreso 🟢</option>
            </select>
          </div>

          <div>
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
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-base sm:text-sm"
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

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
            Categoría
          </label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ej: Comida, Transporte, Ocio"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-base sm:text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition duration-200 shadow-sm text-sm disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Registrar Transacción"}
        </button>
      </form>
    </div>
  );
}