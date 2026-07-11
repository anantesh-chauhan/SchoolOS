import React, { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '../../layouts/DashboardLayout';
import { WelcomeCard, SummaryCard } from '../../components/DashboardCards';
import { Users, BookOpen, Users2, GraduationCap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../../services/dashboardService';

export default function SchoolOwnerDashboard() {
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
      return {};
    }
  });

  const { data, isLoading } = useQuery({ queryKey: ['dashboard-summary', 'school-owner'], queryFn: dashboardService.summary });
  const stats = data?.stats || {};

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
    <DashboardLayout role="SCHOOL_OWNER">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <WelcomeCard name={user.name} role="SCHOOL_OWNER" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<GraduationCap className="w-8 h-8" />}
              label="Total Students"
              value={isLoading ? '…' : stats.totalStudents || 0}
              color="blue"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Users2 className="w-8 h-8" />}
              label="Total Teachers"
              value={isLoading ? '…' : stats.totalTeachers || 0}
              color="purple"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<BookOpen className="w-8 h-8" />}
              label="Total Classes"
              value={isLoading ? '…' : stats.totalClasses || 0}
              color="green"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Users className="w-8 h-8" />}
              label="Today's Attendance"
              value={isLoading ? '…' : `${stats.attendanceRate || 0}%`}
              color="orange"
            />
          </motion.div>
        </div>

        {/* School Info Card */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            School Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">School Name</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{data?.school?.schoolName || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Address</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{data?.school?.address || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Email</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{data?.school?.email || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Phone</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{data?.school?.phone || '—'}</p>
            </div>
          </div>
        </motion.div>

        {/* Quick Links */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-blue-900 dark:text-blue-100">Manage Students</p>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">View and edit students</p>
            </button>
            <button className="p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-purple-900 dark:text-purple-100">Manage Teachers</p>
              <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">View and edit teachers</p>
            </button>
            <button className="p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-green-900 dark:text-green-100">View Classes</p>
              <p className="text-sm text-green-600 dark:text-green-300 mt-1">View all classes</p>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
