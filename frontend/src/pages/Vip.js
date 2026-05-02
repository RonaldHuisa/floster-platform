import React, { useCallback, useEffect, useState } from "react";
import { getVipStatus, buyVipPackage } from "../services/authService";
import { useNavigate } from "react-router-dom";

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
      `¿Confirmas comprar VIP${pkg.level} por ${price.toFixed(2)} USDT?`
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

      <h2 className="page-title">Centro de miembros</h2>

      <div className="vip-summary">
        <div className="vip-summary-item">
          <strong>{Number(data?.todayIncomeUsdt || 0).toFixed(2)}</strong>
          <span>Ganancias de hoy(USDT)</span>
        </div>

        <div className="vip-summary-divider" />

        <div className="vip-summary-item">
          <strong>{Number(data?.earningsBalanceUsdt || 0).toFixed(2)}</strong>
          <span>Ganancias acumuladas(USDT)</span>
        </div>
      </div>

      <div className="vip-countdown">
        <strong>365 días</strong>
        <span>Tiempo válido según paquete comprado</span>
      </div>

      <div className="vip-badge">Paquete especial</div>

      <div className="vip-package-list">
        {packages.map((pkg) => (
          <div className="vip-card" key={pkg.id}>
            <div className="vip-card-header">
              <h3>{pkg.name}</h3>

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
                <strong>1Veces</strong>
                <span>Ganancias diarias</span>
              </div>

              <div>
                <strong>{pkg.validDays}Días</strong>
                <span>Tiempo válido</span>
              </div>

              <div>
                <strong>{Number(pkg.dailyIncomeUsdt).toFixed(2)}USDT</strong>
                <span>Ingreso diario</span>
              </div>
            </div>

            {pkg.isActive ? (
              <button className="vip-btn disabled" disabled>
                Activo hasta{" "}
                {new Date(pkg.expiresAt).toLocaleDateString()}
              </button>
            ) : pkg.isPurchasable ? (
              <button
                className="vip-btn"
                onClick={() => handleBuy(pkg)}
                disabled={buyingLevel === pkg.level}
              >
                {buyingLevel === pkg.level
                  ? "Procesando..."
                  : `Comprar por ${Number(pkg.priceUsdt).toFixed(2)} USDT`}
              </button>
            ) : (
              <button className="vip-btn disabled" disabled>
                Abierto pronto
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}