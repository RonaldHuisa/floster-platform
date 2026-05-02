import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiGlobe, FiRefreshCcw, FiEye, FiEyeOff } from "react-icons/fi";
import { loginUser, saveSession } from "../services/authService";

export default function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const isValidEmail = (value) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");

        if (!email.trim()) {
            setError("Ingresa tu correo electrónico.");
            return;
        }

        if (!isValidEmail(email)) {
            setError("Ingresa un correo electrónico válido.");
            return;
        }

        if (!password.trim()) {
            setError("Ingresa tu contraseña.");
            return;
        }

        setLoading(true);

        try {
            const data = await loginUser({
                email,
                password,
            });

            saveSession(data);
            navigate("/home");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-top-icons">
                <FiRefreshCcw />
                <FiGlobe />
            </div>

            <div className="auth-logo-block">
                <div className="auth-logo">BF</div>
                <h1>BaolongTV</h1>
            </div>

            <div className="auth-card">
                <div className="auth-title-box">
                    <span className="auth-title-badge">INICIAR SESIÓN</span>
                </div>

                <form onSubmit={handleLogin} className="auth-form">
                    <input
                        className="auth-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Correo electrónico"
                        autoComplete="email"
                    />

                    <div className="password-field">
                        <input
                            className="auth-input"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Contraseña de inicio de sesión"
                            autoComplete="current-password"
                        />

                        <button
                            type="button"
                            className="eye-btn"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                    </div>

                    <label className="remember-row">
                        <input type="checkbox" defaultChecked />
                        <span>Acuérdate de mí</span>
                    </label>

                    {error && <div className="auth-error">{error}</div>}

                    <button className="primary-btn" type="submit" disabled={loading}>
                        {loading ? "Ingresando..." : "Acceso"}
                    </button>
                </form>

                <p className="auth-footer-link">
                    ¿Sin cuenta? <Link to="/register">Registro</Link>
                </p>
            </div>
        </div>
    );
}