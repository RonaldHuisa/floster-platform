import React from "react";
import {
  FiDownloadCloud,
  FiGlobe,
  FiRefreshCw,
  FiLogOut,
  FiBell,
  FiShield,
  FiTrendingUp,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const platformUpdates = [
  {
    icon: <FiShield />,
    title: "Paquetes VIP activos",
    text: "Gestiona tus niveles VIP y revisa tus ganancias diarias desde el centro de miembros.",
    tone: "tone-lavender",
  },
  {
    icon: <FiTrendingUp />,
    title: "Retiros y recargas",
    text: "Mantén tu saldo organizado usando la cartera, historial y panel de recarga.",
    tone: "tone-mint",
  },
  {
    icon: <FiBell />,
    title: "Recordatorios",
    text: "Completa tus tareas dentro del periodo diario para mantener el flujo de ingresos.",
    tone: "tone-blue",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const demoImg =
    "https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=1200&auto=format&fit=crop";

  return (
    <div className="page page-home">
      <header className="top-header">
        <div className="brand">
          <div className="brand-logo">BF</div>
          <div>
            <div className="eyebrow">Panel principal</div>
            <div className="brand-text">BaolongTV</div>
          </div>
        </div>

        <div className="top-actions">
          <button className="app-mini-btn" type="button">
            <FiDownloadCloud />
            <span>App</span>
          </button>
          <FiGlobe className="header-icon" />
        </div>
      </header>

      <div className="hero-banner">
        <img src={demoImg} alt="BaolongTV" />
      </div>

      <div className="home-action-grid">
        <button className="home-action-card" type="button" onClick={() => navigate("/recharge")}>
          <span className="icon-badge tone-mint">
            <FiRefreshCw />
          </span>
          <span>Recargar</span>
        </button>

        <button className="home-action-card" type="button" onClick={() => navigate("/withdraw")}>
          <span className="icon-badge tone-peach">
            <FiLogOut />
          </span>
          <span>Retirar</span>
        </button>
      </div>

      <section className="panel home-status-panel">
        <div className="section-row">
          <div>
            <div className="eyebrow">Resumen</div>
            <h3 className="section-title">Actividad de plataforma</h3>
          </div>
          <span className="soft-pill">Actualizado</span>
        </div>

        <div className="updates-carousel">
          {platformUpdates.map((item) => (
            <article className="update-card" key={item.title}>
              <span className={`icon-badge ${item.tone}`}>{item.icon}</span>
              <div>
                <h4>{item.title}</h4>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
