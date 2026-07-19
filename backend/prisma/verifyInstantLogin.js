import 'dotenv/config';

if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}

const { default: prisma } = await import('../src/config/prisma.client.js');
const { getDemoAccounts, instantLogin } = await import('../src/controllers/auth.controller.js');

const supportedRoles = ['PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER', 'FEE_MANAGER', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF'];

try {
  const [users, students] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true, role: { in: supportedRoles } }, select: { id: true, email: true, role: true } }),
    prisma.student.findMany({ where: { isActive: true }, select: { id: true, studentUserId: true, parentUserId: true } }),
  ]);

  let statusCode = 200;
  let payload;
  await getDemoAccounts({}, {
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return value; },
  });
  if (statusCode !== 200 || !payload?.success) throw new Error(payload?.message || `Demo accounts returned HTTP ${statusCode}`);

  const listed = payload.data.flatMap((group) => group.users);
  const listedKeys = new Set(listed.map((account) => account.accountKey));
  if (listedKeys.size !== listed.length) throw new Error('Instant-login account keys are not unique');

  const portalLoginIds = new Set(students.flatMap((student) => [student.studentUserId, student.parentUserId]).filter(Boolean).map((value) => value.toLowerCase()));
  const expectedUserKeys = users
    .filter((user) => !(['STUDENT', 'PARENT'].includes(user.role) && portalLoginIds.has(user.email.toLowerCase())))
    .map((user) => `user:${user.id}`);
  const expectedPortalKeys = students.flatMap((student) => [
    student.studentUserId ? `student:${student.id}` : null,
    student.parentUserId ? `parent:${student.id}` : null,
  ]).filter(Boolean);
  const expectedKeys = [...expectedUserKeys, ...expectedPortalKeys];
  const missingKeys = expectedKeys.filter((key) => !listedKeys.has(key));
  const unexpectedKeys = listed.filter((account) => !expectedKeys.includes(account.accountKey)).map((account) => account.accountKey);
  if (missingKeys.length || unexpectedKeys.length) {
    throw new Error(`Instant-login coverage mismatch: ${missingKeys.length} missing, ${unexpectedKeys.length} unexpected`);
  }

  const loginChecks = {};
  for (const accountType of ['user', 'student', 'parent']) {
    const account = listed.find((item) => item.accountKey.startsWith(`${accountType}:`));
    if (!account) continue;
    let loginStatus = 200;
    let loginPayload;
    await instantLogin({ body: { accountKey: account.accountKey } }, {
      status(code) { loginStatus = code; return this; },
      json(value) { loginPayload = value; return value; },
    });
    if (loginStatus !== 200 || !loginPayload?.data?.accessToken || !loginPayload?.data?.refreshToken || !loginPayload?.data?.user) {
      throw new Error(`Instant login failed for ${accountType} account ${account.accountKey}`);
    }
    loginChecks[accountType] = { role: loginPayload.data.user.role, accountKey: account.accountKey, tokenIssued: true };
  }

  const groups = Object.fromEntries(payload.data.map((group) => [group.role, group.users.length]));
  console.log(JSON.stringify({
    success: true,
    supportedRoles: supportedRoles.length,
    activeDatabaseUsers: users.length,
    activeStudents: students.length,
    instantLoginIdentities: listed.length,
    groups,
    platformOwnerAvailable: (groups['Platform Owner'] || 0) > 0,
    loginChecks,
    missingKeys: 0,
    unexpectedKeys: 0,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
