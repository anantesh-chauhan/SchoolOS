import React, { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '../../layouts/DashboardLayout';
import { WelcomeCard, SummaryCard } from '../../components/DashboardCards';
import { CheckCircle, Calendar, FileText, Users } from 'lucide-react';

const StaffDashboard = () => {
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
      return {};
    }
  });

  const stats = {
    tasksCompleted: 12,
    tasksRemaining: 5,
    reportsSubmitted: 8,
    meetings: 3,
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
    <DashboardLayout role="STAFF">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <WelcomeCard name={user.name} role="STAFF" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<CheckCircle className="w-8 h-8" />}
              label="Tasks Completed"
              value={stats.tasksCompleted}
              color="green"
              trend={15}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Calendar className="w-8 h-8" />}
              label="Remaining Tasks"
              value={stats.tasksRemaining}
              color="blue"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<FileText className="w-8 h-8" />}
              label="Reports Submitted"
              value={stats.reportsSubmitted}
              color="purple"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Users className="w-8 h-8" />}
              label="Scheduled Meetings"
              value={stats.meetings}
              color="orange"
            />
          </motion.div>
        </div>

        {/* Today's Tasks */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Today's Tasks
          </h3>
          <div className="space-y-3">
            <div className="p-4 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20 rounded">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Maintain Library Inventory</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Update book database</p>
                </div>
                <span className="text-xs bg-green-600 text-white px-3 py-1 rounded-full">Completed</span>
              </div>
            </div>
            <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 rounded">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Prepare School Reports</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Monthly performance report</p>
                </div>
                <span className="text-xs bg-yellow-600 text-white px-3 py-1 rounded-full">In Progress</span>
              </div>
            </div>
            <div className="p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Assist in Event Planning</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Annual sports event coordination</p>
                </div>
                <span className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full">Pending</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Weekly Schedule */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            This Week's Schedule
          </h3>
          <div className="space-y-2">
            {[
              { day: 'Monday', time: '10:00 AM', event: 'Staff Meeting' },
              { day: 'Tuesday', time: '2:00 PM', event: 'Event Planning Committee' },
              { day: 'Wednesday', time: '11:00 AM', event: 'Library Inventory Check' },
              { day: 'Thursday', time: '3:00 PM', event: 'Staff Training' },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                whileHover={{ x: 5 }}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{item.event}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{item.day} • {item.time}</p>
                  </div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-blue-900 dark:text-blue-100">Submit Report</p>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">Upload new report</p>
            </button>
            <button className="p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-purple-900 dark:text-purple-100">View Schedule</p>
              <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">Full schedule</p>
            </button>
            <button className="p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-green-900 dark:text-green-100">Team Messages</p>
              <p className="text-sm text-green-600 dark:text-green-300 mt-1">Communication hub</p>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
};

export default StaffDashboard;
