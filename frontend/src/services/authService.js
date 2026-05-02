const API_URL = process.env.REACT_APP_API_URL || "http://localhost:4000/api";

async function request(endpoint, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || data.message || "Error en la petición.");
  }

  return data;
}

export function registerUser(payload) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveSession(data) {
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  localStorage.setItem("wallet", JSON.stringify(data.wallet));
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("wallet");
}

export function getToken() {
  return localStorage.getItem("token");
}

export function getUser() {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}

export function getWallet() {
  const wallet = localStorage.getItem("wallet");
  return wallet ? JSON.parse(wallet) : null;
}


export async function getMyWalletFromApi() {
  const token = localStorage.getItem("token");

  const response = await fetch("http://localhost:4000/api/wallet/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al obtener la wallet.");
  }

  return data;
}

export async function scanMyDeposits() {
  const token = localStorage.getItem("token");

  const response = await fetch("http://localhost:4000/api/deposits/scan-me", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al escanear depósitos.");
  }

  return data;
} 

export async function getWithdrawInfo() {
  const token = localStorage.getItem("token");

  const response = await fetch("http://localhost:4000/api/withdraw/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al obtener datos de retiro.");
  }

  return data;
}

export async function createWithdrawRequest(payload) {
  const token = localStorage.getItem("token");

  const response = await fetch("http://localhost:4000/api/withdraw/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al solicitar retiro.");
  }

  return data;
}

export async function getMyTransactions() {
  const token = localStorage.getItem("token");

  const response = await fetch("http://localhost:4000/api/withdraw/transactions", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al obtener historial.");
  }

  return data;
}



export async function getAdminPendingWithdrawals() {
  const token = localStorage.getItem("token");

  const response = await fetch("http://localhost:4000/api/admin/withdrawals/pending", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al cargar retiros pendientes.");
  }

  return data;
}

export async function approveAdminWithdrawal(withdrawalId) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `http://localhost:4000/api/admin/withdrawals/${withdrawalId}/approve`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.message || "Error al aprobar retiro.");
  }

  return data;
}


export async function getPromotionDashboard() {
  const token = localStorage.getItem("token");

  const response = await fetch("http://localhost:4000/api/referrals/dashboard", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.message || "Error al cargar promoción.");
  }

  return data;
}

export async function getReferralMembers(level) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `http://localhost:4000/api/referrals/members/${level}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.message || "Error al cargar miembros.");
  }

  return data;
}


export function getVipStatus() {
    return request("/vip/status", {
        method: "GET",
    });
}

export function buyVipPackage(level) {
    return request("/vip/buy", {
        method: "POST",
        body: JSON.stringify({ level }),
    });
}


export function getTasksDashboard() {
  return request("/tasks/dashboard", {
    method: "GET",
  });
}

export function completeVipTask(vipPurchaseId) {
  return request(`/tasks/complete/${vipPurchaseId}`, {
    method: "POST",
  });
}