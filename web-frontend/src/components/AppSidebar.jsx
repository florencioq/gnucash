import React from "react";

/**
 * AppSidebar — barra vertical fixa de atalhos de navegação.
 * Mostra apenas os itens com sidebar:true do navConfig.
 *
 * Props:
 *   navConfig        — array NAV_CONFIG
 *   isTabActive      — (tabId) => bool
 *   canManageUsers   — bool
 *   onNavAction      — (item) => void
 */
export default function AppSidebar({ navConfig, isTabActive, canManageUsers, onNavAction }) {
  const items = navConfig
    .flatMap((section) => section.items)
    .filter((item) => item.sidebar && (!item.requiresSuperuser || canManageUsers));

  return (
    <aside className="app-sidebar section-card">
      {items.map((item) => {
        const active = isTabActive(item.tabId || item.id);
        return (
          <button
            key={item.id}
            className={`app-nav-link ${active ? "is-active" : ""}`}
            type="button"
            title={item.label}
            aria-label={item.label}
            onClick={() => onNavAction(item)}
          >
            <span className="app-nav-link-icon" aria-hidden="true">{item.icon || "•"}</span>
          </button>
        );
      })}
    </aside>
  );
}
