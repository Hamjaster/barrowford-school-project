import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import personalSectionRoutes from './routes/personalSection.js';
import subjectRoutes from './routes/subject.js';
import studentRoutes from './routes/student.js';
import teacherRoutes from './routes/teacher.js';
import parentRoutes from './routes/parent.js';
import reflectionRouter from './routes/reflection.js'
import moderationRoutes from './routes/moderation.js';


const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - Allow all origins
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
// const limiter = rateLimit({
//   windowMs: Number(config.rateLimit.windowMs) || 15 * 60 * 1000, // default to 15 minutes if not set
//   max: Number(config.rateLimit.max) || 100, // default to 100 requests per window if not set
//   message: {
//     success: false,
//     message: 'Too many requests from this IP, please try again later.',
//   },
// });
// app.use('/api/', limiter);

// Logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/personalSection', personalSectionRoutes);
app.use('/api/subject', subjectRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/reflection',reflectionRouter)
app.use('/api/moderation', moderationRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to School Portal API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
    },
  });
});

// 404 handler
app.use(notFound);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {


    app.listen(config.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.port}`);
      console.log(`📝 Environment: ${config.nodeEnv}`);
      console.log(`🔗 API Base URL: http://localhost:${config.port}/api`);
      console.log(`🌐 CORS: All origins allowed`);

    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('Uncaught Exception:', err.message);
  process.exit(1);
});


startServer();
