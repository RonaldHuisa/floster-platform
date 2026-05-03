import React, { useEffect, useState } from "react";
import { FiArrowLeft, FiDownload, FiUpload } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { getMyTransactions, getWithdrawInfo } from "../services/authService";

function formatAmount(value) {
  return Number(value || 0).toFixed(6);
}

export default function Transactions() {
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState("0");

  const loadTransactions = async () => {
    try {
      setLoading(true);

      const [transactionsData, withdrawInfo] = await Promise.all([
        getMyTransactions(),
        getWithdrawInfo(),
      ]);

      setTransactions(transactionsData.transactions || []);
      setAvailable(withdrawInfo.available || "0");
    } catch (error) {
      setTransactions([]);
      setAvailable("0");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  return (
    <div className="page transactions-page">
      <div className="recharge-header">
        <button className="icon-btn" onClick={() => navigate(-1)}>
          <FiArrowLeft />
        </button>

        <div>
          <div className="eyebrow">Historial</div>
          <h2>Cartera flexible</h2>
        </div>

        <div />
      </div>

      <div className="withdraw-balance-card">
        <p>Disponible para retirar</p>
        <h1>{formatAmount(available)}</h1>
        <span>USDT</span>

        <div className="history-actions">
          <button onClick={() => navigate("/recharge")}>
            <FiDownload /> Recargar
          </button>
          <button onClick={() => navigate("/withdraw")}>
            <FiUpload /> Retirar
          </button>
        </div>
      </div>

      <div className="history-title-row">
        <div>
          <div className="eyebrow">Movimientos</div>
          <h3>Detalles del activo</h3>
        </div>
        <span className="soft-pill">Todo</span>
      </div>

      {loading && <div className="panel">Cargando historial...</div>}

      {!loading && transactions.length === 0 && (
        <div className="empty-history">No hay movimientos para mostrar.</div>
      )}

      {!loading &&
        transactions.map((item) => {
          const amount = Number(item.amount_usdt || 0);

          const isDebit =
            item.direction === "debit" ||
            item.type === "withdrawal_request" ||
            item.type === "withdrawal_paid";

          const positive = !isDebit && amount >= 0;

          return (
            <div className="history-card" key={item.id}>
              <div>
                <h4>{item.title}</h4>
                <p>{new Date(item.created_at).toLocaleString()}</p>
              </div>

              <strong className={positive ? "amount-positive" : "amount-negative"}>
                {isDebit ? "-" : ""}
                {Math.abs(amount).toFixed(6)} USDT
              </strong>
            </div>
          );
        })}

      {!loading && transactions.length > 0 && (
        <div className="empty-history">No más</div>
      )}
    </div>
  );
}
