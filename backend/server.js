import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import authRoutes from './src/routes/auth.js';
import schoolRoutes from './src/routes/schools.js';
import classRoutes from './src/routes/classes.js';
import sectionRoutes from './src/routes/sections.js';
import subjectRoutes from './src/routes/subjects.js';
import teacherRoutes from './src/routes/teachers.js';
import timetableRoutes from './src/routes/timetables.js';
import galleryRoutes from './src/routes/gallery.js';
import publicRoutes from './src/routes/public.js';
import schoolSettingsRoutes from './src/routes/schoolSettings.js';
import uploadRoutes from './src/routes/uploads.js';
import academicStructureRoutes from './src/routes/academicStructure.js';
import widgetRoutes from './src/routes/widgets.js';
import studentRoutes from './src/routes/students.js';
import usersRoutes from './src/routes/users.js';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint (without database)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  });
});

// Database Health Check
app.get('/health/db', async (req, res) => {
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
app.use('/api/timetables', timetableRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/school-settings', schoolSettingsRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/academic-structure', academicStructureRoutes);
app.use('/api/widgets', widgetRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/users', usersRoutes);


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
  res.status(500).json({ 
    success: false,
    message: 'Internal server error', 
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
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✅ Server successfully started!`);
      console.log(`   URL: http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Health Check: http://localhost:${PORT}/api/health`);
      console.log(`   Auth API: http://localhost:${PORT}/api/auth/login\n`);
    });
  } catch (error) {
    console.error('\n❌ Failed to start server:\n');
    console.error(`   Error: ${error.message}\n`);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  try {
    await prisma.$disconnect();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  try {
    await prisma.$disconnect();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

export default app;
