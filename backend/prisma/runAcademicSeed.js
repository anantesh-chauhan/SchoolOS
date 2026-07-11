import { disconnectAcademicSeed, seedAcademicData } from './seedAcademicData.js';

try {
  const results = await seedAcademicData();
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  console.error('[academic-seed-runner] failed', error);
  process.exitCode = 1;
} finally {
  await disconnectAcademicSeed();
}
