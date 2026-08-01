import { createHash, timingSafeEqual } from 'node:crypto';
import prisma from '../config/prisma.client.js';

const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');
const refreshLifetimeMs = () => {
  const value = String(process.env.JWT_REFRESH_EXPIRY || '7d').trim();
  const match = value.match(/^(\d+)([mhd])$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  return Number(match[1]) * ({ m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2].toLowerCase()]);
};

export const saveAuthSession = (req, payload, refreshToken) => prisma.authSession.upsert({
  where: { id: payload.sessionId },
  update: {
    schoolId: payload.schoolId,
    roleAssignmentId: payload.roleAssignmentId,
    refreshTokenHash: hashToken(refreshToken),
    tokenVersion: payload.tokenVersion || 1,
    expiresAt: new Date(Date.now() + refreshLifetimeMs()),
    revokedAt: null,
    lastUsedAt: new Date(),
    ipAddress: req?.ip || null,
    userAgent: req?.get?.('user-agent') || null,
  },
  create: {
    id: payload.sessionId,
    userId: payload.id,
    schoolId: payload.schoolId,
    roleAssignmentId: payload.roleAssignmentId,
    refreshTokenHash: hashToken(refreshToken),
    tokenVersion: payload.tokenVersion || 1,
    expiresAt: new Date(Date.now() + refreshLifetimeMs()),
    ipAddress: req?.ip || null,
    userAgent: req?.get?.('user-agent') || null,
  },
});

export const validateRefreshSession = async (payload, refreshToken) => {
  if (!payload.sessionId) return null; // temporary compatibility for pre-migration tokens
  const session = await prisma.authSession.findFirst({ where: {
    id: payload.sessionId,
    userId: payload.id,
    revokedAt: null,
    expiresAt: { gt: new Date() },
  } });
  if (!session) return false;
  const expected = Buffer.from(session.refreshTokenHash, 'hex');
  const actual = Buffer.from(hashToken(refreshToken), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? session : false;
};

export const revokeAuthSession = (sessionId, userId) => sessionId
  ? prisma.authSession.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } })
  : Promise.resolve();

export const revokeAllAuthSessions = (userId) => prisma.$transaction([
  prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } }),
]);
