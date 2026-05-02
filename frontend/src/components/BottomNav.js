import React from "react";
import { NavLink } from "react-router-dom";
import { FiHome, FiRadio, FiShield, FiFileText, FiUser } from "react-icons/fi";

export default function BottomNav() {
  const items = [
    { to: "/home", label: "Hogar", icon: <FiHome /> },
    { to: "/promotion", label: "Promoción", icon: <FiRadio /> },
    { to: "/vip", label: "VIP", icon: <FiShield /> },
    { to: "/tasks", label: "Tarea", icon: <FiFileText /> },
    { to: "/profile", label: "A mí", icon: <FiUser /> },
  ];

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `bottom-item ${isActive ? "active" : ""}`}
        >
          <span className="bottom-icon">{item.icon}</span>
          <span className="bottom-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}