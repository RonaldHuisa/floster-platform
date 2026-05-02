import React, { useCallback, useEffect, useState } from "react";
import { FiChevronRight, FiCopy, FiGrid } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { getPromotionDashboard } from "../services/authService";

export default function Promotion() {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [toast, setToast] = useState("");

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const loadData = useCallback(async () => {
    try {
      const result = await getPromotionDashboard();
      setData(result);
    } catch (error) {
      showToast(error.message);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleFocus = () => {
      loadData();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadData]);

  if (!data) {
    return (
      <div className="page promotion-page">
        <div className="panel">Cargando promoción...</div>
      </div>
    );
  }

  const copyLink = async () => {
    if (!data?.referralLink) {
      showToast("No hay enlace para copiar");
      return;
    }

    try {
      await navigator.clipboard.writeText(data.referralLink);
      showToast("Enlace copiado");
    } catch (error) {
      showToast("No se pudo copiar el enlace");
    }
  };

  return (
    <div className="page promotion-page">
      {toast && (
        <div className="success-toast">
          <strong>{toast}</strong>
        </div>
      )}

      <div className="promotion-header">
        <h2>Promoción</h2>

        <button
          className="promotion-qr-btn"
          type="button"
          onClick={() => navigate("/invite")}
        >
          Código QR de promoción <FiGrid />
        </button>
      </div>

      <div className="promotion-stats-row">
        <div className="promotion-stat-card">
          <p>ingresos totales del usuario</p>
          <strong>{Number(data.totalIncome).toFixed(2)}USDT</strong>
        </div>

        <div className="promotion-stat-card">
          <p>Ingresos añadidos hoy</p>
          <strong>{Number(data.todayIncome).toFixed(2)}USDT</strong>
        </div>
      </div>

      <div className="panel promotion-summary-panel">
        <div className="promotion-date-row">
          <span>🗓️ Seleccionar fecha de consulta</span>
        </div>

        <div className="promotion-total-row">
          <span>Número total de miembros del equipo:</span>
          <strong>{data.totalMembers}</strong>
        </div>

        <div className="promotion-total-row">
          <span>Recarga total del equipo</span>
          <strong>{Number(data.totalTeamRecharge).toFixed(2)} USDT</strong>
        </div>
      </div>

      <div className="panel promotion-levels-panel">
        <p className="added-today">
          Agregado hoy:<strong>{data.todayAdded}</strong>
        </p>

        {data.levels.map((level) => (
          <div className="promotion-level-block" key={level.level}>
            <div className="level-title-row">
              <h3>Datos de nivel {level.level}</h3>

              <button
                type="button"
                onClick={() => navigate(`/members/${level.level}`)}
              >
                Lista de miembros <FiChevronRight />
              </button>
            </div>

            <div className="level-grid">
              <div>
                <strong>{level.totalMembers}</strong>
                <span>Plantilla total</span>
              </div>

              <div>
                <strong>{level.activeMembers}</strong>
                <span>Número de Activos</span>
              </div>

              <div>
                <strong>{level.teamRecharge.toFixed(2)}</strong>
                <span>Equipo de recarga</span>
              </div>

              <div>
                <strong>{level.totalCommission.toFixed(2)}</strong>
                <span>Regreso total</span>
              </div>

              <div>
                <strong>{level.todayCommission.toFixed(2)}</strong>
                <span>Ganancias de hoy</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="panel invite-mini-panel">
        <h3>Enlace de invitación</h3>

        <div className="invite-link-row">
          <span>{data.referralLink}</span>

          <button type="button" onClick={copyLink}>
            <FiCopy />
          </button>
        </div>
      </div>
    </div>
  );
}