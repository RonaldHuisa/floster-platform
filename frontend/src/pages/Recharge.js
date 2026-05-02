import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { FiArrowLeft, FiCopy, FiAlertCircle } from "react-icons/fi";
import { getMyWalletFromApi, scanMyDeposits } from "../services/authService";

export default function Recharge() {
  const navigate = useNavigate();

  const toastTimerRef = useRef(null);

  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const showToast = (message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setSuccessMessage(message);

    toastTimerRef.current = setTimeout(() => {
      setSuccessMessage("");
    }, 5000);
  };

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getMyWalletFromApi();
        setWallet(data.wallet);
      } catch (err) {
        setError(err.message || "Error al cargar la wallet.");
      } finally {
        setLoading(false);
      }
    };

    fetchWallet();

    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!wallet?.address) return;

    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      showToast("No se pudo copiar");
    }
  };

  const handleRechargeComplete = async () => {
    showToast("Éxito");
    setScanning(true);

    try {
      const result = await scanMyDeposits();

      if (result.addedDeposits > 0) {
        if (result.sweep?.status === "swept") {
          showToast(
            `Éxito: ${Number(result.addedAmount).toFixed(2)} USDT abonados`
          );
        } else if (result.sweep?.status === "insufficient_usdt") {
          showToast("Éxito: depósito detectado, esperando confirmación");
        } else if (result.sweep?.status === "failed") {
          showToast("Depósito abonado, pendiente mover USDT");
        } else {
          showToast(
            `Éxito: ${Number(result.addedAmount).toFixed(2)} USDT abonados`
          );
        }
      } else if (result.detectedTransfers > 0) {
        showToast("Éxito: depósito ya procesado");
      } else {
        showToast("Éxito: no se detectó depósito nuevo");
      }
    } catch (error) {
      showToast("Error al verificar depósito");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="page recharge-page">
      {successMessage && (
        <div className="success-toast">
          <strong>{successMessage}</strong>
        </div>
      )}

      <div className="recharge-header">
        <button className="icon-btn" onClick={() => navigate("/home")}>
          <FiArrowLeft />
        </button>

        <h2>Recharge</h2>

        <button className="icon-btn ghost-icon" type="button">
          <FiCopy />
        </button>
      </div>

      {loading && (
        <div className="panel">
          <p>Cargando wallet...</p>
        </div>
      )}

      {!loading && error && (
        <div className="panel auth-error">
          {error}
        </div>
      )}

      {!loading && wallet && (
        <>
          <div className="panel recharge-qr-panel">
            <div className="recharge-token-icon">
              ₮
              <span className="bnb-mini-icon">◆</span>
            </div>

            <h3 className="recharge-label">
              Seleccione la red principal
            </h3>

            <div className="network-pill">
              BEP20-USDT
            </div>

            <div className="qr-wrapper">
              <QRCodeCanvas
                value={wallet.address}
                size={160}
                bgColor="#ffffff"
                fgColor="#000000"
                level="H"
                includeMargin={true}
              />
            </div>
          </div>

          <div className="panel deposit-panel">
            <h3 className="deposit-title">
              Dirección de depósito
            </h3>

            <div className="deposit-box">
              <span className="deposit-address">
                {wallet.address}
              </span>

              <button
                className="copy-btn"
                type="button"
                onClick={handleCopy}
              >
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>

          <button
            className="primary-btn recharge-main-btn"
            type="button"
            onClick={handleRechargeComplete}
            disabled={scanning}
          >
            {scanning ? "Verificando..." : "Recarga completa"}
          </button>

          <div className="recharge-notes">
            <div className="notes-title">
              <FiAlertCircle />
              <span>cálido recordatorio</span>
            </div>

            <ol>
              <li>
                Copie la dirección superior o escanee el código QR y seleccione
                BNB Smart Chain BEP20 para enviar USDT.
              </li>

              <li>
                No envíe otros activos ni use otra red. Solo se aceptan depósitos
                USDT mediante BEP20.
              </li>

              <li>
                Después de enviar el pago, presione “Recarga completa”. El sistema
                verificará la blockchain y abonará solo depósitos nuevos.
              </li>

              <li>
                Si el depósito ya fue procesado anteriormente, no se volverá a sumar
                para evitar saldo duplicado.
              </li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}