import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import SidebarItem from './SidebarItem';
import { useLocation } from 'react-router-dom';

const variants = {
  collapsed: { height: 0, opacity: 0 },
  open: { height: 'auto', opacity: 1 },
};

const SidebarGroup = ({ group, isOpen, onToggle, desktopCollapsed, onNavigate }) => {
  const location = useLocation();
  const path = location.pathname;

  const isActiveGroup = group.items.some((item) => {
    if (!item.href) return false;
    return path === item.href || path.startsWith(item.href);
  });
  return (
    <div className="rounded-xl">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center justify-between w-full px-3 py-2 rounded-xl transition-all duration-200 active:scale-[0.98] ${
          desktopCollapsed ? 'justify-center' : 'justify-between'
        } ${isActiveGroup ? 'bg-[var(--school-primary-soft)] text-[var(--school-primary-soft-text)]' : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'}`}
      >
        <div className="flex items-center gap-3">
          {group.icon ? <group.icon size={18} /> : null}
          {!desktopCollapsed && <span className="font-semibold">{group.group}</span>}
        </div>

        {!desktopCollapsed && (
          <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className="text-[var(--text-muted)]">
            <ChevronDown size={16} />
          </motion.span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={variants}
            transition={{ type: 'tween', duration: 0.22 }}
            className="mt-2 px-1"
          >
            <div className="space-y-1">
              {group.items.map((item) => (
                <SidebarItem key={item.href + item.label} item={item} desktopCollapsed={desktopCollapsed} onNavigate={onNavigate} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(SidebarGroup);
