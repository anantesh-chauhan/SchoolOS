import { Dialog, Transition } from "@headlessui/react";
import React, { Fragment } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

/* =====================================================
   Modal Sizes
   ===================================================== */

const sizes = {

  sm: "max-w-sm",

  md: "max-w-lg",

  lg: "max-w-2xl",

  xl: "max-w-4xl",

};

/* =====================================================
   Base Modal
   ===================================================== */

export function Modal({

  open,

  onClose,

  title,

  children,

  footer,

  size = "md",

  showClose = true,

  icon: Icon,

}) {

  return (

    <Transition appear show={open} as={Fragment}>

      <Dialog
        as="div"
        className="relative z-50"
        onClose={onClose}
      >

        {/* Overlay */}

        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >

          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />

        </Transition.Child>

        {/* Modal Wrapper */}

        <div className="fixed inset-0 overflow-y-auto">

          <div className="flex min-h-full items-center justify-center p-4">

            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >

              <Dialog.Panel
                className={cn(

                  "w-full",

                  sizes[size],

                  "overflow-hidden",

                  "rounded-2xl",

                  "border border-slate-200",

                  "bg-white",

                  "shadow-2xl",

                  "dark:bg-slate-900",
                  "dark:border-slate-700"

                )}
              >

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >

                  {/* Header */}

                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">

                    <div className="flex items-center gap-2">

                      {Icon && (

                        <Icon className="h-5 w-5 text-slate-500" />

                      )}

                      <Dialog.Title
                        className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white"
                      >

                        {title}

                      </Dialog.Title>

                    </div>

                    {showClose && (

                      <button
                        onClick={onClose}
                        className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >

                        <X className="h-5 w-5" />

                      </button>

                    )}

                  </div>

                  {/* Content */}

                  <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">

                    {children}

                  </div>

                  {/* Footer */}

                  {footer && (

                    <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-700">

                      {footer}

                    </div>

                  )}

                </motion.div>

              </Dialog.Panel>

            </Transition.Child>

          </div>

        </div>

      </Dialog>

    </Transition>

  );

}