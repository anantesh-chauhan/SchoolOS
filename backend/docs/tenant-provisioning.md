# Tenant provisioning

Platform owners manage tenants through `GET/POST /api/schools`, inspect a tenant with `GET /api/schools/:id`, update basic tenant details with `PATCH /api/schools/:id`, and repair academic defaults with `POST /api/schools/:id/initialize-academics`.

Creating a school provisions, in one server workflow:

- isolated school, branding, settings, and configuration;
- school-owner and administrator accounts with one-time temporary credentials;
- a curriculum-manager account and editable curriculum draft;
- Nursery, LKG, UKG, Classes 1–12, and three sections per class by default;
- CBSE-aligned subjects, chapters, official learning links, and academic calendar defaults.

Pass `sectionNames`, for example `["A", "B", "C", "D"]`, to customize the initial sections. All generated classes, sections, subjects, chapters, curriculum, resources, settings, and credentials remain editable through their existing administration modules.

## Demo platform owner

Run `npm run seed:platform-owner` to idempotently create the development platform owner. Run `npm run verify:instant-login` to audit every active instant-login identity and exercise token issuance for user, student, and parent account types.

Instant login is enabled outside production. In production it additionally requires `ENABLE_INSTANT_LOGIN=true`; only enable it for an intentional demo environment with disposable accounts.

Run `npm run smoke:tenant-provisioning` to create a temporary tenant, verify credentials and the complete academic foundation, and remove the temporary tenant afterward.
