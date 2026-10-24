import { Wallet, TrendingUp, TrendingDown } from "lucide-react";

export default function BalanceSummary({
  summary = null,
  offlineQueue = [],
  fixedExpenses = [],
}) {
  const offlineIncome = offlineQueue
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const offlineExpense = offlineQueue
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const offlineIncomeCount = offlineQueue.filter(
    (tx) => tx.type === "income"
  ).length;
  const offlineExpenseCount = offlineQueue.filter(
    (tx) => tx.type === "expense"
  ).length;

  const totalIncome = Number(summary?.total_income || 0) + offlineIncome;
  const totalExpense = Number(summary?.total_expense || 0) + offlineExpense;
  const netBalance = totalIncome - totalExpense;

  const incomeCount = Number(summary?.income_count || 0) + offlineIncomeCount;
  const expenseCount =
    Number(summary?.expense_count || 0) + offlineExpenseCount;

  const activeFixedTotal = fixedExpenses
    .filter((item) => item.is_active)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const formatMoney = (val) =>
    val.toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {/* Balance Neto */}
      <div className="bg-indigo-600 text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider font-semibold text-indigo-100">
            Balance Neto
          </span>
          <Wallet className="w-4 h-4 text-indigo-200" />
        </div>
        <p className="text-2xl font-extrabold mt-2">
          {netBalance < 0 ? "-" : ""}${formatMoney(Math.abs(netBalance))}
        </p>
        <span className="text-[11px] text-indigo-200 mt-2">
          Gastos fijos activos: ${formatMoney(activeFixedTotal)}/mes
        </span>
      </div>

      {/* Total Ingresos */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
            Ingresos del Periodo
          </span>
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        </div>
        <p className="text-2xl font-extrabold text-emerald-600 mt-2">
          +${formatMoney(totalIncome)}
        </p>
        <span className="text-[11px] text-gray-400 mt-2">
          {incomeCount} movimientos
        </span>
      </div>

      {/* Total Gastos */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
            Gastos del Periodo
          </span>
          <TrendingDown className="w-4 h-4 text-rose-500" />
        </div>
        <p className="text-2xl font-extrabold text-rose-600 mt-2">
          -${formatMoney(totalExpense)}
        </p>
        <span className="text-[11px] text-gray-400 mt-2">
          {expenseCount} movimientos
        </span>
      </div>
    </div>
  );
}
