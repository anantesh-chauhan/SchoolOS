import { disconnectAcademicSeed, seedAcademicData } from './seedAcademicData.js';

try {
  await seedAcademicData();
} finally {
  await disconnectAcademicSeed();
}
