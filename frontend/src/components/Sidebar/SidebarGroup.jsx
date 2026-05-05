import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import SidebarItem from './SidebarItem';
import { useLocation } from 'react-router-dom';

const variants = {
  collapsed: { height: 0, opacity: 0 },
  open: { height: 'auto', opacity: 1 },
};

const SidebarGroup = ({ group, isOpen, onToggle, desktopCollapsed }) => {
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
        className={`flex items-center justify-between w-full px-3 py-2 rounded-xl transition ${
          desktopCollapsed ? 'justify-center' : 'justify-between'
        } ${isActiveGroup ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'}`}
      >
        <div className="flex items-center gap-3">
          {group.icon ? <group.icon size={18} /> : null}
          {!desktopCollapsed && <span className="font-semibold text-slate-700">{group.group}</span>}
        </div>

        {!desktopCollapsed && (
          <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className="text-slate-500">
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
                <SidebarItem key={item.href + item.label} item={item} desktopCollapsed={desktopCollapsed} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(SidebarGroup);
