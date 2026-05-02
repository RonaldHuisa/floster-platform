import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Promotion from "./pages/Promotion";
import Vip from "./pages/Vip";
import InviteFriends from "./pages/InviteFriends";
import Profile from "./pages/Profile";
import AppShell from "./components/AppShell";
import Recharge from "./pages/Recharge";
import Withdraw from "./pages/Withdraw";
import Transactions from "./pages/Transactions";
import AdminWithdrawals from "./pages/AdminWithdrawals";
import MembersList from "./pages/MembersList";
import Tasks from "./pages/Tasks";

import "./App.css";

function AppRoutes() {
  const location = useLocation();

  const authPages = ["/login", "/register"];
  const isAuthPage = authPages.includes(location.pathname);

  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/promotion" element={<Promotion />} />
        <Route path="/vip" element={<Vip />} />
        <Route path="/invite" element={<InviteFriends />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
        <Route path="/recharge" element={<Recharge />} />
        <Route path="/withdraw" element={<Withdraw />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
        <Route path="/members/:level" element={<MembersList />} />
        <Route path="/tasks" element={<Tasks />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}