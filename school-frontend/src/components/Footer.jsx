import React from 'react';
import { Link } from 'react-router-dom';
import { getSchoolConfig } from '../config/schoolConfig.js';
import useThemeStore from '../context/themeStore.js';

const fallbackSchool = getSchoolConfig();

export const Footer = () => {
  const currentYear = new Date().getFullYear();
  const school = useThemeStore((state) => state.schoolConfig) || fallbackSchool;
  const contact = school.contact || fallbackSchool.contact || {};

  return (
    <footer className="mt-16 bg-[#161112] text-[#f7f0ec]">
      <div className="section-shell py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="text-xl font-semibold">{school.name}</h3>
            <p className="mt-3 text-sm text-white/75">{school.description || fallbackSchool.description}</p>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm text-white/75">
              <li><Link to="/about" className="hover:text-white">About School</Link></li>
              <li><Link to="/admissions" className="hover:text-white">Admissions</Link></li>
              <li><Link to="/careers" className="hover:text-white">Careers</Link></li>
              <li><Link to="/notices" className="hover:text-white">News</Link></li>
              <li><Link to="/events" className="hover:text-white">Events</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Important Links</h4>
            <ul className="space-y-2 text-sm text-white/75">
              <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white">Terms & Conditions</Link></li>
              <li><Link to="/disclaimer" className="hover:text-white">School Rules</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-white/75">
              <li>{contact.address}</li>
              <li>{contact.city || ''}{contact.city && contact.state ? ', ' : ''}{contact.state || ''}</li>
              <li>{contact.phone}</li>
              <li>{contact.email}</li>
            </ul>
            <div className="mt-3 rounded-lg overflow-hidden border border-white/10">
              <iframe title="School map" src={contact.googleMapsEmbed || 'https://maps.google.com/maps?q=New%20Delhi&t=&z=13&ie=UTF8&iwloc=&output=embed'} className="w-full h-28" loading="lazy" />
            </div>
          </div>
        </div>

        <div className="mt-10 pt-5 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs text-white/60">
          <p>© {currentYear} {school.name}. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white">Terms & Conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
