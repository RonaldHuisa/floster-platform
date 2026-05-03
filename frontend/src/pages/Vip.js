import React, { useCallback, useEffect, useState } from "react";
import { FiAward, FiCheckCircle, FiLock, FiStar, FiZap } from "react-icons/fi";
import { getVipStatus, buyVipPackage } from "../services/authService";
import { useNavigate } from "react-router-dom";

const vipMeta = {
  0: { label: "Base", tone: "tier-muted", icon: <FiLock /> },
  1: { label: "Inicio", tone: "tier-blue", icon: <FiStar /> },
  2: { label: "Impulso", tone: "tier-mint", icon: <FiZap /> },
  3: { label: "Elite", tone: "tier-lavender", icon: <FiAward /> },
  4: { label: "Prime", tone: "tier-peach", icon: <FiAward /> },
  5: { label: "Máster", tone: "tier-success", icon: <FiCheckCircle /> },
};

function getVipMeta(level) {
  return vipMeta[level] || {
    label: "Premium",
    tone: "tier-blue",
    icon: <FiAward />,
  };
}

export default function Vip() {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buyingLevel, setBuyingLevel] = useState(null);
  const [toast, setToast] = useState("");

  const showToast = useCallback((message) => {
    setToast(message);

    setTimeout(() => {
      setToast("");
    }, 3000);
  }, []);

  const loadVip = useCallback(async () => {
    try {
      setLoading(true);

      const result = await getVipStatus();
      setData(result);
    } catch (error) {
      showToast(error.message || "Error al cargar VIP");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadVip();
  }, [loadVip]);

  const handleBuy = async (pkg) => {
    if (!pkg.isPurchasable) {
      showToast("Este paquete todavía no está disponible.");
      return;
    }

    if (pkg.isActive) {
      showToast("Ya tienes activo este paquete VIP.");
      return;
    }

    const balance = Number(data?.rechargeBalanceUsdt || 0);
    const price = Number(pkg.priceUsdt || 0);

    if (balance < price) {
      showToast("Saldo insuficiente. Por favor recarga primero.");
      setTimeout(() => {
        navigate("/recharge");
      }, 1200);
      return;
    }

    const confirmBuy = window.confirm(
      `¿Confirmas comprar ${pkg.name} por ${price.toFixed(2)} USDT?`
    );

    if (!confirmBuy) return;

    try {
      setBuyingLevel(pkg.level);

      const result = await buyVipPackage(pkg.level);

      showToast(result.message || "Compra VIP realizada.");
      await loadVip();
    } catch (error) {
      showToast(error.message || "Error al comprar VIP.");
    } finally {
      setBuyingLevel(null);
    }
  };

  if (loading) {
    return (
      <div className="page vip-page">
        <div className="panel">Cargando VIP...</div>
      </div>
    );
  }

  const packages = data?.packages || [];

  return (
    <div className="page vip-page">
      {toast && (
        <div className="success-toast">
          <strong>{toast}</strong>
        </div>
      )}

      <div className="vip-main-header">
        <div>
          <div className="eyebrow">Centro de miembros</div>
          <h2 className="page-title">Planes VIP</h2>
        </div>
        <span className="soft-pill">90 días</span>
      </div>

      <div className="vip-summary">
        <div className="vip-summary-item">
          <strong>{Number(data?.todayIncomeUsdt || 0).toFixed(2)}</strong>
          <span>Ganancias hoy ( USDT )</span>
        </div>

        <div className="vip-summary-divider" />

        <div className="vip-summary-item">
          <strong>{Number(data?.earningsBalanceUsdt || 0).toFixed(2)}</strong>
          <span>Acumulado ( USDT )</span>
        </div>
      </div>

      <div className="vip-countdown">
        <strong>Tiempo válido según paquete comprado</strong>
        <span>Elige el plan que mejor se adapte a tu saldo de recarga.</span>
      </div>

      <div className="vip-package-list">
        {packages.map((pkg) => {
          const meta = getVipMeta(Number(pkg.level));

          return (
            <div className={`vip-card ${meta.tone}`} key={pkg.id}>
              <div className="vip-card-header">
                <div className="vip-title-wrap">
                  <span className="vip-level-icon">{meta.icon}</span>
                  <div>
                    <h3>{pkg.name}</h3>
                    <p>{meta.label}</p>
                  </div>
                </div>

                {pkg.isActive ? (
                  <span className="vip-status active">Activo</span>
                ) : pkg.isPurchasable ? (
                  <span className="vip-status available">Disponible</span>
                ) : (
                  <span className="vip-status soon">Próximamente</span>
                )}
              </div>

              <div className="vip-stats">
                <div>
                  <strong>1 vez</strong>
                  <span>Ingreso diario</span>
                </div>

                <div>
                  <strong>{pkg.validDays} días</strong>
                  <span>Duración</span>
                </div>

                <div>
                  <strong>{Number(pkg.dailyIncomeUsdt).toFixed(2)}</strong>
                  <span>USDT/día</span>
                </div>
              </div>

              <div className="vip-price-row">
                <span>Costo del plan</span>
                <strong>{Number(pkg.priceUsdt).toFixed(2)} USDT</strong>
              </div>

              {pkg.isActive ? (
                <button className="vip-btn disabled" disabled>
                  Activo hasta {new Date(pkg.expiresAt).toLocaleDateString()}
                </button>
              ) : pkg.isPurchasable ? (
                <button
                  className="vip-btn"
                  onClick={() => handleBuy(pkg)}
                  disabled={buyingLevel === pkg.level}
                >
                  {buyingLevel === pkg.level
                    ? "Procesando..."
                    : `Comprar · ${Number(pkg.priceUsdt).toFixed(2)} USDT`}
                </button>
              ) : (
                <button className="vip-btn disabled" disabled>
                  Abierto pronto
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
