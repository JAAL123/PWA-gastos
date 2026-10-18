export default function BalanceSummary({ transactions = [], fixedExpenses = [] }) {
  const totalIncome = transactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const totalExpense = transactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const netBalance = totalIncome - totalExpense;

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
        <span className="text-xs uppercase tracking-wider font-semibold text-indigo-100">
          Balance Neto
        </span>
        <p className="text-2xl font-extrabold mt-2">
          {netBalance < 0 ? "-" : ""}${formatMoney(Math.abs(netBalance))}
        </p>
        <span className="text-[11px] text-indigo-200 mt-2">
          Gastos fijos activos: ${formatMoney(activeFixedTotal)}/mes
        </span>
      </div>

      {/* Total Ingresos */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
          Ingresos Totales
        </span>
        <p className="text-2xl font-extrabold text-emerald-600 mt-2">
          +${formatMoney(totalIncome)}
        </p>
        <span className="text-[11px] text-gray-400 mt-2">
          {transactions.filter((tx) => tx.type === "income").length} movimientos
        </span>
      </div>

      {/* Total Gastos */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
          Gastos Totales
        </span>
        <p className="text-2xl font-extrabold text-rose-600 mt-2">
          -${formatMoney(totalExpense)}
        </p>
        <span className="text-[11px] text-gray-400 mt-2">
          {transactions.filter((tx) => tx.type === "expense").length} movimientos
        </span>
      </div>
    </div>
  );
}
