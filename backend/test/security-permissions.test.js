import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, PERMISSIONS } from '../src/config/permissions.js';
import { normalizeAnswer, validatePassword } from '../src/services/accountSecurity.service.js';
import prisma from '../src/config/prisma.client.js';

after(async () => prisma.$disconnect());

test('strong-password validation requires all character groups', () => {
  assert.equal(validatePassword('StrongPass7!'), true);
  assert.equal(validatePassword('short7!A'), false);
  assert.equal(validatePassword('NoSymbol123'), false);
  assert.equal(validatePassword('NOLOWERCASE7!'), false);
});

test('security answers are normalized consistently before hashing', () => {
  assert.equal(normalizeAnswer('  My   First SCHOOL  '), 'my first school');
});

test('Curriculum Manager receives academic permissions but not credential administration', () => {
  assert.equal(hasPermission('CURRICULUM_MANAGER', PERMISSIONS.CURRICULUM_MANAGE), true);
  assert.equal(hasPermission('CURRICULUM_MANAGER', PERMISSIONS.WEEKLY_SLOTS_MANAGE), true);
  assert.equal(hasPermission('CURRICULUM_MANAGER', PERMISSIONS.CALENDAR_MANAGE), false);
  assert.equal(hasPermission('CURRICULUM_MANAGER', PERMISSIONS.USERS_PASSWORD_RESET), false);
});

test('school administrators retain wildcard control', () => {
  assert.equal(hasPermission('ADMIN', PERMISSIONS.USERS_PASSWORD_RESET), true);
  assert.equal(hasPermission('SCHOOL_OWNER', PERMISSIONS.CURRICULUM_MANAGE), true);
});

test('platform owners retain cross-module control', () => {
  assert.equal(hasPermission('PLATFORM_OWNER', PERMISSIONS.USERS_PASSWORD_RESET), true);
  assert.equal(hasPermission('PLATFORM_OWNER', PERMISSIONS.CURRICULUM_MANAGE), true);
  assert.equal(hasPermission('PLATFORM_OWNER', PERMISSIONS.FEES_REPORT), true);
});
