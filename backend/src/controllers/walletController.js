const pool = require("../config/db");

async function getMyWallet(req, res) {
  try {
    const userId = req.user.userId;

    const walletResult = await pool.query(
      `
      SELECT id, user_id, network, address, public_key, created_at
      FROM wallets
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({
        message: "No se encontró wallet para este usuario.",
      });
    }

    return res.json({
      wallet: walletResult.rows[0],
    });
  } catch (error) {
    console.error("GET MY WALLET ERROR:", error);
    return res.status(500).json({
      message: "Error interno al obtener la wallet.",
    });
  }
}

module.exports = {
  getMyWallet,
};