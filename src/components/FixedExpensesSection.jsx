import { useState } from "react";
import {
  Zap,
  CheckCircle2,
  Clock,
  Calendar,
  Tag,
  Pause,
  Play,
  Pencil,
  Trash2,
  FastForward,
  Plus,
} from "lucide-react";
import { DEFAULT_CATEGORIES, fetchApi } from "../services/api";

export default function FixedExpensesSection({
  fixedExpenses = [],
  categories = DEFAULT_CATEGORIES,
  onChanged,
  onTransactionRecorded,
}) {
  const categoryList =
    Array.isArray(categories) && categories.length > 0
      ? categories
      : DEFAULT_CATEGORIES;

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [category, setCategory] = useState(
    () => categoryList[0]?.name || "General"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Estado de edición en línea
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    amount: "",
    due_day: 1,
    category: "General",
  });
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await fetchApi("/api/fixed-expenses", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          amount: parseFloat(amount),
          due_day: parseInt(dueDay, 10),
          category: category || "General",
          is_active: true,
        }),
      });
      setName("");
      setAmount("");
      setDueDay("1");
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (expense) => {
    setEditingId(expense.id);
    setEditForm({
      name: expense.name,
      amount: String(expense.amount),
      due_day: expense.due_day,
      category: expense.category || categoryList[0]?.name || "General",
    });
  };

  const handleSaveEdit = async (expenseId) => {
    setActionLoadingId(expenseId);
    setError("");
    try {
      await fetchApi(`/api/fixed-expenses/${expenseId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editForm.name.trim(),
          amount: parseFloat(editForm.amount),
          due_day: parseInt(editForm.due_day, 10),
          category: editForm.category || "General",
        }),
      });
      setEditingId(null);
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleActive = async (expense) => {
    setActionLoadingId(expense.id);
    setError("");
    try {
      await fetchApi(`/api/fixed-expenses/${expense.id}`, {
        method: "PUT",
        body: JSON.stringify({
          is_active: !expense.is_active,
        }),
      });
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (expenseId) => {
    setActionLoadingId(expenseId);
    setError("");
    try {
      await fetchApi(`/api/fixed-expenses/${expenseId}`, {
        method: "DELETE",
      });
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAdvancePayment = async (expense) => {
    setActionLoadingId(expense.id);
    setError("");
    try {
      await fetchApi(`/api/fixed-expenses/${expense.id}/charge-now`, {
        method: "POST",
      });
      if (onTransactionRecorded) onTransactionRecorded();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const getEditCategoryOptions = (currentCat) => {
    const names = categoryList.map((c) => c.name);
    if (currentCat && !names.includes(currentCat)) {
      return [{ id: "custom", name: currentCat }, ...categoryList];
    }
    return categoryList;
  };

  return (
    <div className="space-y-6">
      {/* Aviso de cobro automático */}
      <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5">
        <Zap className="w-4 h-4 text-indigo-600 shrink-0" />
        <p>
          <strong>Cobro automático activo:</strong> Los gastos fijos activos se
          registran automáticamente en tus movimientos al llegar su día de pago
          cada mes (una sola vez por periodo{" "}
          <code className="font-mono">{currentPeriod}</code>).
        </p>
      </div>

      {/* Formulario de nuevo gasto fijo */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-base font-bold text-gray-800 mb-4">
          Nuevo Gasto Fijo Mensual
        </h3>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-xl mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                Concepto / Servicio
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Renta, Internet, Gimnasio"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-base sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                Monto Mensual ($)
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                Día de Cobro (1 - 31)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                inputMode="numeric"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-base sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-base sm:text-sm bg-white"
              >
                {categoryList.map((cat) => (
                  <option key={cat.id || cat.name} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition duration-200 shadow-sm text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{loading ? "Guardando..." : "Agregar Gasto Fijo"}</span>
          </button>
        </form>
      </div>

      {/* Lista de gastos fijos */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800">
            Mis Gastos Fijos ({fixedExpenses.length})
          </h2>
        </div>

        {fixedExpenses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">
              No tienes gastos fijos configurados aún.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Agrega tus pagos recurrentes como renta, luz, internet o suscripciones.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {fixedExpenses.map((item) => {
              const isEditing = editingId === item.id;
              const isBusy = actionLoadingId === item.id;
              const isChargedThisMonth =
                item.last_charged_period &&
                item.last_charged_period >= currentPeriod;

              if (isEditing) {
                return (
                  <div key={item.id} className="py-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                        className="px-3 py-2 border border-gray-200 rounded-lg text-base sm:text-sm"
                        placeholder="Concepto"
                      />
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={editForm.amount}
                        onChange={(e) =>
                          setEditForm({ ...editForm, amount: e.target.value })
                        }
                        className="px-3 py-2 border border-gray-200 rounded-lg text-base sm:text-sm"
                        placeholder="Monto"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        inputMode="numeric"
                        value={editForm.due_day}
                        onChange={(e) =>
                          setEditForm({ ...editForm, due_day: e.target.value })
                        }
                        className="px-3 py-2 border border-gray-200 rounded-lg text-base sm:text-sm"
                        placeholder="Día (1-31)"
                      />
                      <select
                        value={editForm.category}
                        onChange={(e) =>
                          setEditForm({ ...editForm, category: e.target.value })
                        }
                        className="px-3 py-2 border border-gray-200 rounded-lg text-base sm:text-sm bg-white"
                      >
                        {getEditCategoryOptions(editForm.category).map(
                          (cat) => (
                            <option key={cat.id || cat.name} value={cat.name}>
                              {cat.name}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleSaveEdit(item.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
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
                  key={item.id}
                  className={`py-3.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 ${
                    !item.is_active ? "opacity-55" : ""
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-800 text-sm">
                        {item.name}
                      </p>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          item.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {item.is_active ? "Activo" : "Pausado"}
                      </span>
                      {isChargedThisMonth ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>
                            Cobrado este mes ({item.last_charged_period})
                          </span>
                        </span>
                      ) : (
                        item.is_active && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Se cobra el día {item.due_day}</span>
                          </span>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Día {item.due_day} de cada mes</span>
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        <span>{item.category || "General"}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="font-bold text-gray-900 text-sm">
                      ${Number(item.amount).toFixed(2)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {item.is_active && !isChargedThisMonth && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAdvancePayment(item)}
                          title="Adelantar el cobro de este mes ahora (no se volverá a cobrar el día programado)"
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1.5 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                        >
                          <FastForward className="w-3.5 h-3.5" />
                          <span>Adelantar</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleActive(item)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                      >
                        {item.is_active ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pausar</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Activar</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => startEditing(item)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(item.id)}
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
        )}
      </div>
    </div>
  );
}
