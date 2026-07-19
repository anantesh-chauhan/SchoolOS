import express from "express";
import rateLimit from "express-rate-limit";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/auth.middleware.js";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { PERMISSIONS } from "../../config/permissions.js";
import * as controller from "./fee.controller.js";
import { streamReceiptPdf } from "./feeReceipt.service.js";
import * as advanced from "./feeAdvanced.controller.js";
import * as workflow from "./feeWorkflow.controller.js";

const router = express.Router();
const admin = requireRole("SCHOOL_OWNER", "ADMIN");
const feeAccess = requirePermission(PERMISSIONS.FEES_VIEW);
const sensitive = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get(
  "/verify/:code",
  rateLimit({ windowMs: 60 * 1000, limit: 20 }),
  controller.verify,
);
router.use(authMiddleware);
router.get(
  "/platform/analytics",
  requireRole("PLATFORM_OWNER"),
  advanced.platform,
);
router.get("/settings", feeAccess, controller.getSettings);
router.put("/settings", admin, controller.saveSettings);
router.get("/structures", feeAccess, controller.structures);
router.post("/structures", admin, controller.createStructure);
router.post("/structures/:id/publish", admin, controller.publishStructure);
router.get("/categories", feeAccess, workflow.categories);
router.post("/categories", admin, workflow.createCategory);
router.patch("/categories/:id", admin, workflow.updateCategory);
router.get("/components", feeAccess, workflow.components);
router.post("/components", admin, workflow.createComponent);
router.get("/invoices", feeAccess, workflow.invoices);
router.post("/invoices/generate", admin, sensitive, workflow.generateInvoices);
router.get("/refunds", feeAccess, workflow.refunds);
router.post("/refunds", admin, sensitive, workflow.processRefund);
router.post(
  "/late-fees/recalculate",
  admin,
  sensitive,
  workflow.recalculateLateFees,
);
router.get(
  "/transport/routes",
  requireRole("SCHOOL_OWNER", "ADMIN", "FEE_MANAGER"),
  workflow.transportRoutes,
);
router.post("/transport/routes", admin, workflow.createTransportRoute);
router.post("/transport/assignments", admin, workflow.assignTransport);
router.get(
  "/students/search",
  requireRole("SCHOOL_OWNER", "ADMIN", "FEE_MANAGER"),
  sensitive,
  controller.students,
);
router.get(
  "/hierarchy",
  requireRole("SCHOOL_OWNER", "ADMIN", "FEE_MANAGER"),
  controller.hierarchy,
);
router.get(
  "/students/:studentId",
  requireRole("SCHOOL_OWNER", "ADMIN", "FEE_MANAGER"),
  controller.studentFees,
);
router.get("/my", requireRole("STUDENT", "PARENT"), controller.myFees);
router.get("/dashboard", feeAccess, controller.dashboard);
router.post(
  "/payments",
  requirePermission(PERMISSIONS.FEES_COLLECT),
  sensitive,
  controller.collect,
);
router.get(
  "/receipts/:id/pdf",
  requireRole("SCHOOL_OWNER", "ADMIN", "FEE_MANAGER", "STUDENT", "PARENT"),
  sensitive,
  streamReceiptPdf,
);
router.post(
  "/adjustments",
  requirePermission(PERMISSIONS.FEES_ADJUST_REQUEST),
  controller.requestAdjustment,
);
router.get("/approvals", admin, controller.approvals);
router.post("/assignments/preview", admin, advanced.preview);
router.post("/assignments/publish", admin, advanced.assign);
router.patch(
  "/cheques/:id/status",
  requireRole("SCHOOL_OWNER", "ADMIN", "FEE_MANAGER"),
  advanced.cheque,
);
router.patch("/adjustments/:id/review", admin, advanced.reviewAdjustment);
router.post("/adjustments/:id/process", admin, advanced.processAdjustment);
router.post(
  "/receipts/:id/cancel",
  requireRole("SCHOOL_OWNER", "ADMIN", "FEE_MANAGER"),
  advanced.cancelReceipt,
);
router.get("/notification-templates", feeAccess, advanced.templates);
router.post("/notification-templates", admin, advanced.saveTemplate);
router.post(
  "/reminders/send",
  requirePermission(PERMISSIONS.FEES_REMIND),
  sensitive,
  advanced.reminders,
);
router.get("/daily-closing", feeAccess, advanced.closings);
router.post(
  "/daily-closing",
  requireRole("FEE_MANAGER"),
  advanced.submitClosing,
);
router.patch("/daily-closing/:id/review", admin, advanced.reviewClosing);
router.put("/period-locks", admin, advanced.period);
router.post("/rollover", admin, advanced.rollover);
router.post("/scholarships", admin, advanced.scholarship);
router.post(
  "/scholarships/assign",
  requireRole("SCHOOL_OWNER", "ADMIN", "FEE_MANAGER"),
  advanced.assignScholarship,
);
router.get("/family", requireRole("PARENT"), advanced.family);
router.post("/family-links", admin, advanced.linkFamily);
router.get(
  "/reports/collections",
  requirePermission(PERMISSIONS.FEES_REPORT),
  sensitive,
  advanced.report,
);
router.get("/audit-logs", admin, advanced.audits);
router.post(
  "/documents",
  requireRole("SCHOOL_OWNER", "ADMIN", "FEE_MANAGER"),
  advanced.document,
);

export default router;
