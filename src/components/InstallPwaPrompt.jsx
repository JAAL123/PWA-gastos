import { useState, useEffect } from "react";
import { Smartphone, Download, Share, X } from "lucide-react";

const getInitialStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true);

const getInitialIsIos = () =>
  typeof window !== "undefined" &&
  /iphone|ipad|ipod/i.test(window.navigator.userAgent);

export default function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIos] = useState(getInitialIsIos);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isStandalone, setIsStandalone] = useState(getInitialStandalone);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone) return;

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [isStandalone]);

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIos) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosHelp((prev) => !prev);
    }
  };

  return (
    <div className="w-full mb-5">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-4 py-3 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold leading-tight">
              Instala Control de gastos en tu dispositivo
            </p>
            <p className="text-[11px] text-indigo-100 mt-0.5">
              Acceso directo en pantalla de inicio y modo sin conexión
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={handleInstallClick}
            className="bg-white text-indigo-600 hover:bg-indigo-50 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isIos ? "Cómo instalar" : "Instalar App"}</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Cerrar aviso de instalación"
            className="text-indigo-200 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isIos && showIosHelp && (
        <div className="mt-2 bg-white border border-indigo-100 rounded-2xl p-4 text-xs text-gray-700 shadow-xs space-y-1.5">
          <p className="font-bold text-indigo-600">
            Para instalar en iPhone o iPad desde Safari:
          </p>
          <p className="flex items-center gap-1.5">
            <span>1. Toca el ícono</span>
            <strong className="inline-flex items-center gap-1">
              Compartir <Share className="w-3.5 h-3.5 inline text-indigo-600" />
            </strong>
            <span>en la barra del navegador.</span>
          </p>
          <p>
            2. Desliza hacia abajo y selecciona{" "}
            <strong>&ldquo;Agregar a pantalla de inicio&rdquo;</strong>.
          </p>
          <p>
            3. Pulsa <strong>Agregar</strong> en la esquina superior derecha.
          </p>
        </div>
      )}
    </div>
  );
}
