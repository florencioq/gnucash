import React, { useEffect, useRef, useState } from "react";

/**
 * AppMenuBar — barra de menus tradicional no topo da aplicação.
 *
 * Props:
 *   navConfig        — array NAV_CONFIG
 *   canManageUsers   — bool
 *   activeBookId     — string | null
 *   pinnedActionIds  — string[]
 *   onNavAction      — (item) => void
 *   onTogglePin      — (actionId) => void
 */
export default function AppMenuBar({
  navConfig,
  canManageUsers,
  activeBookId,
  pinnedActionIds,
  onNavAction,
  onTogglePin,
}) {
  const [openSection, setOpenSection] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenSection(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const close = () => setOpenSection(null);

  return (
    <nav className="app-menu-bar" ref={menuRef} aria-label="Menu principal">
      {navConfig.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !item.requiresSuperuser || canManageUsers
        );
        if (!visibleItems.length) return null;

        const isOpen = openSection === section.id;

        return (
          <div key={section.id} className="app-menu-entry">
            <button
              className={`app-menu-trigger ${isOpen ? "is-open" : ""}`}
              type="button"
              aria-haspopup="true"
              aria-expanded={isOpen}
              onClick={() => setOpenSection(isOpen ? null : section.id)}
            >
              {section.label}
            </button>

            {isOpen && (
              <div className="app-menu-dropdown">
                {visibleItems.map((item) => {
                  const visibleChildren = (item.children || []).filter(
                    (c) => !c.requiresSuperuser || canManageUsers
                  );
                  const hasChildren = visibleChildren.length > 0;

                  return (
                    <div key={item.id} className="app-menu-group">
                      <button
                        className="app-menu-item-btn"
                        type="button"
                        onClick={() => {
                          onNavAction(item);
                          close();
                        }}
                      >
                        <span className="app-menu-item-icon" aria-hidden="true">
                          {item.icon || "•"}
                        </span>
                        <span>{item.label}</span>
                      </button>

                      {hasChildren && (
                        <div className="app-menu-children">
                          {visibleChildren.map((child) => {
                            const disabled = child.requiresActiveBook && !activeBookId;
                            const isPinned = pinnedActionIds.includes(child.id);

                            return (
                              <div key={child.id} className="app-menu-child-row">
                                <button
                                  className="app-menu-child-btn"
                                  type="button"
                                  disabled={disabled}
                                  title={
                                    disabled
                                      ? `${child.label} (requer livro ativo)`
                                      : child.label
                                  }
                                  onClick={() => {
                                    if (!disabled) {
                                      onNavAction(child);
                                      close();
                                    }
                                  }}
                                >
                                  <span
                                    className="app-menu-item-icon"
                                    aria-hidden="true"
                                  >
                                    {child.icon || "•"}
                                  </span>
                                  <span>{child.label}</span>
                                </button>
                                <button
                                  className={`app-menu-pin-btn ${isPinned ? "is-pinned" : ""}`}
                                  type="button"
                                  title={
                                    isPinned
                                      ? "Remover dos atalhos"
                                      : "Fixar na barra de atalhos"
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onTogglePin(child.id);
                                  }}
                                >
                                  {isPinned ? "📌" : "📍"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
