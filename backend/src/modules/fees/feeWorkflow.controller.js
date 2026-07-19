import * as service from "./feeWorkflow.service.js";

const safe = (value) =>
  JSON.parse(
    JSON.stringify(value, (_, item) =>
      typeof item === "bigint" ? Number(item) : item,
    ),
  );
const send = (res, data, status = 200) =>
  res.status(status).json({ success: true, data: safe(data) });
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    res
      .status(error.status || (error.code === "P2002" ? 409 : 400))
      .json({
        success: false,
        code: error.code || "FEE_REQUEST_FAILED",
        message:
          error.code === "P2002"
            ? "A record with this code already exists"
            : error.message,
      });
  }
};
const key = (req) => {
  const value = req.get("Idempotency-Key");
  if (!value || value.length < 12 || value.length > 160)
    throw Object.assign(
      new Error("A valid Idempotency-Key header is required"),
      { status: 400 },
    );
  return value;
};

export const categories = wrap(async (req, res) =>
  send(res, await service.listCategories(req.user, req.query)),
);
export const createCategory = wrap(async (req, res) =>
  send(res, await service.createCategory(req, req.body), 201),
);
export const updateCategory = wrap(async (req, res) =>
  send(res, await service.updateCategory(req, req.params.id, req.body)),
);
export const components = wrap(async (req, res) =>
  send(res, await service.listMasterComponents(req.user, req.query)),
);
export const createComponent = wrap(async (req, res) =>
  send(res, await service.createMasterComponent(req, req.body), 201),
);
export const invoices = wrap(async (req, res) =>
  send(res, await service.listInvoices(req.user, req.query)),
);
export const generateInvoices = wrap(async (req, res) =>
  send(res, await service.generateInvoices(req, req.body, key(req)), 201),
);
export const refunds = wrap(async (req, res) =>
  send(res, await service.listRefunds(req.user, req.query)),
);
export const processRefund = wrap(async (req, res) =>
  send(res, await service.processRefund(req, req.body, key(req)), 201),
);
export const recalculateLateFees = wrap(async (req, res) =>
  send(res, await service.recalculateLateFees(req, req.body)),
);
export const transportRoutes = wrap(async (req, res) =>
  send(res, await service.listTransportRoutes(req.user)),
);
export const createTransportRoute = wrap(async (req, res) =>
  send(res, await service.createTransportRoute(req, req.body), 201),
);
export const assignTransport = wrap(async (req, res) =>
  send(res, await service.assignTransport(req, req.body), 201),
);
