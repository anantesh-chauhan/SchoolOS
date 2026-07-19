# SchoolOS fee management module

## Audit and compatibility summary

The repository already had a tenant-scoped charge/account ledger, versioned fee structures, class/section/student assignments, partial and advance payments, receipt PDFs, scholarships, reminders, daily closing, period locks, carry-forward, role permissions, fee portals, and deterministic fee seeds. Those records and APIs remain supported.

The completion migration is additive. It adds reusable categories and master components, invoice snapshots, refund allocations, and transport route/stop/assignment history. Existing `StudentFeeCharge` rows remain the compatibility source for installment dues. Money continues to use exact `BigInt` minor units (paise), the existing production convention; no floating-point arithmetic is used.

Important fixes:

- Pending cheques no longer receive finalized receipts. Clearance finalizes one receipt; bounce restores dues.
- Receipt cancellation is an approved payment reversal, not a cosmetic status change.
- Refunds reference the original payment and receipt, allocate to advance/charges, restore dues, update invoices and ledger balances, and are idempotent.
- Parent authorization accepts the authenticated user ID and the legacy parent-login identifier while still requiring an active same-school child link.
- Manual payment allocations reject duplicates, cross-student charges, over-allocation, and totals above the payment amount.
- Invoice and receipt line descriptions are snapshots, so later master-data edits do not rewrite history.
- Category, component, invoice, refund, route, stop, and assignment queries always include `schoolId`.
- Authenticated receipt downloads remain student-self/linked-parent scoped.

## API endpoints

All endpoints below are under `/api/fees`. Except public receipt verification, they require authentication.

| Method | Endpoint | Purpose | Roles |
| --- | --- | --- | --- |
| GET/POST/PATCH | `/categories`, `/categories/:id` | List, create, deactivate or update fee categories | View roles / Owner and Admin writes |
| GET/POST | `/components` | List and create reusable component masters | View roles / Owner and Admin writes |
| GET | `/structures` | Versioned structure library | Fee view roles |
| POST | `/structures` | Create draft structure and items | Owner, Admin |
| POST | `/structures/:id/publish` | Activate a draft and archive the prior active version | Owner, Admin |
| POST | `/assignments/preview` | Preview students, expected value, and conflicts | Owner, Admin |
| POST | `/assignments/publish` | Assign and generate idempotent installment charges | Owner, Admin |
| GET | `/invoices` | Paginated, tenant/child-scoped invoice history | Authorized fee viewers |
| POST | `/invoices/generate` | Issue snapshot invoices from un-invoiced charges | Owner, Admin |
| POST | `/payments` | Full, partial, manual, oldest-first, or advance collection | Fee collectors |
| GET | `/receipts/:id/pdf` | Authorized immutable PDF receipt | Staff, student self, linked parent |
| POST | `/receipts/:id/cancel` | Request/approve a complete payment reversal | Fee staff request; Owner/Admin approval |
| GET/POST | `/refunds` | List or process idempotent payment refunds | View roles / Owner and Admin processing |
| GET/POST | `/transport/routes` | Route and stop management | Fee staff / Owner and Admin writes |
| POST | `/transport/assignments` | Effective-dated selected-student transport | Owner, Admin |
| GET | `/dashboard` | School collection and dues aggregates | Fee viewers |
| GET | `/reports/collections` | Filtered JSON, CSV, or PDF collection register | Report permission |
| GET | `/family` | Linked-child and combined parent dues | Parent |
| GET | `/my` | Student self or linked-child fee account | Student, Parent |

Mutation endpoints for payment, invoice batch, and refund require an `Idempotency-Key` header. Financial mutations use serializable Prisma transactions and database unique constraints.

## Migration and seed

Development:

```bash
npx prisma format
npx prisma validate
npx prisma migrate dev
npx prisma generate
npm run seed
npm run seed:fees
npm run seed:fees:realistic
```

Production:

```bash
npx prisma migrate deploy
npx prisma generate
```

The fee seed is idempotent and runs against every existing demo school. It creates a fee manager, masters, structures, charges, full/partial/unpaid cases, invoices, receipts, scholarships, reminders, routes/stops, selected transport assignments, a bounced cheque, and a processed refund.

Demo fee manager credentials are printed by `npm run seed:fees` and follow:

- Email: `fee.manager.<lowercase-school-code>@schoolos.demo`
- Password: `FeeDemo@2026`

Demo student and parent IDs are deterministic values created by `seedAcademicData.js`; their development password is `admin123`. Use `/api/auth/demo-accounts` or the instant-login selector to obtain the exact seeded accounts for each school. Existing owner/admin credentials are intentionally not overwritten by the fee seed.

## Manual verification checklist

1. Create category and component masters, then create and publish a class/session structure.
2. Preview a class or section assignment and confirm the affected count before publishing.
3. Generate invoices twice with the same idempotency key; verify only one invoice per student.
4. Collect a partial cash payment and confirm charge, invoice, ledger, dashboard, and receipt totals.
5. Enter a payment greater than outstanding and confirm the remainder becomes advance credit.
6. Enter a cheque and confirm no receipt exists until it is marked cleared.
7. Bounce a cleared cheque and confirm dues are restored and the receipt is watermarked cancelled.
8. Process a partial refund and confirm refund allocation, payment status, invoice due, and ledger debit.
9. Request a receipt reversal as one user and approve it as a different Owner/Admin.
10. Log in as a student and change route IDs; confirm another student's record returns not found/forbidden.
11. Log in as a parent with two children and verify only linked children appear.
12. Switch schools and confirm no category, invoice, payment, receipt, refund, or route crosses tenants.
13. Export a filtered collection register to CSV/PDF.
14. Verify desktop, tablet, mobile, dark mode, loading, empty, error, and duplicate-submit states.

## Assumptions

- Academic sessions remain represented by the existing normalized session string rather than introducing a second session table relation.
- Existing `BigInt` minor-unit columns are retained because they are exact and already deployed; new financial totals follow the same convention.
- Online payment remains disabled until a gateway is configured.
- Transport creates operational assignments and history; monthly charge generation continues through a transport fee structure/component so invoices use the same accounting path.
- Material changes to active structures create a new version; paid historical invoices and finalized receipts are never rewritten.
