import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiClock, FiEye, FiEyeOff, FiInfo } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import {
  createWithdrawRequest,
  getWithdrawInfo,
} from "../services/authService";
import { useI18n } from "../i18n/I18nContext";

export default function Withdraw() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const toastTimerRef = useRef(null);

  const [available, setAvailable] = useState("0");
  const [feePercent, setFeePercent] = useState(8);
  const [minWithdraw, setMinWithdraw] = useState(1);
  const [withdrawalAddress, setWithdrawalAddress] = useState("");
  const [addressLocked, setAddressLocked] = useState(false);

  const [amount, setAmount] = useState("");
  const [securityPassword, setSecurityPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = useCallback((message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast(message);

    toastTimerRef.current = setTimeout(() => {
      setToast("");
    }, 5000);
  }, []);

  const loadWithdrawInfo = useCallback(async () => {
    try {
      setLoading(true);

      const data = await getWithdrawInfo();

      setAvailable(data.available || "0");
      setFeePercent(Number(data.feePercent || 8));
      setMinWithdraw(Number(data.minWithdraw || 1));
      setWithdrawalAddress(data.withdrawalAddress || "");
      setAddressLocked(Boolean(data.addressLocked));
    } catch (error) {
      showToast(error.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadWithdrawInfo();

    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [loadWithdrawInfo]);

  const amountNumber = Number(amount || 0);
  const feeAmount = amountNumber * (feePercent / 100);
  const realArrival = amountNumber > 0 ? amountNumber - feeAmount : 0;

  const handleAll = () => {
    setAmount(Number(available || 0).toString());
  };

  const handleConfirm = async () => {
    try {
      setSending(true);

      const data = await createWithdrawRequest({
        withdrawalAddress,
        amount,
        securityPassword,
      });

      showToast(t("Solicitud de retiro creada"));

      setAvailable(data.currentWithdrawable || "0");
      setWithdrawalAddress(data.withdrawalAddress || withdrawalAddress);
      setAddressLocked(true);
      setAmount("");
      setSecurityPassword("");
    } catch (error) {
      showToast(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page withdraw-page withdraw-compact-page">
      {toast && (
        <div className="success-toast">
          <strong>{toast}</strong>
        </div>
      )}

      <div className="recharge-header withdraw-compact-header">
        <button className="icon-btn" onClick={() => navigate("/home")}>
          <FiArrowLeft />
        </button>

        <div>
          <div className="eyebrow">BEP20-USDT</div>
          <h2>{t("Retirar")}</h2>
        </div>

        <button
          className="icon-btn ghost-icon"
          type="button"
          onClick={() => navigate("/transactions")}
        >
          <FiClock />
        </button>
      </div>

      <div className="withdraw-balance-card withdraw-balance-compact">
        <p>{t("Disponible para retirar")}</p>
        <div className="withdraw-balance-inline">
          <strong>{Number(available || 0).toFixed(6)}</strong>
          <span>USDT</span>
        </div>
      </div>

      <div className="panel withdraw-panel withdraw-network-panel">
        <div className="withdraw-row-title">
          <h3>{t("Red principal")}</h3>
          <div className="withdraw-network-mini">
            <span className="bnb-mini-icon">◆</span>
            <strong>BEP20-USDT</strong>
          </div>
        </div>
      </div>

      <div className="panel withdraw-panel">
        <h3>{t("Dirección de retiro")}</h3>

        <input
          className="withdraw-input"
          value={withdrawalAddress}
          onChange={(e) => setWithdrawalAddress(e.target.value)}
          placeholder={t("Ingrese dirección BEP20-USDT")}
          disabled={addressLocked}
        />

        {addressLocked && (
          <p className="withdraw-help">
            {t("Dirección fijada. Después del primer retiro ya no puede cambiarse.")}
          </p>
        )}
      </div>

      <div className="panel withdraw-panel">
        <h3>{t("Monto de retiro")}</h3>

        <div className="withdraw-amount-box">
          <input
            className="withdraw-input amount-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t("Ingresa el monto")}
            type="number"
            min="0"
            step="0.000001"
          />

          <button type="button" onClick={handleAll}>
            {t("Todo")}
          </button>
        </div>

        <p className="withdraw-help withdraw-amount-note">
          {t("Mínimo")} <strong>{minWithdraw.toFixed(2)} USDT</strong> · {t("Comisión retiro")}{" "}
          <strong>{feePercent}%</strong>
        </p>
      </div>

      <div className="panel withdraw-panel">
        <h3>{t("Contraseña de seguridad")}</h3>

        <div className="password-field">
          <input
            className="withdraw-input"
            value={securityPassword}
            onChange={(e) => setSecurityPassword(e.target.value)}
            placeholder={t("Contraseña de seguridad")}
            type={showPassword ? "text" : "password"}
          />

          <button
            className="eye-btn"
            type="button"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <FiEyeOff /> : <FiEye />}
          </button>
        </div>
      </div>

      <div className="withdraw-real-row withdraw-real-compact">
        <span>{t("Llegada real")}</span>
        <strong>{realArrival.toFixed(6)} USDT</strong>
      </div>

      <div className="withdraw-small-note">
        <FiInfo />
        {t("Solo puedes solicitar 1 retiro cada 24 horas.")}
      </div>

      <button
        className="primary-btn recharge-main-btn withdraw-confirm-compact"
        type="button"
        onClick={handleConfirm}
        disabled={loading || sending}
      >
        {sending ? t("Procesando...") : t("Confirmar retiro")}
      </button>

      <div className="withdraw-mini-reminder">
        <strong>{t("Recordatorio:")}</strong> {t("Solo se pueden retirar las ganancias disponibles;")}{" "}
        {t("el saldo de recarga/VIP no se considera retirable.")} {t("El pago llega entre 5 minutos a 24 horas.")}
      </div>
    </div>
  );
}
