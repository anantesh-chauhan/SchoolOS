import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { Users, Building2, TrendingUp, ArrowUpRight } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { SummaryCard, WelcomeCard } from '../../components/DashboardCards';

export default function PlatformOwnerDashboard() {
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
      return {};
    }
  });

  // Mock data - would come from API
  const stats = {
    totalSchools: 156,
    totalUsers: 4250,
    activeSchools: 142,
    growth: 12,
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <DashboardLayout role="PLATFORM_OWNER">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Welcome Card */}
        <WelcomeCard name={user.name} role="PLATFORM_OWNER" />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Building2 className="w-8 h-8" />}
              label="Total Schools"
              value={stats.totalSchools}
              color="blue"
              trend={stats.growth}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Users className="w-8 h-8" />}
              label="Total Users"
              value={stats.totalUsers}
              color="purple"
              trend={8}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<TrendingUp className="w-8 h-8" />}
              label="Active Schools"
              value={stats.activeSchools}
              color="green"
              trend={5}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<ArrowUpRight className="w-8 h-8" />}
              label="Growth Rate"
              value={`${stats.growth}%`}
              color="orange"
            />
          </motion.div>
        </div>

        {/* Recent Activity */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/dashboard/platform/schools" className="block p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-blue-900 dark:text-blue-100">View All Schools</p>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">Manage all schools</p>
            </Link>
            <Link to="/dashboard/platform/schools" className="block p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-purple-900 dark:text-purple-100">Add New School</p>
              <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">Register new school</p>
            </Link>
            <button className="p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-green-900 dark:text-green-100">System Analytics</p>
              <p className="text-sm text-green-600 dark:text-green-300 mt-1">View analytics</p>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
