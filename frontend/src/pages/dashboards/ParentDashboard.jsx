import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

import { User, TrendingUp, FileText, CreditCard } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { SummaryCard, WelcomeCard } from "../../components/DashboardCards";

const ParentDashboard = () => {
  const [user, setUser] = useState({ name: "Parent" });

  // Safe localStorage read
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Invalid user data in localStorage");
    }
  }, []);

  // Demo Stats (Later connect API)
  const stats = {
    childName: "Alex Johnson",
    attendance: "94%",
    assignments: 8,
    feesPending: "₹ 2,500",
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
    <DashboardLayout role="PARENT">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Welcome */}
        <WelcomeCard name={user?.name || "Parent"} role="PARENT" />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<User className="w-8 h-8" />}
              label="Child Name"
              value={stats.childName}
              color="blue"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<TrendingUp className="w-8 h-8" />}
              label="Attendance"
              value={stats.attendance}
              color="green"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<FileText className="w-8 h-8" />}
              label="Pending Homework"
              value={stats.assignments}
              color="purple"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<CreditCard className="w-8 h-8" />}
              label="Fees Pending"
              value={stats.feesPending}
              color="orange"
            />
          </motion.div>
        </div>

        {/* Academic Performance */}
        <motion.div
          variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Child's Academic Performance
          </h3>

          <div className="space-y-4">
            {/* Mathematics */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-gray-900 dark:text-white">
                  Mathematics
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  A
                </span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: "85%" }}
                />
              </div>
            </div>

            {/* Science */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-gray-900 dark:text-white">
                  Science
                </span>
                <span className="text-green-600 dark:text-green-400 font-semibold">
                  B+
                </span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: "78%" }}
                />
              </div>
            </div>

            {/* English */}
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-gray-900 dark:text-white">
                  English
                </span>
                <span className="text-purple-600 dark:text-purple-400 font-semibold">
                  A
                </span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: "88%" }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          variants={itemVariants}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-blue-900 dark:text-blue-100">
                View Progress
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                Detailed reports
              </p>
            </button>

            <button className="p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-purple-900 dark:text-purple-100">
                Pay Fees
              </p>
              <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">
                Fee payment
              </p>
            </button>

            <button className="p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-green-900 dark:text-green-100">
                Messages
              </p>
              <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                Teacher communication
              </p>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
};

export default ParentDashboard;