import React, { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '../../layouts/DashboardLayout';
import { WelcomeCard, SummaryCard } from '../../components/DashboardCards';
import { BookOpen, Calendar, Award, Clock } from 'lucide-react';

const StudentDashboard = () => {
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
      return {};
    }
  });

  const stats = {
    attendance: '94%',
    homeworkCount: 5,
    averageGPA: '3.8',
    upcomingDeadlines: 3,
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
    <DashboardLayout role="STUDENT">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <WelcomeCard name={user.name} role="STUDENT" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Calendar className="w-8 h-8" />}
              label="Attendance"
              value={stats.attendance}
              color="blue"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<BookOpen className="w-8 h-8" />}
              label="Pending Homework"
              value={stats.homeworkCount}
              color="green"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Award className="w-8 h-8" />}
              label="GPA"
              value={stats.averageGPA}
              color="purple"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Clock className="w-8 h-8" />}
              label="Upcoming Deadlines"
              value={stats.upcomingDeadlines}
              color="orange"
            />
          </motion.div>
        </div>

        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">My Assignments</h3>
          <div className="space-y-3">
            <div className="p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20 rounded">
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Mathematics Assignment 5</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Due: Oct 30, 2024</p>
                </div>
                <span className="text-red-600 dark:text-red-400 text-sm font-semibold">DUE SOON</span>
              </div>
            </div>
            <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 rounded">
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Science Project</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Due: Nov 5, 2024</p>
                </div>
                <span className="text-yellow-600 dark:text-yellow-400 text-sm font-semibold">IN PROGRESS</span>
              </div>
            </div>
            <div className="p-4 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20 rounded">
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">English Essay</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Due: Nov 10, 2024</p>
                </div>
                <span className="text-green-600 dark:text-green-400 text-sm font-semibold">PENDING</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-blue-900 dark:text-blue-100">View Grades</p>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">Check grades</p>
            </button>
            <button className="p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-purple-900 dark:text-purple-100">Submit Assignment</p>
              <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">Upload work</p>
            </button>
            <button className="p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-green-900 dark:text-green-100">Contact Teacher</p>
              <p className="text-sm text-green-600 dark:text-green-300 mt-1">Send message</p>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
