const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const walletRoutes = require("./routes/walletRoutes");
const depositRoutes = require("./routes/depositRoutes");
const withdrawRoutes = require("./routes/withdrawRoutes");
const adminWithdrawRoutes = require("./routes/adminWithdrawRoutes");
const referralRoutes = require("./routes/referralRoutes");
const vipRoutes = require("./routes/vipRoutes");
const taskRoutes = require("./routes/taskRoutes");
const { sweepAllPendingDeposits } = require("./services/sweepService");


const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://luven.vip",
  "https://www.luven.vip",
  "https://floster-platform.onrender.com",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS bloqueado para origin: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Backend BaolongTV funcionando correctamente.",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/deposits", depositRoutes);
app.use("/api/withdraw", withdrawRoutes);
app.use("/api/admin", adminWithdrawRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/vip", vipRoutes);
app.use("/api/tasks", taskRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);

  if (process.env.ENABLE_SWEEP_WORKER !== "false") {
    const intervalMs = Number(process.env.SWEEP_WORKER_INTERVAL_MS || 60000);

    console.log(`Sweep worker activo cada ${intervalMs} ms.`);

    setInterval(async () => {
      try {
        const results = await sweepAllPendingDeposits(
          Number(process.env.SWEEP_WORKER_LIMIT || 25)
        );

        if (results.length > 0) {
          console.log("SWEEP WORKER RESULT:", JSON.stringify(results, null, 2));
        }
      } catch (error) {
        console.error("SWEEP WORKER ERROR:", error.message);
      }
    }, intervalMs);
  }
});