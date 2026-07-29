import 'dotenv/config';

if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}

const { default: prisma } = await import('../src/config/prisma.client.js');
const {
  getDemoAccounts,
  getMe,
  instantLogin,
  refreshSession,
} = await import('../src/controllers/auth.controller.js');
const { authMiddleware } = await import('../src/middleware/auth.middleware.js');

const supportedRoles = ['PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER', 'FEE_MANAGER', 'HR', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF'];

try {
  const invoke = async (handler, req = {}) => {
    let statusCode = 200;
    let payload;
    await handler(req, {
      status(code) { statusCode = code; return this; },
      json(value) { payload = value; return value; },
    });
    return { statusCode, payload };
  };

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

  const expectedUserKeys = users
    .filter((user) => !['STUDENT', 'PARENT'].includes(user.role))
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

  const sessionChecks = {};
  const representativeAccounts = [...new Map(
    listed.map((account) => [account.role, account]),
  ).values()];

  for (const account of representativeAccounts) {
    const { statusCode: loginStatus, payload: loginPayload } = await invoke(
      instantLogin,
      { body: { accountKey: account.accountKey } },
    );
    if (loginStatus !== 200 || !loginPayload?.data?.accessToken || !loginPayload?.data?.refreshToken || !loginPayload?.data?.user) {
      throw new Error(`Instant login failed for ${account.role} account ${account.accountKey}`);
    }

    const authenticatedRequest = {
      headers: { authorization: `Bearer ${loginPayload.data.accessToken}` },
    };
    let middlewarePassed = false;
    const middlewareResponse = await invoke(
      (req, res) => authMiddleware(req, res, () => { middlewarePassed = true; }),
      authenticatedRequest,
    );
    if (!middlewarePassed) {
      throw new Error(
        `Authentication middleware rejected ${account.role}: ${middlewareResponse.payload?.message || middlewareResponse.statusCode}`,
      );
    }

    const { statusCode: meStatus, payload: mePayload } = await invoke(
      getMe,
      { user: authenticatedRequest.user },
    );
    if (meStatus !== 200 || mePayload?.data?.role !== account.role) {
      throw new Error(`Session hydration failed for ${account.role}`);
    }

    const { statusCode: refreshStatus, payload: refreshPayload } = await invoke(
      refreshSession,
      { body: { refreshToken: loginPayload.data.refreshToken } },
    );
    if (refreshStatus !== 200 || !refreshPayload?.data?.accessToken || refreshPayload?.data?.user?.role !== account.role) {
      throw new Error(`Session refresh failed for ${account.role}`);
    }

    sessionChecks[account.role] = {
      accountKey: account.accountKey,
      tokenIssued: true,
      protectedSessionValidated: true,
      profileHydrated: true,
      refreshValidated: true,
    };
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
    sessionChecks,
    missingKeys: 0,
    unexpectedKeys: 0,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
