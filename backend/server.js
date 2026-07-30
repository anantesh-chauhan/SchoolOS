import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from './src/config/prisma.client.js';
import authRoutes from './src/routes/auth.js';
import schoolRoutes from './src/routes/schools.js';
import classRoutes from './src/routes/classes.js';
import sectionRoutes from './src/routes/sections.js';
import subjectRoutes from './src/routes/subjects.js';
import teacherRoutes from './src/routes/teachers.js';
import teacherDashboardRoutes from './src/routes/teacherDashboard.js';
import timetableRoutes from './src/routes/timetables.js';
import galleryRoutes from './src/routes/gallery.js';
import publicRoutes from './src/routes/public.js';
import schoolSettingsRoutes from './src/routes/schoolSettings.js';
import uploadRoutes from './src/routes/uploads.js';
import academicStructureRoutes from './src/routes/academicStructure.js';
import widgetRoutes from './src/routes/widgets.js';
import studentRoutes from './src/routes/students.js';
import usersRoutes from './src/routes/users.js';
import chapterFeedbackRoutes from './src/routes/chapterFeedback.js';
import attendanceRoutes from './src/routes/attendance.js';
import dashboardRoutes from './src/routes/dashboard.js';
import issueReportRoutes from './src/modules/issue-report/issueReport.routes.js';
import studentPortalRoutes from './src/modules/student/studentPortal.routes.js';
import securityRoutes from './src/routes/security.js';
import curriculumRoutes from './src/routes/curriculum.js';
import academicStaffingRoutes from './src/routes/academicStaffing.js';
import feeRoutes from './src/modules/fees/fee.routes.js';
import homeworkRoutes from './src/modules/homework/homework.routes.js';
import communicationRoutes from './src/modules/communication/communication.routes.js';
import hrRoutes from './src/modules/hr/hr.routes.js';
import analyticsRoutes from './src/modules/analytics/analytics.routes.js';
import { analyticsInvalidationMiddleware } from './src/modules/analytics/analytics.invalidation.js';
import { processScheduled, processQueuedDeliveries } from './src/modules/communication/communication.service.js';

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.join(currentDirectory, 'public');
const frontendIndex = path.join(frontendDirectory, 'index.html');
let server;
let isShuttingDown = false;

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const corsOptions = (req, callback) => {
  const origin = req.get('Origin');
  const requestOrigin = `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
  const normalizedOrigin = origin?.replace(/\/$/, '');

  if (
    !origin
    || !isProduction
    || normalizedOrigin === requestOrigin
    || allowedOrigins.includes(normalizedOrigin)
  ) {
    callback(null, {
      origin: true,
      credentials: true,
      optionsSuccessStatus: 204,
    });
    return;
  }

  const error = new Error('Origin is not allowed by CORS');
  error.status = 403;
  callback(error);
};

// Middleware
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'https://api.cloudinary.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      mediaSrc: ["'self'", 'blob:', 'https:'],
    },
  },
}));
app.use(cors(corsOptions));
app.use(compression({
  threshold: 1024,
  filter: (req, res) => req.headers['x-no-compression']
    ? false
    : compression.filter(req, res),
}));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: process.env.FORM_BODY_LIMIT || '1mb',
  parameterLimit: 1000,
}));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(analyticsInvalidationMiddleware);

// Health Check Endpoint (without database)
app.get('/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  });
});

// Database Health Check
app.get('/health/db', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'disconnected',
      error: error.message,
    });
  }
});

// API Health endpoint
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'connected',
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/teacher', teacherDashboardRoutes);
app.use('/api/timetables', timetableRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/school-settings', schoolSettingsRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/academic-structure', academicStructureRoutes);
app.use('/api/widgets', widgetRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', chapterFeedbackRoutes);
app.use('/api', issueReportRoutes);
app.use('/api/student', studentPortalRoutes);
app.use('/api', securityRoutes);
app.use('/api/curriculum', curriculumRoutes);
app.use('/api', academicStaffingRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api', homeworkRoutes);
app.use('/api', communicationRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/analytics', analyticsRoutes);

// Serve the compiled Vite application in the single-service deployment.
if (existsSync(frontendIndex)) {
  app.use(express.static(frontendDirectory, {
    index: false,
    maxAge: 0,
    setHeaders(res, filePath) {
      const fileName = path.basename(filePath);
      const isHashedAsset = path.basename(path.dirname(filePath)) === 'assets'
        && /-[A-Za-z0-9_-]{8,}\./.test(fileName);

      if (fileName === 'index.html' || fileName === 'sw.js') {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (fileName === 'manifest.webmanifest') {
        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      } else if (isHashedAsset || /^workbox-[A-Za-z0-9_-]+\.js$/.test(fileName)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
      }
    },
  }));

  app.get('*', (req, res, next) => {
    if (
      req.path === '/api'
      || req.path.startsWith('/api/')
      || path.extname(req.path)
    ) {
      next();
      return;
    }

    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(frontendIndex);
  });
}

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Endpoint not found' 
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  const status = Number(err.status || err.statusCode) || 500;
  res.status(status).json({
    success: false,
    message: status >= 500 ? 'Internal server error' : err.message,
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Server Startup
const startServer = async () => {
  try {
    console.log('\n🚀 Starting SchoolOS Backend Server...\n');

    // Test Prisma connection
    console.log('📡 Connecting to database...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✓ Database connection successful');

    // Start Express server
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✅ Server successfully started!`);
      console.log(`   URL: http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Health Check: http://localhost:${PORT}/api/health`);
      console.log(`   Auth API: http://localhost:${PORT}/api/auth/login\n`);
    });
    if (process.env.COMMUNICATION_JOBS_ENABLED !== 'false') {
      const interval = Math.max(15000, Number(process.env.COMMUNICATION_JOB_INTERVAL_MS) || 60000);
      setInterval(() => processScheduled().then(() => processQueuedDeliveries({})).catch((error) => console.error('Communication job failed:', error.message)), interval).unref();
    }
  } catch (error) {
    console.error('\n❌ Failed to start server:\n');
    console.error(`   Error: ${error.message}\n`);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.once('SIGTERM', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n🛑 Shutting down gracefully...');
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await prisma.$disconnect();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.once('SIGINT', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n🛑 Shutting down gracefully...');
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await prisma.$disconnect();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

export default app;
