import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiClock } from "react-icons/fi";
import BottomNav from "../components/BottomNav";
import { getTasksDashboard, completeVipTask } from "../services/authService";

function formatCountdown(ms) {
  if (ms <= 0) return "00:00:00";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

function formatAmount(value) {
  return Number(value || 0).toFixed(2);
}

export default function Tasks() {
  const navigate = useNavigate();
  const messageTimerRef = useRef(null);

  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [processingTaskId, setProcessingTaskId] = useState(null);
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState("00:00:00");

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getTasksDashboard();
      setData(result);
    } catch (error) {
      setMessage(error.message || "Error al cargar tareas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!message) return undefined;

    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
    }

    messageTimerRef.current = setTimeout(() => {
      setMessage("");
    }, 3200);

    return () => {
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
      }
    };
  }, [message]);

  useEffect(() => {
    if (!data?.nextResetAt) {
      setCountdown("00:00:00");
      return undefined;
    }

    const updateCountdown = () => {
      const resetTime = new Date(data.nextResetAt).getTime();
      const now = Date.now();
      const diff = resetTime - now;

      setCountdown(formatCountdown(diff));

      if (diff <= 0) {
        loadTasks();
      }
    };

    updateCountdown();

    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [data?.nextResetAt, loadTasks]);

  const tasks = data?.tasks ?? [];

  const pendingTasks = tasks.filter((task) => task.status !== "completed");
  const completedTasksList = tasks.filter((task) => task.status === "completed");

  const currentList =
    activeTab === "pending" ? pendingTasks : completedTasksList;

  const handleCompleteTask = async (taskId) => {
    if (!taskId) {
      setMessage("Error: esta tarea no tiene ID válido.");
      return;
    }

    try {
      setProcessingTaskId(taskId);
      setMessage("");

      const result = await completeVipTask(taskId);

      setMessage(result.message || "Tarea completada correctamente.");
      await loadTasks();
      setActiveTab("completed");
    } catch (error) {
      setMessage(error.message || "Error al completar tarea.");
    } finally {
      setProcessingTaskId(null);
    }
  };

  const balance = formatAmount(data?.withdrawableBalanceUsdt ?? 0);
  const completed = Number(data?.completedTasks ?? completedTasksList.length);
  const total = Number(data?.totalTasks ?? tasks.length);
  const pending = Number(data?.pendingTasks ?? pendingTasks.length);

  return (
    <div className="page tasks-clean-page">
      <div className="tasks-clean-header">
        <div className="tasks-clean-logo">
          <img src="/luven_favicon.ico" alt="Luven" />
        </div>

        <h1 className="tasks-clean-title">Tareas</h1>
      </div>

      <section className="panel tasks-clean-card">
        <div className="tasks-clean-top">
          <div className="tasks-clean-balance">
            <span>Balance total</span>
            <strong>{balance}</strong>
          </div>

          <button
            type="button"
            className="tasks-clean-recharge"
            onClick={() => navigate("/recharge")}
          >
            Recargar
          </button>
        </div>

        <div className="tasks-clean-stats">
          <div>
            <strong>{completed}</strong>
            <span>Terminado</span>
          </div>

          <div>
            <strong>{total}</strong>
            <span>Total</span>
          </div>

          <div>
            <strong>{pending}</strong>
            <span>En curso</span>
          </div>
        </div>

        <div className="tasks-clean-countdown">
          <strong>{countdown}</strong>
          <span>
            <FiClock />
            Reinicio diario: 9:00 AM hora Perú
          </span>
        </div>

        <div className="tasks-clean-tabs">
          <button
            type="button"
            className={`tasks-clean-tab ${
              activeTab === "pending" ? "active" : ""
            }`}
            onClick={() => setActiveTab("pending")}
          >
            En curso
          </button>

          <button
            type="button"
            className={`tasks-clean-tab ${
              activeTab === "completed" ? "active" : ""
            }`}
            onClick={() => setActiveTab("completed")}
          >
            Terminado
          </button>
        </div>

        <div className="tasks-clean-list">
          {loading && <div className="tasks-clean-empty">Cargando tareas...</div>}

          {!loading && currentList.length === 0 && (
            <div className="tasks-clean-empty">
              {activeTab === "pending"
                ? "No tienes tareas disponibles. Compra un VIP activo o espera el próximo reinicio."
                : "Todavía no tienes tareas completadas en este reinicio."}
            </div>
          )}

          {!loading &&
            currentList.map((task) => {
              const taskId =
                task.id ||
                task.taskId ||
                task.vipPurchaseId ||
                task.vip_purchase_id;

              return (
                <article
                  className="tasks-clean-item"
                  key={taskId || `${task.vipLevel}-${task.rewardUsdt}`}
                >
                  <div>
                    <h3>
                      {task.title ||
                        `Tarea VIP${task.vipLevel || task.level || ""}`}
                    </h3>

                    <p>
                      Ganancia:{" "}
                      <strong>
                        {formatAmount(task.rewardUsdt || task.reward_usdt)} USDT
                      </strong>
                    </p>
                  </div>

                  {task.status === "completed" ? (
                    <span className="tasks-clean-completed">Completado</span>
                  ) : (
                    <button
                      type="button"
                      className="tasks-clean-complete-btn"
                      disabled={!taskId || processingTaskId === taskId}
                      onClick={() => handleCompleteTask(taskId)}
                    >
                      {processingTaskId === taskId ? "Procesando..." : "Completar"}
                    </button>
                  )}
                </article>
              );
            })}
        </div>
      </section>

      {message && <div className="tasks-clean-toast">{message}</div>}

      <BottomNav />
    </div>
  );
}
