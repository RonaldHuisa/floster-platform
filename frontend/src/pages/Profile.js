import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiChevronRight, FiCopy, FiMessageCircle, FiSend } from "react-icons/fi";
import {
  getUser,
  getWithdrawInfo,
  getPromotionDashboard,
  getVipStatus,
  logout,
} from "../services/authService";

const TELEGRAM_CHANNEL_URL = "https://t.me/baolongtv_oficial";
const TELEGRAM_SUPPORT_URL = "https://t.me/soporte_baolongtv";
function toNumber(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatUsdt(value) {
  return toNumber(value).toFixed(2);
}

function getAvatarText(email) {
  if (!email) return "BF";
  return email.slice(0, 2).toUpperCase();
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.focus();
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
}

export default function Profile() {
  const navigate = useNavigate();

  const [user] = useState(() => getUser());
  const [withdrawInfo, setWithdrawInfo] = useState(null);
  const [promotionData, setPromotionData] = useState(null);
  const [vipData, setVipData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);

      const [withdrawResult, promotionResult, vipResult] =
        await Promise.allSettled([
          getWithdrawInfo(),
          getPromotionDashboard(),
          getVipStatus(),
        ]);

      if (withdrawResult.status === "fulfilled") {
        setWithdrawInfo(withdrawResult.value);
      }

      if (promotionResult.status === "fulfilled") {
        setPromotionData(promotionResult.value);
      }

      if (vipResult.status === "fulfilled") {
        setVipData(vipResult.value);
      }

      const hasError = [withdrawResult, promotionResult, vipResult].some(
        (result) => result.status === "rejected"
      );

      if (hasError) {
        showToast("Algunos datos no se pudieron cargar.");
      }
    } catch (error) {
      showToast(error.message || "Error al cargar perfil.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProfile();

    const handleFocus = () => {
      loadProfile();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadProfile]);

  const profile = useMemo(() => {
    const email = user?.email || vipData?.user?.email || "Usuario";

    const referralCode =
      promotionData?.referralCode ||
      user?.referral_code ||
      user?.referralCode ||
      "------";

    const referralLink =
      promotionData?.referralLink ||
      `${window.location.origin}/register?ref=${referralCode}`;

    const withdrawableBalance = toNumber(
      withdrawInfo?.available ?? vipData?.earningsBalanceUsdt ?? 0
    );

    const rechargeBalance = toNumber(vipData?.rechargeBalanceUsdt ?? 0);

    const taskTodayIncome = toNumber(vipData?.todayIncomeUsdt ?? 0);
    const referralTodayIncome = toNumber(promotionData?.todayIncome ?? 0);
    const todayTotalIncome = taskTodayIncome + referralTodayIncome;

    const totalReferralIncome = toNumber(promotionData?.totalIncome ?? 0);
    const totalMembers = Number(promotionData?.totalMembers ?? 0);
    const totalTeamRecharge = toNumber(promotionData?.totalTeamRecharge ?? 0);

    return {
      email,
      referralCode,
      referralLink,
      withdrawableBalance,
      rechargeBalance,
      taskTodayIncome,
      referralTodayIncome,
      todayTotalIncome,
      totalReferralIncome,
      totalMembers,
      totalTeamRecharge,
    };
  }, [user, withdrawInfo, promotionData, vipData]);

  const handleCopyReferral = async () => {
    try {
      await copyText(profile.referralLink);
      showToast("Enlace de referido copiado.");
    } catch (error) {
      showToast("No se pudo copiar el enlace.");
    }
  };

  const openTelegram = (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="page">
      {toast && (
        <div className="success-toast">
          <strong>{toast}</strong>
        </div>
      )}

      <div className="profile-hero">
        <div className="profile-avatar">{getAvatarText(profile.email)}</div>

        <div className="profile-info">
          <h2>{profile.email}</h2>
          <span>código de invitación: {profile.referralCode}</span>
        </div>
      </div>

      {loading && <div className="panel">Cargando datos del perfil...</div>}

      <div className="wallet-panel">
        <div className="wallet-grid">
          <div
            onClick={() => navigate("/withdraw")}
            style={{ cursor: "pointer" }}
          >
            <span>Disponible para retirar (USDT)</span>
            <strong>{formatUsdt(profile.withdrawableBalance)} ›</strong>
          </div>

          <div
            onClick={() => navigate("/recharge")}
            style={{ cursor: "pointer" }}
          >
            <span>Saldo de recarga / VIP (USDT)</span>
            <strong>{formatUsdt(profile.rechargeBalance)} ›</strong>
          </div>

          <div>
            <span>Ganancias de hoy totales (USDT)</span>
            <strong>{formatUsdt(profile.todayTotalIncome)}</strong>
          </div>
        </div>
      </div>

      <div className="panel summary-panel">
        <div className="summary-top">
          <div>
            <b>{formatUsdt(profile.taskTodayIncome)}</b>
            <span>Ganancias de tareas hoy</span>
          </div>

          <div>
            <b>{formatUsdt(profile.referralTodayIncome)}</b>
            <span>Ganancias por referidos hoy</span>
          </div>
        </div>

        <div className="divider" />

        <div className="summary-bottom">
          <div
            onClick={() => navigate("/promotion")}
            style={{ cursor: "pointer" }}
          >
            <b>{profile.totalMembers}</b>
            <span>Tamaño total del equipo</span>
          </div>

          <div>
            <b>{formatUsdt(profile.totalTeamRecharge)}</b>
            <span>Recarga total del equipo</span>
          </div>

          <div>
            <b>{formatUsdt(profile.totalReferralIncome)}</b>
            <span>Ingresos por referidos</span>
          </div>
        </div>
      </div>

      <div className="menu-panel">
        <div
          className="menu-row"
          onClick={handleCopyReferral}
          style={{ cursor: "pointer" }}
        >
          <span>Copiar enlace de referido</span>
          <FiCopy />
        </div>

        <div
          className="menu-row"
          onClick={() => openTelegram(TELEGRAM_CHANNEL_URL)}
          style={{ cursor: "pointer" }}
        >
          <span>Canal oficial de Telegram</span>

          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FiSend />
            <FiChevronRight />
          </span>
        </div>

        <div
          className="menu-row"
          onClick={() => openTelegram(TELEGRAM_SUPPORT_URL)}
          style={{ cursor: "pointer" }}
        >
          <span>Servicio al cliente por Telegram</span>

          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FiMessageCircle />
            <FiChevronRight />
          </span>
        </div>
      </div>

      <button className="logout-btn" onClick={handleLogout}>
        Cerrar sesión
      </button>
    </div>
  );
}