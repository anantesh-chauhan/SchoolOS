import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

export const SummaryCard = ({ icon, label, value, trend, color = 'blue' }) => {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  };

  const iconColors = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-800',
    green: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-800',
    orange: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-800',
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className={`p-6 rounded-xl border ${colors[color]} backdrop-blur-sm cursor-pointer transition-all`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-2">
            {label}
          </p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
            {value}
          </h3>
          {trend && (
            <div className="flex items-center gap-1 mt-3 text-green-600 dark:text-green-400 text-sm">
              <TrendingUp size={16} />
              {trend}% increase
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${iconColors[color]} text-xl`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
};

export const WelcomeCard = ({ name, role }) => {
  const hours = new Date().getHours();
  let greeting = 'Good morning';
  if (hours >= 12) greeting = 'Good afternoon';
  if (hours >= 18) greeting = 'Good evening';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl p-8 mb-6"
    >
      <h2 className="text-3xl font-bold mb-2">
        {greeting}, {name}! 👋
      </h2>
      <p className="text-blue-100">
        Welcome to your {role.replace('_', ' ').toLowerCase()} dashboard
      </p>
    </motion.div>
  );
};
