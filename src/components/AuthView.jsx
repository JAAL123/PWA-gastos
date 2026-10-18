import { useState } from "react";
import { loginUser, registerUser } from "../services/api";

export default function AuthView({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      setError("El usuario debe tener al menos 3 caracteres.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const data =
        mode === "login"
          ? await loginUser(cleanUsername, password)
          : await registerUser(cleanUsername, password);

      if (onAuthenticated) {
        onAuthenticated(data.user);
      }
    } catch (err) {
      setError(err.message || "Error al autenticar usuario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md mx-auto">
      {/* Selector de modo */}
      <div className="grid grid-cols-2 bg-gray-100 p-1 rounded-xl mb-6">
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={`py-2 text-xs font-bold rounded-lg transition duration-200 ${
            mode === "login"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Iniciar Sesión
        </button>
        <button
          type="button"
          onClick={() => switchMode("register")}
          className={`py-2 text-xs font-bold rounded-lg transition duration-200 ${
            mode === "register"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Crear Cuenta
        </button>
      </div>

      <div className="mb-5 text-center">
        <h2 className="text-xl font-bold text-gray-800">
          {mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {mode === "login"
            ? "Ingresa tu usuario y contraseña para ver tus finanzas."
            : "Registra un usuario para llevar tus gastos de forma privada."}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-xl mb-4 text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
            Usuario
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ej. josef"
            autoComplete="username"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
            required
          />
        </div>

        {mode === "register" && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
              Confirmar Contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
              required
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition duration-200 shadow-sm text-sm disabled:opacity-50"
        >
          {loading
            ? "Procesando..."
            : mode === "login"
              ? "Entrar a mi cuenta"
              : "Registrarme y entrar"}
        </button>
      </form>
    </div>
  );
}
