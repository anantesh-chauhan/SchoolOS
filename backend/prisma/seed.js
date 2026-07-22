import 'dotenv/config';
import bcryptjs from 'bcryptjs';

if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}

const { PrismaClient } = await import('../src/generated/prisma/index.js');
const { disconnectAcademicSeed, seedAcademicData } = await import('./seedAcademicData.js');
const { disconnectTenantIsolationSeed, seedTenantIsolationDemo } = await import('./seedTenantIsolationDemo.js');
const { disconnectPlatformOwnerSeed, seedPlatformOwner } = await import('./seedPlatformOwner.js');
const { disconnectHomeworkSeed, seedHomeworkResources } = await import('./seedHomeworkResources.js');
const { disconnectCommunicationSeed, seedCommunication } = await import('./seedCommunication.js');
const { disconnectAcademicStaffingSeed, seedAcademicStaffing } = await import('./seedAcademicStaffing.js');

const prisma = new PrismaClient();
const demoPassword = 'admin123';

const ensureDemoFoundation = async () => {
  const password = await bcryptjs.hash(demoPassword, 10);
  const school = await prisma.school.upsert({
    where: { schoolCode: 'GVS001' },
    update: { status: 'ACTIVE' },
    create: {
      schoolName: 'Green Valley School',
      schoolCode: 'GVS001',
      slug: 'green-valley-school',
      address: 'Plot 18, Sector 62',
      city: 'Noida',
      state: 'Uttar Pradesh',
      phone: '+91-120-4011001',
      email: 'contact@greenvalley.edu.in',
      status: 'ACTIVE',
      theme: { primaryColor: '#0f766e', secondaryColor: '#155e75' },
      config: { academicSession: '2026-27', board: 'CBSE', demoData: true },
    },
  });

  await prisma.schoolSettings.upsert({
    where: { schoolId: school.id },
    update: {},
    create: {
      schoolId: school.id,
      schoolName: school.schoolName,
      email: school.email,
      phone: school.phone,
      addressLine1: school.address,
      city: school.city,
      state: school.state,
      country: 'India',
      postalCode: '201309',
      website: 'https://greenvalley.example.test',
      supportEmail: 'support@greenvalley.example.test',
      primaryColor: '#0f766e',
      secondaryColor: '#155e75',
    },
  });

  const users = [
    ['admin@greenvalley.edu.in', 'Green Valley Admin', 'ADMIN', 'ADM-GVS-001'],
    ['owner@greenvalley.edu.in', 'Green Valley Owner', 'SCHOOL_OWNER', 'OWN-GVS-001'],
  ];
  for (const [email, name, role, employeeId] of users) {
    await prisma.user.upsert({
      where: { email },
      update: { password, name, role, schoolId: school.id, employeeId, isActive: true, mustChangePassword: false },
      create: { email, password, name, role, schoolId: school.id, employeeId, isActive: true, mustChangePassword: false },
    });
  }

  const albums = [
    {
      title: 'Annual Function 2026',
      description: 'Cultural performances and awards from the annual celebration.',
      coverImageUrl: 'https://picsum.photos/id/1050/1200/900',
      photos: [
        ['https://picsum.photos/id/1025/1200/900', 'Opening ceremony'],
        ['https://picsum.photos/id/1039/1200/900', 'Cultural performance'],
        ['https://picsum.photos/id/1041/1200/900', 'Prize distribution'],
      ],
    },
    {
      title: 'Sports Day 2026',
      description: 'Track events, team competitions, and school spirit.',
      coverImageUrl: 'https://picsum.photos/id/1011/1200/900',
      photos: [
        ['https://picsum.photos/id/1018/1200/900', 'Sprint finals'],
        ['https://picsum.photos/id/1019/1200/900', 'Relay race'],
        ['https://picsum.photos/id/1022/1200/900', 'Medal winners'],
      ],
    },
  ];
  for (const [albumIndex, album] of albums.entries()) {
    const group = await prisma.galleryGroup.upsert({
      where: { schoolId_title: { schoolId: school.id, title: album.title } },
      update: { isVisible: true },
      create: {
        schoolId: school.id,
        title: album.title,
        description: album.description,
        coverImageUrl: album.coverImageUrl,
        isVisible: true,
        displayOrder: albumIndex + 1,
      },
    });
    const existingPhotos = await prisma.galleryPhoto.count({ where: { groupId: group.id } });
    if (existingPhotos === 0) {
      await prisma.galleryPhoto.createMany({
        data: album.photos.map(([imageUrl, caption], index) => ({
          schoolId: school.id,
          groupId: group.id,
          imageUrl,
          caption,
          isVisible: true,
          displayOrder: index + 1,
        })),
      });
    }
  }

  console.log(`[foundation-seed] ${school.schoolName}: ready`);
};

try {
  await seedPlatformOwner();
  await ensureDemoFoundation();
  await seedAcademicData();
  await seedAcademicStaffing();
  await seedTenantIsolationDemo();
  await seedHomeworkResources();
  await seedCommunication();
} finally {
  await prisma.$disconnect();
  await disconnectAcademicSeed();
  await disconnectTenantIsolationSeed();
  await disconnectPlatformOwnerSeed();
  await disconnectHomeworkSeed();
  await disconnectCommunicationSeed();
  await disconnectAcademicStaffingSeed();
}
