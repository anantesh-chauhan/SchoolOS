import React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/* =====================================================
   Error Boundary Class Component
   ===================================================== */

class ErrorBoundary extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {

    console.error("ErrorBoundary caught:", error, errorInfo);

    // Future:
    // Send error to logging service
    // Example:
    // logErrorToService(error, errorInfo);

  }

  handleRetry = () => {

    window.location.reload();

  };

  handleGoHome = () => {

    window.location.href = "/";

  };

  render() {

    if (this.state.hasError) {

      return (

        <motion.div

          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}

          className="
            min-h-screen
            flex
            items-center
            justify-center
            bg-gradient-to-br
            from-slate-50
            via-red-50
            to-orange-100
            dark:from-slate-900
            dark:via-slate-900
            dark:to-slate-800
            px-4
          "

        >

          {/* Error Card */}

          <motion.div

            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}

            transition={{ duration: 0.3 }}

            className="
              max-w-lg
              w-full
              bg-white
              dark:bg-slate-900
              border
              border-slate-200
              dark:border-slate-700
              rounded-2xl
              shadow-xl
              p-8
              text-center
            "

          >

            {/* Icon */}

            <div className="flex justify-center mb-4">

              <div className="
                p-4
                rounded-full
                bg-red-100
                dark:bg-red-900/30
              ">

                <AlertTriangle
                  className="
                    h-8
                    w-8
                    text-red-600
                    dark:text-red-400
                  "
                />

              </div>

            </div>

            {/* Title */}

            <h2 className="
              text-2xl
              font-bold
              text-slate-900
              dark:text-white
              mb-2
            ">

              Something went wrong

            </h2>

            {/* Message */}

            <p className="
              text-slate-600
              dark:text-slate-400
              mb-6
            ">

              We're sorry, but something unexpected happened.
              Please try refreshing the page or return to your dashboard.

            </p>

            {/* Buttons */}

            <div className="
              flex
              flex-col
              sm:flex-row
              justify-center
              gap-3
            ">

              {/* Retry */}

              <button
                onClick={this.handleRetry}

                className="
                  flex
                  items-center
                  justify-center
                  gap-2
                  px-4
                  py-2
                  rounded-lg
                  bg-indigo-600
                  text-white
                  font-medium
                  hover:bg-indigo-700
                  transition
                "
              >

                <RefreshCw size={16} />

                Try Again

              </button>

              {/* Home */}

              <button
                onClick={this.handleGoHome}

                className="
                  flex
                  items-center
                  justify-center
                  gap-2
                  px-4
                  py-2
                  rounded-lg
                  border
                  border-slate-300
                  text-slate-700
                  dark:text-slate-200
                  hover:bg-slate-100
                  dark:hover:bg-slate-800
                  transition
                "
              >

                <Home size={16} />

                Go to Dashboard

              </button>

            </div>

            {/* Developer Error (optional) */}

            {process.env.NODE_ENV === "development" && this.state.error && (

              <div className="
                mt-6
                text-left
                bg-slate-100
                dark:bg-slate-800
                p-3
                rounded-lg
                text-xs
                text-red-600
                overflow-auto
              ">

                {this.state.error.toString()}

              </div>

            )}

          </motion.div>

        </motion.div>

      );

    }

    return this.props.children;

  }

}

export default ErrorBoundary;