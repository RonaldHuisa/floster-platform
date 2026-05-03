import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { FiArrowLeft, FiCopy, FiCheckCircle } from "react-icons/fi";
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
    showToast("Verificando depósito...");
    setScanning(true);

    try {
      const result = await scanMyDeposits();

      if (result.addedDeposits > 0) {
        if (result.sweep?.status === "swept") {
          showToast(
            `Éxito: ${Number(result.addedAmount).toFixed(2)} USDT abonados`
          );
        } else if (result.sweep?.status === "insufficient_usdt") {
          showToast("Depósito detectado, esperando confirmación");
        } else if (result.sweep?.status === "failed") {
          showToast("Depósito abonado, pendiente mover USDT");
        } else {
          showToast(
            `Éxito: ${Number(result.addedAmount).toFixed(2)} USDT abonados`
          );
        }
      } else if (result.detectedTransfers > 0) {
        showToast("Depósito ya procesado");
      } else {
        showToast("No se detectó depósito nuevo");
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

        <div>
          <div className="eyebrow">BEP20-USDT</div>
          <h2>Recargar</h2>
        </div>

        <button className="icon-btn ghost-icon" type="button" onClick={handleCopy}>
          <FiCopy />
        </button>
      </div>

      {loading && (
        <div className="panel">
          <p>Cargando wallet...</p>
        </div>
      )}

      {!loading && error && <div className="panel auth-error">{error}</div>}

      {!loading && wallet && (
        <>
          <div className="panel recharge-qr-panel">
            <div className="recharge-token-icon">
              <span className="token-usdt">₮</span>
              <span className="bnb-mini-icon">BNB</span>
            </div>

            <h3 className="recharge-label">Red de depósito</h3>

            <div className="network-pill">
              <span className="network-icon">◆</span>
              BEP20-USDT
            </div>

            <div className="qr-wrapper">
              <QRCodeCanvas
                value={wallet.address}
                size={168}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="H"
                includeMargin={true}
              />
            </div>
          </div>

          <div className="panel deposit-panel">
            <div className="panel-title-row">
              <h3 className="deposit-title">Dirección de depósito</h3>
              <span className="soft-pill">Wallet</span>
            </div>

            <div className="deposit-box">
              <span className="deposit-address">{wallet.address}</span>

              <button className="copy-btn" type="button" onClick={handleCopy}>
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

          <div className="recharge-notes panel">
            <div className="notes-title">
              <FiCheckCircle />
              <span>Recordatorio importante</span>
            </div>

            <ol>
              <li>
                📌 Copia la dirección superior o escanea el código QR.
              </li>

              <li>
                🟡 Usa únicamente la red <strong>BNB Smart Chain BEP20</strong> para enviar USDT.
              </li>

              <li>
                ✅ Después de enviar el pago, presiona <strong>“Recarga completa”</strong>. Este paso es vital para verificar la blockchain y abonar tu saldo.
              </li>

              <li>
                🔒 No envíes otros activos ni uses otra red. Los depósitos duplicados no se vuelven a sumar.
              </li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
