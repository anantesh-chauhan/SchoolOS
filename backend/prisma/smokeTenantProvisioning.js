import 'dotenv/config';

if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}

const { default: prisma } = await import('../src/config/prisma.client.js');
const { createSchool, getSchoolTenantDetails } = await import('../src/controllers/school.controller.js');

const stamp = Date.now().toString(36).toLowerCase();
let schoolId;

const capture = () => {
  const state = { statusCode: 200, payload: null };
  return {
    state,
    response: {
      status(code) { state.statusCode = code; return this; },
      json(value) { state.payload = value; return value; },
    },
  };
};

try {
  const created = capture();
  await createSchool({
    body: {
      schoolName: `Provisioning Smoke ${stamp}`,
      schoolCode: `PV${stamp}`.slice(0, 16),
      address: 'Temporary provisioning test address',
      city: 'Test City',
      state: 'Test State',
      phone: '9999999998',
      email: `school-${stamp}@example.test`,
      ownerName: 'Provisioning Owner',
      ownerEmail: `owner-${stamp}@example.test`,
      adminName: 'Provisioning Admin',
      adminEmail: `admin-${stamp}@example.test`,
      sectionNames: ['A', 'B', 'C'],
    },
  }, created.response);

  if (created.state.statusCode !== 201 || !created.state.payload?.success) {
    throw new Error(`Tenant API returned ${created.state.statusCode}: ${created.state.payload?.message || 'unknown error'}`);
  }
  const data = created.state.payload.data;
  schoolId = data.school.id;
  if (!data.credentials?.schoolOwner?.temporaryPassword || !data.credentials?.admin?.temporaryPassword) throw new Error('Generated owner/admin credentials were not returned');
  if (!data.credentials?.curriculumManager?.loginId) throw new Error('Curriculum-manager credentials were not returned');
  if (data.provisioning?.status !== 'READY' || data.academicSetup?.classes !== 15 || data.academicSetup?.sections !== 45) throw new Error('Academic provisioning did not complete');

  const details = capture();
  await getSchoolTenantDetails({ params: { id: schoolId } }, details.response);
  if (details.state.statusCode !== 200 || details.state.payload?.data?.summary?.classes !== 15 || details.state.payload?.data?.summary?.chapters !== 651) {
    throw new Error('Tenant detail summary did not reflect the provisioned academic structure');
  }

  console.log(JSON.stringify({
    success: true,
    responseStatus: created.state.statusCode,
    provisioningStatus: data.provisioning.status,
    credentialsReturned: ['schoolOwner', 'admin', 'curriculumManager'],
    academicSetup: {
      template: data.academicSetup.template,
      classes: data.academicSetup.classes,
      sections: data.academicSetup.sections,
      subjects: data.academicSetup.subjects,
      chapters: data.academicSetup.chapters,
      editable: data.academicSetup.editable,
    },
    detailSummaryVerified: true,
  }, null, 2));
} finally {
  if (schoolId) {
    await prisma.user.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}
