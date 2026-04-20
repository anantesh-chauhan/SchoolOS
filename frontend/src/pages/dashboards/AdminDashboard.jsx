import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';


import { Users, Users2, Calendar, CheckCircle } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { SummaryCard, WelcomeCard } from '../../components/DashboardCards';

export default function AdminDashboard() {
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
      return {};
    }
  });

  const stats = {
    totalStudents: 1250,
    totalStaff: 120,
    todayAttendance: 1180,
    attendanceRate: 94.4,
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
    <DashboardLayout role="ADMIN">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <WelcomeCard name={user.name} role="ADMIN" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Users className="w-8 h-8" />}
              label="Total Students"
              value={stats.totalStudents}
              color="blue"
              trend={3}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Users2 className="w-8 h-8" />}
              label="Total Staff"
              value={stats.totalStaff}
              color="purple"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Calendar className="w-8 h-8" />}
              label="Today's Attendance"
              value={stats.todayAttendance}
              color="green"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<CheckCircle className="w-8 h-8" />}
              label="Attendance Rate"
              value={`${stats.attendanceRate}%`}
              color="orange"
            />
          </motion.div>
        </div>

        {/* Today's Overview */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Today's Overview
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100">Present</p>
                <p className="text-sm text-green-600 dark:text-green-300">{stats.todayAttendance} students</p>
              </div>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.attendanceRate}%</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-100">Classes Today</p>
                <p className="text-sm text-blue-600 dark:text-blue-300">All classes in session</p>
              </div>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">45</span>
            </div>
          </div>
        </motion.div>

        {/* Admin Actions */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Admin Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link to="/dashboard/admin/classes" className="block p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-blue-900 dark:text-blue-100">Class Management</p>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">Add and delete classes</p>
            </Link>
            <Link to="/dashboard/admin/sections" className="block p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-purple-900 dark:text-purple-100">Section Management</p>
              <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">Auto-sequential sections</p>
            </Link>
            <Link to="/dashboard/admin/subjects" className="block p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-green-900 dark:text-green-100">Subject Management</p>
              <p className="text-sm text-green-600 dark:text-green-300 mt-1">Assign subjects to class/section</p>
            </Link>
            <Link to="/dashboard/admin/subject-assignment" className="block p-4 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-amber-900 dark:text-amber-100">Subject Assignment</p>
              <p className="text-sm text-amber-600 dark:text-amber-300 mt-1">Bulk and section-level mapping</p>
            </Link>
            <Link to="/dashboard/admin/teachers" className="block p-4 bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-cyan-900 dark:text-cyan-100">Teacher Management</p>
              <p className="text-sm text-cyan-600 dark:text-cyan-300 mt-1">Add, edit, search and track load</p>
            </Link>
            <Link to="/dashboard/admin/teacher-assignment" className="block p-4 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-rose-900 dark:text-rose-100">Teacher Assignment</p>
              <p className="text-sm text-rose-600 dark:text-rose-300 mt-1">Assign teacher to section subjects</p>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
