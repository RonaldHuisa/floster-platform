import React, { useState } from "react";
import { FiGlobe, FiDownloadCloud, FiVolume2, FiRefreshCw, FiLogOut, FiAward, FiBookOpen } from "react-icons/fi";
import PopupInfo from "../components/PopupInfo";
import VideoCard from "../components/VideoCard";
import { useNavigate } from "react-router-dom";

export default function Home() {
    const [showPopup, setShowPopup] = useState(true);
    const navigate = useNavigate();
    const demoImg = "https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=1200&auto=format&fit=crop";

    return (
        <div className="page page-home">
            <header className="top-header">
                <div className="brand">
                    <div className="brand-logo">BF</div>
                    <div className="brand-text">BaolongTV</div>
                </div>

                <div className="top-actions">
                    <button className="app-mini-btn">
                        <FiDownloadCloud />
                        <span>App</span>
                    </button>
                    <FiGlobe className="header-icon" />
                </div>
            </header>

            <div className="hero-banner">
                <img src={demoImg} alt="banner" />
            </div>

            <div className="search-pill">
                <FiVolume2 />
                <span>baolongtv</span>
            </div>

            <div className="quick-grid">
                <div className="quick-item clickable-quick" onClick={() => navigate("/recharge")}>
                    <FiRefreshCw />
                    <span>Recargar</span>
                </div>

                <div className="quick-item" onClick={() => navigate("/withdraw")}>
                    <FiLogOut />
                    <span>Retirar</span>
                </div>

                <div className="quick-item">
                    <FiAward />
                    <span>Centro de miembros</span>
                </div>

                <div className="quick-item">
                    <FiBookOpen />
                    <span>Tutorial del sistema</span>
                </div>
            </div>

            <section className="section">
                <h3 className="section-title">Clasificación de vídeos</h3>
                <div className="category-grid">
                    <div className="category-card">
                        <div className="category-icon">AD</div>
                        <div className="category-label">Anuncio comercial</div>
                    </div>
                    <div className="category-card">
                        <div className="category-icon">•••</div>
                        <div className="category-label">Remolque</div>
                    </div>
                    <div className="category-card">
                        <div className="category-icon">♪</div>
                        <div className="category-label">Música</div>
                    </div>
                </div>
            </section>

            <section className="section">
                <div className="section-row">
                    <h3 className="section-title">Anuncio comercial</h3>
                    <div className="mint-dot">›</div>
                </div>

                <div className="video-grid">
                    <VideoCard title="Tools made to help you save." views="100958" time="00:30" image={demoImg} />
                    <VideoCard title="Coca-Cola to Turn Up the M..." views="119911" time="00:25" image={demoImg} />
                    <VideoCard title="Make Every Wash Count" views="56468" time="00:30" image={demoImg} />
                    <VideoCard title="Only Basketball | Nike" views="87089" time="01:00" image={demoImg} />
                </div>
            </section>

            {showPopup && <PopupInfo onClose={() => setShowPopup(false)} />}
        </div>
    );
}