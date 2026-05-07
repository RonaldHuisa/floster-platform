import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { FiArrowLeft, FiCopy, FiCheckCircle } from "react-icons/fi";
import { getMyWalletFromApi, scanMyDeposits } from "../services/authService";
import { useI18n } from "../i18n/I18nContext";

export default function Recharge() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const toastTimerRef = useRef(null);

  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState("info");
  const [error, setError] = useState("");

  const showToast = (message, type = "info", duration = 3800) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    setToast(message);
    setToastType(type);

    toastTimerRef.current = setTimeout(() => {
      setToast("");
    }, duration);
  };

  const showTempCopied = () => {
    setCopied(true);
    showToast(t("Dirección copiada"), "success", 2200);

    setTimeout(() => {
      setCopied(false);
    }, 1800);
  };

  const loadWallet = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getMyWalletFromApi();
      setWallet(data.wallet || data);
    } catch (err) {
      const message = err.message || t("No se pudo cargar la dirección de depósito.");
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadWallet();

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [loadWallet]);

  const address =
    wallet?.address ||
    wallet?.wallet_address ||
    wallet?.walletAddress ||
    wallet?.deposit_address ||
    wallet?.depositAddress ||
    wallet?.usdt_address ||
    wallet?.usdtAddress ||
    wallet?.bep20_address ||
    wallet?.bep20Address ||
    "";

  const handleCopy = async () => {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      showTempCopied();
    } catch {
      const message = t("No se pudo copiar la dirección.");
      setError(message);
      showToast(message, "error");
    }
  };

  const handleScan = async () => {
    try {
      setScanning(true);
      setError("");
      showToast(t("Verificando depósito en blockchain..."), "info", 5000);

      const result = await scanMyDeposits();

      if (result.addedDeposits > 0) {
        const addedAmount = Number(result.addedAmount || 0).toFixed(2);

        if (result.sweep?.status === "swept") {
          showToast(`${t("Recarga procesada")}: ${addedAmount} ${t("USDT abonados.")}`, "success", 5200);
        } else if (result.sweep?.status === "insufficient_usdt") {
          showToast(
            `${t("Depósito detectado")}: ${addedAmount} USDT. ${t("Esperando confirmación final.")}`,
            "warning",
            5200
          );
        } else if (result.sweep?.status === "failed") {
          showToast(
            `${t("Depósito abonado")}: ${addedAmount} USDT. ${t("Pendiente mover USDT.")}`,
            "warning",
            5200
          );
        } else {
          showToast(`${t("Recarga procesada")}: ${addedAmount} ${t("USDT abonados.")}`, "success", 5200);
        }
      } else if (result.detectedTransfers > 0) {
        showToast(t("Este depósito ya fue procesado anteriormente."), "warning", 4800);
      } else {
        showToast(t("No se detectó ningún depósito nuevo."), "warning", 4200);
      }

      await loadWallet();
    } catch (err) {
      const message = err.message || t("No se pudo verificar la recarga.");
      setError(message);
      showToast(message, "error", 5200);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="page recharge-page recharge-pro-page">
      {toast && (
        <div className={`luven-toast luven-toast-${toastType}`}>
          <strong>{toast}</strong>
        </div>
      )}

      <div className="recharge-header recharge-pro-header">
        <button className="icon-btn" type="button" onClick={() => navigate("/home")}>
          <FiArrowLeft />
        </button>

        <div>
          <div className="eyebrow">BEP20-USDT</div>
          <h2>{t("Recargar")}</h2>
        </div>

        <button className="icon-btn ghost-icon" type="button" onClick={handleCopy}>
          <FiCopy />
        </button>
      </div>

      {loading ? (
        <div className="panel recharge-loading-card">
          <p>{t("Cargando dirección de depósito...")}</p>
        </div>
      ) : (
        <>
          {error && (
            <div className="panel auth-error recharge-error-inline">
              {error}
            </div>
          )}

          <div className="panel recharge-pro-panel recharge-network-pro">
            <div className="recharge-network-head">
              <h3>{t("Red de depósito")}</h3>
              <div className="recharge-token-badges">
                <span className="token-badge token-bnb">
                  <span className="token-mini-icon token-mini-bnb">◆</span>
                  BNB
                </span>
                <span className="token-badge token-usdt">
                  <span className="token-mini-icon token-mini-usdt">₮</span>
                  USDT
                </span>
              </div>
            </div>

            <div className="network-chip-pro">
              <span className="network-chip-dot">◆</span>
              <strong>BEP20-USDT</strong>
            </div>

            <div className="qr-shell-pro">
              <div className="qr-card-pro">
                {address ? (
                  <QRCodeCanvas value={address} size={190} includeMargin />
                ) : (
                  <div className="qr-empty-state">{t("Sin dirección")}</div>
                )}
              </div>
            </div>
          </div>

          <div className="panel recharge-pro-panel">
            <div className="recharge-title-row">
              <h3>{t("Dirección de depósito")}</h3>
              <span className="wallet-badge-pro">Wallet</span>
            </div>

            <div className="address-row-pro">
              <div className="address-value-pro">{address || t("Sin dirección disponible")}</div>

              <button
                type="button"
                className="copy-btn-pro"
                onClick={handleCopy}
                disabled={!address}
              >
                <FiCopy />
                <span>{copied ? t("Copiado") : t("Copiar")}</span>
              </button>
            </div>
          </div>

          <button
            className="primary-btn recharge-main-btn recharge-main-pro-btn"
            type="button"
            onClick={handleScan}
            disabled={scanning || !address}
          >
            {scanning ? t("Verificando...") : t("Recarga completa")}
          </button>

          <div className="panel friendly-note friendly-note-pro">
            <div className="friendly-title">
              <FiCheckCircle />
              <span>{t("Recordatorio importante")}</span>
            </div>

            <ol className="friendly-list">
              <li>{t("Copia la dirección superior o escanea el código QR.")}</li>
              <li>{t("Usa únicamente la red")} <strong>BNB Smart Chain BEP20</strong> {t("para enviar USDT.")}</li>
              <li>{t("Después de enviar el pago, presiona")} <strong>“{t("Recarga completa")}”</strong>. {t("Este paso es vital para verificar la blockchain y abonar tu saldo.")}</li>
              <li>{t("No envíes otros activos ni uses otra red. Los depósitos duplicados no se vuelven a sumar.")}</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
