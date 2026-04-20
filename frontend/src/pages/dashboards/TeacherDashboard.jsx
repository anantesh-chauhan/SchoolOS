import React, { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '../../layouts/DashboardLayout';
import { WelcomeCard, SummaryCard } from '../../components/DashboardCards';
import { BookOpen, Clock, FileText, Users } from 'lucide-react';

const TeacherDashboard = () => {
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
      return {};
    }
  });

  const stats = {
    assignedClasses: 5,
    todayClasses: 3,
    assignments: 12,
    students: 150,
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
    <DashboardLayout role="TEACHER">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <WelcomeCard name={user.name} role="TEACHER" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<BookOpen className="w-8 h-8" />}
              label="Assigned Classes"
              value={stats.assignedClasses}
              color="blue"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Clock className="w-8 h-8" />}
              label="Today's Classes"
              value={stats.todayClasses}
              color="purple"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<FileText className="w-8 h-8" />}
              label="Assignments"
              value={stats.assignments}
              color="green"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Users className="w-8 h-8" />}
              label="Total Students"
              value={stats.students}
              color="orange"
            />
          </motion.div>
        </div>

        {/* Today's Schedule */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Today's Schedule
          </h3>
          <div className="space-y-3">
            <div className="p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded">
              <p className="font-semibold text-gray-900 dark:text-white">Class X - A (9:00 AM - 10:00 AM)</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">English - Room 101</p>
            </div>
            <div className="p-4 border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/20 rounded">
              <p className="font-semibold text-gray-900 dark:text-white">Class X - B (10:30 AM - 11:30 AM)</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">English - Room 102</p>
            </div>
            <div className="p-4 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20 rounded">
              <p className="font-semibold text-gray-900 dark:text-white">Class XI - C (2:00 PM - 3:00 PM)</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">English - Room 201</p>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-blue-900 dark:text-blue-100">Create Assignment</p>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">Add new assignment</p>
            </button>
            <button className="p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-purple-900 dark:text-purple-100">Mark Attendance</p>
              <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">Class attendance</p>
            </button>
            <button className="p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-green-900 dark:text-green-100">View Grades</p>
              <p className="text-sm text-green-600 dark:text-green-300 mt-1">Student grades</p>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
