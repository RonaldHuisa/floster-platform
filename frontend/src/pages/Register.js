import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FiGlobe, FiRefreshCcw, FiEye, FiEyeOff } from "react-icons/fi";
import { registerUser, saveSession } from "../services/authService";



export default function Register() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [securityPassword, setSecurityPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [showSecurityPassword, setShowSecurityPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");



    const [searchParams] = useSearchParams();
    const referralFromUrl = searchParams.get("ref") || "351794";

    const [referralCode, setReferralCode] = useState(referralFromUrl);

    const isValidEmail = (value) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    };

    const isStrongPassword = (value) => {
        const minLength = value.length >= 8;
        const hasUppercase = /[A-Z]/.test(value);
        const hasLowercase = /[a-z]/.test(value);
        const hasNumber = /[0-9]/.test(value);

        return minLength && hasUppercase && hasLowercase && hasNumber;
    };

    const handleRegister = async (e) => {
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
            setError("Ingresa tu contraseña de inicio de sesión.");
            return;
        }

        if (!securityPassword.trim()) {
            setError("Confirma tu contraseña.");
            return;
        }

        if (!isStrongPassword(password)) {
            setError("La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un número.");
            return;
        }

        if (password !== securityPassword) {
            setError("Las contraseñas no coinciden.");
            return;
        }
        setLoading(true);

        try {
            const data = await registerUser({
                email,
                password,
                securityPassword,
                referralCode,
            });

            saveSession(data);
            navigate("/login");
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
                    <span className="auth-title-badge">CREAR CUENTA</span>
                </div>

                <form onSubmit={handleRegister} className="auth-form">
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
                            autoComplete="new-password"
                        />

                        <button
                            type="button"
                            className="eye-btn"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                    </div>

                    <div className="password-field">
                        <input
                            className="auth-input"
                            type={showSecurityPassword ? "text" : "password"}
                            value={securityPassword}
                            onChange={(e) => setSecurityPassword(e.target.value)}
                            placeholder="Confirmar contraseña"
                            autoComplete="new-password"
                        />

                        <button
                            type="button"
                            className="eye-btn"
                            onClick={() => setShowSecurityPassword(!showSecurityPassword)}
                        >
                            {showSecurityPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                    </div>

                    <input
                        className="auth-input"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value)}
                        placeholder="Código de invitación"
                    />

                    {error && <div className="auth-error">{error}</div>}

                    <button className="primary-btn" type="submit" disabled={loading}>
                        {loading ? "Registrando..." : "Registro"}
                    </button>
                </form>

                <p className="auth-footer-link">
                    ¿Ya tienes una cuenta? <Link to="/login">Acceso</Link>
                </p>
            </div>
        </div>
    );
}