import React, { useEffect, useState } from "react";
import {
  FiDownloadCloud,
  FiGlobe,
  FiRefreshCw,
  FiLogOut,
  FiShield,
  FiTrendingUp,
  FiGift,
  FiChevronRight,
  FiZap,
  FiVolume2,
  FiDollarSign,
  FiClock,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const banners = [
  {
    image: "/images/banner1.svg",
    title: "Luven Premium",
    subtitle: "Gestiona recargas, retiros y beneficios VIP desde un panel claro.",
  },
  {
    image: "/images/banner2.svg",
    title: "Panel VIP",
    subtitle: "Visualiza tu inversión, rendimiento y actividad diaria.",
  },
];

const defaultActivityConfig = {
  domains: ["gmail.com", "outlook.com", "hotmail.com"],
  statuses: [
    "está feliz",
    "está motivado",
    "está activo",
    "está avanzando",
    "está revisando su panel",
    "está conectado",
    "está explorando Luven",
  ],
  emailPrefixes: ["lu", "mi", "ke", "an", "so", "la", "ma", "jo", "al", "de"],
};

const vipPlans = [
  { name: "VIP1", price: 9, daily: 1, days: 90 },
  { name: "VIP2", price: 60, daily: 7, days: 90 },
  { name: "VIP3", price: 160, daily: 20, days: 90 },
  { name: "VIP4", price: 560, daily: 72, days: 90 },
  { name: "VIP5", price: 960, daily: 129, days: 90 },
  { name: "VIP6", price: 3000, daily: 420, days: 90 },
  { name: "VIP7", price: 8000, daily: 1160, days: 90 },
  { name: "VIP8", price: 20000, daily: 3000, days: 90 },
];

function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function buildRandomActivity(config = defaultActivityConfig, total = 12) {
  const domains =
    config.domains && config.domains.length
      ? config.domains
      : defaultActivityConfig.domains;

  const statuses =
    config.statuses && config.statuses.length
      ? config.statuses
      : defaultActivityConfig.statuses;

  const prefixes =
    config.emailPrefixes && config.emailPrefixes.length
      ? config.emailPrefixes
      : defaultActivityConfig.emailPrefixes;

  return Array.from({ length: total }, () => {
    const prefix = getRandomItem(prefixes).slice(0, 2).toLowerCase();
    const domain = getRandomItem(domains);
    const status = getRandomItem(statuses);

    return `${prefix}*******@${domain} ${status}`;
  });
}

function formatUsdt(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Home() {
  const navigate = useNavigate();
  const [activeBanner, setActiveBanner] = useState(0);
  const [tickerItems, setTickerItems] = useState(() =>
    buildRandomActivity(defaultActivityConfig, 12)
  );

  useEffect(() => {
    async function loadActivityMessages() {
      try {
        const response = await fetch("/data/activityMessages.json");
        const config = response.ok
          ? await response.json()
          : defaultActivityConfig;

        setTickerItems(buildRandomActivity(config, 12));
      } catch (error) {
        setTickerItems(buildRandomActivity(defaultActivityConfig, 12));
      }
    }

    loadActivityMessages();

    const refresh = setInterval(() => {
      loadActivityMessages();
    }, 12000);

    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBanner((current) => (current + 1) % banners.length);
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="page page-home home-premium-page">
      <header className="top-header home-premium-header">
        <div className="brand home-premium-brand">
          <div className="brand-logo home-luven-logo">
            <img src="/luven_favicon.ico" alt="Luven" />
          </div>

          <div>
            <div className="eyebrow">Panel principal</div>
            <div className="brand-text home-luven-title">Luven</div>
          </div>
        </div>

        <div className="top-actions">
          <button className="app-mini-btn home-premium-app-btn" type="button">
            <FiDownloadCloud />
            <span>App</span>
          </button>
          <FiGlobe className="header-icon home-premium-globe" />
        </div>
      </header>

      <section className="hero-banner home-premium-banner">
        {banners.map((banner, index) => (
          <img
            key={banner.image}
            src={banner.image}
            alt={banner.title}
            className={index === activeBanner ? "active" : ""}
          />
        ))}

        <div className="home-banner-overlay">
          <span className="home-banner-pill">Premium</span>
          <h2>{banners[activeBanner].title}</h2>
          <p>{banners[activeBanner].subtitle}</p>
        </div>

        <div className="home-banner-dots">
          {banners.map((banner, index) => (
            <button
              key={banner.image}
              type="button"
              aria-label={`Banner ${index + 1}`}
              className={index === activeBanner ? "active" : ""}
              onClick={() => setActiveBanner(index)}
            />
          ))}
        </div>
      </section>

      <div className="home-activity-ticker" aria-label="Actividad reciente">
        <span className="home-activity-speaker">
          <FiVolume2 />
        </span>

        <div className="home-activity-track">
          <div className="home-activity-content">
            {[...tickerItems, ...tickerItems].map((item, index) => (
              <span className="home-activity-item" key={`${item}-${index}`}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="home-action-grid home-premium-actions">
        <button
          className="home-action-card home-action-recharge"
          type="button"
          onClick={() => navigate("/recharge")}
        >
          <span className="home-action-icon">
            <FiRefreshCw />
          </span>
          <span>Recargar</span>
        </button>

        <button
          className="home-action-card home-action-withdraw"
          type="button"
          onClick={() => navigate("/withdraw")}
        >
          <span className="home-action-icon">
            <FiLogOut />
          </span>
          <span>Retirar</span>
        </button>
      </div>

      <button
        className="home-invite-banner"
        type="button"
        onClick={() => navigate("/promotion")}
      >
        <div className="home-invite-content">
          <span className="home-invite-icon">
            <FiGift />
          </span>

          <div>
            <h3>Invitar y ganar</h3>
            <p>Comparte tu enlace y aumenta tu red de referidos.</p>
          </div>
        </div>

        <span className="home-invite-cta">
          Invitar ahora
          <FiChevronRight />
        </span>
      </button>

      <button
        className="home-income-banner"
        type="button"
        onClick={() => navigate("/vip")}
      >
        <div className="home-income-content">
          <span className="home-income-icon">
            <FiZap />
          </span>

          <div>
            <h3>Aumenta tus ingresos</h3>
            <p>Sube de nivel para desbloquear misiones más avanzadas.</p>
          </div>
        </div>

        <span className="home-income-cta">Desbloquear ahora</span>
      </button>

      <section className="panel home-vip-table-panel">
        <div className="section-row home-vip-header">
          <div>
            <div className="eyebrow">Planes disponibles</div>
            <h3 className="section-title">Tabla VIP</h3>
          </div>

          <button
            className="soft-pill home-vip-see-all"
            type="button"
            onClick={() => navigate("/vip")}
          >
            Ver planes
          </button>
        </div>

        <div className="home-vip-table-wrap">
          <div className="home-vip-table">
            <div className="home-vip-table-row home-vip-table-head">
              <span>VIP</span>
              <span>Precio</span>
              <span>Diario</span>
              <span>Días</span>
            </div>

            {vipPlans.map((plan) => (
              <div className="home-vip-table-row" key={plan.name}>
                <span className="home-vip-name">
                  <FiShield />
                  {plan.name}
                </span>

                <span className="home-vip-price">
                  <FiDollarSign />
                  {formatUsdt(plan.price)}
                </span>

                <span className="home-vip-daily">
                  <FiTrendingUp />
                  {formatUsdt(plan.daily)}
                </span>

                <span className="home-vip-days">
                  <FiClock />
                  {plan.days}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="home-vip-note">
          Los valores pueden variar según la configuración activa de la plataforma.
        </p>
      </section>
    </div>
  );
}
