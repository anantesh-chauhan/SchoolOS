import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { getSchoolConfig } from '../config/schoolConfig.js';
import useThemeStore from '../context/themeStore.js';
import apiClient from '../utils/apiClient.js';

const fallbackSchool = getSchoolConfig();

export const Navbar = () => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [openDropdown, setOpenDropdown] = React.useState(null);
  const [menuLinks, setMenuLinks] = React.useState([]);
  const school = useThemeStore((state) => state.schoolConfig) || fallbackSchool;

  React.useEffect(() => {
    apiClient
      .get('/menus')
      .then((res) => {
        const items = res.data?.data?.find?.((entry) => entry.key === 'header')?.items || [];
        if (items.length > 0) {
          setMenuLinks(items.map((entry) => ({ label: entry.label, href: entry.href }))); 
        }
      })
      .catch(() => null);
  }, []);

  const links = menuLinks.length > 0 ? menuLinks : (school.navigation?.links || []);
  const featuredOrder = ['Home', 'About', 'Academics', 'Faculty', 'Admissions', 'Events', 'Gallery', 'News', 'Careers', 'Contact'];
  const featuredLinks = featuredOrder
    .map((name) => links.find((entry) => entry.label === name))
    .filter(Boolean);
  const remainingLinks = links.filter((entry) => !featuredOrder.includes(entry.label));

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white/92 backdrop-blur-xl shadow-[0_8px_24px_rgba(17,17,17,0.06)]">
      <div className="section-shell h-20 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <span className="h-11 w-11 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 grid place-items-center text-[var(--color-primary)] font-bold shadow-sm">
            {school.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
          </span>
          <div>
            <p className="font-semibold leading-none">{school.name}</p>
            <p className="text-xs text-[var(--color-muted)]">{school.tagline}</p>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2 py-1 shadow-sm">
          {featuredLinks.map((item) => (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => setOpenDropdown(item.label)}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <NavItem to={item.href} label={item.label} hasChildren={Boolean(item.children?.length)} />
              {item.children?.length ? (
                <AnimatePresence>
                  {openDropdown === item.label ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute left-0 mt-2 w-56 glass-panel p-2"
                    >
                      {item.children.map((child) => (
                        <Link
                          key={child.label}
                          to={child.href}
                          className="block rounded-lg px-3 py-2 text-sm text-[var(--color-ink)] hover:bg-black/5"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              ) : null}
            </div>
          ))}

          {remainingLinks.length > 0 ? (
            <div
              className="relative"
              onMouseEnter={() => setOpenDropdown('Explore')}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <button
                type="button"
                className="px-3 py-2 text-sm font-semibold rounded-lg transition text-[var(--color-ink)] hover:bg-black/5"
              >
                Explore <span className="ml-1 text-xs">▼</span>
              </button>
              <AnimatePresence>
                {openDropdown === 'Explore' ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-2 w-64 glass-panel p-2"
                  >
                    {remainingLinks.map((item) => (
                      <div key={item.label} className="mb-1 last:mb-0">
                        <Link to={item.href} className="block rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-black/5">
                          {item.label}
                        </Link>
                        {item.children?.map((child) => (
                          <Link
                            key={child.label}
                            to={child.href}
                            className="block rounded-lg px-6 py-1.5 text-xs text-[var(--color-muted)] hover:bg-black/5"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <Link to="/admissions" className="brand-button text-sm px-5 py-2.5">
            Admissions Open
          </Link>
        </div>

        <button
          className="lg:hidden h-10 w-10 rounded-lg border border-black/10"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          <span className="text-lg">{mobileOpen ? 'x' : '≡'}</span>
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-black/5 bg-white"
          >
            <div className="section-shell py-4 flex flex-col gap-2">
              <MobileItem to="/" label="Home" onClick={() => setMobileOpen(false)} />
              {featuredLinks.map((item) => (
                <React.Fragment key={item.label}>
                  <MobileItem to={item.href} label={item.label} onClick={() => setMobileOpen(false)} />
                  {item.children?.map((child) => (
                    <MobileItem
                      key={child.label}
                      to={child.href}
                      label={`- ${child.label}`}
                      onClick={() => setMobileOpen(false)}
                      className="pl-6"
                    />
                  ))}
                </React.Fragment>
              ))}

              {remainingLinks.map((item) => (
                <React.Fragment key={item.label}>
                  <MobileItem to={item.href} label={item.label} onClick={() => setMobileOpen(false)} />
                  {item.children?.map((child) => (
                    <MobileItem
                      key={child.label}
                      to={child.href}
                      label={`- ${child.label}`}
                      onClick={() => setMobileOpen(false)}
                      className="pl-6"
                    />
                  ))}
                </React.Fragment>
              ))}

              <Link to="/admissions" onClick={() => setMobileOpen(false)} className="brand-button text-sm mt-1">
                Admissions Open
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
};

const NavItem = ({ to, label, hasChildren = false }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 text-sm font-semibold rounded-lg transition ${
          isActive ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'text-[var(--color-ink)] hover:bg-black/5'
        }`
      }
    >
      {label}
      {hasChildren ? <span className="ml-1 text-xs">▼</span> : null}
    </NavLink>
  );
};

const MobileItem = ({ to, label, onClick, className = '' }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`block px-3 py-2 rounded-lg text-sm font-semibold text-[var(--color-ink)] hover:bg-black/5 ${className}`}
  >
    {label}
  </Link>
);

export default Navbar;
