import 'dotenv/config';
import bcryptjs from 'bcryptjs';
import { pathToFileURL } from 'node:url';

if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}

const { default: prisma } = await import('../src/config/prisma.client.js');

export const PLATFORM_OWNER_DEMO = Object.freeze({
  email: 'platform.owner@schoolos.demo',
  password: 'PlatformOwner@2026',
  name: 'SchoolOS Platform Owner',
});

export const seedPlatformOwner = async () => {
  const password = await bcryptjs.hash(PLATFORM_OWNER_DEMO.password, 10);
  const owner = await prisma.user.upsert({
    where: { email: PLATFORM_OWNER_DEMO.email },
    update: {
      password,
      name: PLATFORM_OWNER_DEMO.name,
      role: 'PLATFORM_OWNER',
      schoolId: null,
      classId: null,
      sectionId: null,
      employeeId: 'PLATFORM-OWNER-001',
      isActive: true,
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email: PLATFORM_OWNER_DEMO.email,
      password,
      name: PLATFORM_OWNER_DEMO.name,
      role: 'PLATFORM_OWNER',
      employeeId: 'PLATFORM-OWNER-001',
      isActive: true,
      mustChangePassword: false,
    },
    select: { id: true, email: true, name: true, role: true },
  });
  console.log(`[platform-owner-seed] ${owner.email}: ready`);
  return owner;
};

export const disconnectPlatformOwnerSeed = async () => prisma.$disconnect();

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await seedPlatformOwner();
  } finally {
    await disconnectPlatformOwnerSeed();
  }
}
