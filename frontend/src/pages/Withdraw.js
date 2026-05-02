import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiClock, FiEye, FiEyeOff } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import {
    createWithdrawRequest,
    getWithdrawInfo,
} from "../services/authService";

export default function Withdraw() {
    const navigate = useNavigate();
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

            showToast("Solicitud de retiro creada");

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
        <div className="page withdraw-page">
            {toast && (
                <div className="success-toast">
                    <strong>{toast}</strong>
                </div>
            )}

            <div className="recharge-header">
                <button className="icon-btn" onClick={() => navigate("/home")}>
                    <FiArrowLeft />
                </button>

                <h2>Retirar</h2>

                <button
                    className="icon-btn ghost-icon"
                    type="button"
                    onClick={() => navigate("/transactions")}
                >
                    <FiClock />
                </button>
            </div>

            <div className="withdraw-balance-card">
                <p>Activos actualmente disponibles(USDT)</p>
                <h1>{Number(available || 0).toFixed(6)}</h1>
            </div>

            <div className="panel withdraw-panel">
                <h3>Seleccione la red principal</h3>

                <div className="withdraw-network-list">
                    <button className="withdraw-network active" type="button">
                        BEP20-USDT
                    </button>
                </div>
            </div>

            <div className="panel withdraw-panel">
                <h3>dirección de retiro</h3>

                <input
                    className="withdraw-input"
                    value={withdrawalAddress}
                    onChange={(e) => setWithdrawalAddress(e.target.value)}
                    placeholder="Ingrese dirección BEP20-USDT"
                    disabled={addressLocked}
                />

                {addressLocked && (
                    <p className="withdraw-help">
                        Dirección fijada. Después del primer retiro ya no puede cambiarse.
                    </p>
                )}
            </div>

            <div className="panel withdraw-panel">
                <h3>Cantidad de retiro</h3>

                <div className="withdraw-amount-box">
                    <input
                        className="withdraw-input amount-input"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Por favor ingrese el monto de la transferencia"
                        type="number"
                        min="0"
                        step="0.000001"
                    />

                    <button type="button" onClick={handleAll}>
                        Todo
                    </button>
                </div>

                <p className="withdraw-limits">
                    Monto mínimo de retiro:{minWithdraw.toFixed(2)}USDT
                </p>

                <p className="withdraw-limits">
                    Comisión de retiro: {feePercent}%
                </p>
            </div>

            <div className="panel withdraw-panel">
                <h3>Contraseña de seguridad</h3>

                <div className="password-field">
                    <input
                        className="withdraw-input"
                        value={securityPassword}
                        onChange={(e) => setSecurityPassword(e.target.value)}
                        placeholder="Contraseña de seguridad"
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

            <div className="withdraw-real-row">
                <span>Llegada real:</span>
                <strong>{realArrival.toFixed(6)} USDT</strong>
            </div>

            <button
                className="primary-btn recharge-main-btn"
                type="button"
                onClick={handleConfirm}
                disabled={loading || sending}
            >
                {sending ? "Procesando..." : "Confirmar"}
            </button>

            <div className="recharge-notes">
                <div className="notes-title">
                    <span>!</span>
                    <span>cálido recordatorio</span>
                </div>

                <p>
                    El monto mínimo de retiro para BEP20 es {minWithdraw} USDT. La comisión
                    de retiro es {feePercent}%. El dinero invertido no puede retirarse;
                    solo pueden retirarse las ganancias disponibles.
                </p>
            </div>
        </div>
    );
}