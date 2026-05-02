const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getMyWallet } = require("../controllers/walletController");

const router = express.Router();

router.get("/me", authMiddleware, getMyWallet);

module.exports = router;