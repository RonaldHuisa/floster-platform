import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function Tasks() {
  const navigate = useNavigate();

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
    if (!data?.nextResetAt) {
      setCountdown("00:00:00");
      return;
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
    } catch (error) {
      setMessage(error.message || "Error al completar tarea.");
    } finally {
      setProcessingTaskId(null);
    }
  };

  const balance = Number(data?.withdrawableBalanceUsdt ?? 0).toFixed(2);
  const completed = Number(data?.completedTasks ?? completedTasksList.length);
  const total = Number(data?.totalTasks ?? tasks.length);
  const pending = Number(data?.pendingTasks ?? pendingTasks.length);

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <div className="tasks-avatar">BF</div>
        <h1 className="tasks-title">Tareas</h1>
      </div>

      <section className="tasks-card">
        <div className="tasks-balance-row">
          <div className="tasks-balance">
            <strong>{balance}</strong>
            <span>Balance total</span>
          </div>

          <button
            type="button"
            className="tasks-recharge-btn"
            onClick={() => navigate("/recharge")}
          >
            Recargar
          </button>
        </div>

        <div className="tasks-stats">
          <div>
            <strong>{completed}</strong>
            <span>Terminado</span>
          </div>

          <div>
            <strong>{total}</strong>
            <span>Todo</span>
          </div>

          <div>
            <strong>{pending}</strong>
            <span>En curso</span>
          </div>
        </div>

        <div className="tasks-countdown">
          <strong>{countdown}</strong>
          <span>Reinicio diario: 9:00 AM hora Perú</span>
        </div>

        <button type="button" className="tasks-gate-btn">
          Gatear
        </button>

        <div className="tasks-tabs">
          <button
            type="button"
            className={`tasks-tab ${activeTab === "pending" ? "active" : ""}`}
            onClick={() => setActiveTab("pending")}
          >
            En curso
          </button>

          <button
            type="button"
            className={`tasks-tab ${activeTab === "completed" ? "active" : ""
              }`}
            onClick={() => setActiveTab("completed")}
          >
            Terminado
          </button>
        </div>

        <div className="tasks-list">
          {loading && <div className="tasks-empty">Cargando tareas...</div>}

          {!loading && currentList.length === 0 && (
            <div className="tasks-empty">
              No tienes tareas disponibles. Compra un VIP activo o espera el
              próximo reinicio.
            </div>
          )}

          {!loading &&
            currentList.map((task) => {
              const taskId = task.id || task.taskId || task.vipPurchaseId || task.vip_purchase_id;

              return (
                <div className="task-item" key={taskId || `${task.vipLevel}-${task.rewardUsdt}`}>
                  <h3>{task.title || `Tarea VIP${task.vipLevel || task.level || ""}`}</h3>

                  <p>
                    Ganancia:{" "}
                    <strong>
                      {Number(task.rewardUsdt || task.reward_usdt || 0).toFixed(2)} USDT
                    </strong>
                  </p>

                  {task.status === "completed" ? (
                    <div className="task-completed">Completado</div>
                  ) : (
                    <button
                      type="button"
                      className="task-complete-btn"
                      disabled={!taskId || processingTaskId === taskId}
                      onClick={() => handleCompleteTask(taskId)}
                    >
                      {processingTaskId === taskId ? "Procesando..." : "Completar tarea"}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      {message && <div className="toast-message">{message}</div>}

      <BottomNav />
    </div>
  );
}