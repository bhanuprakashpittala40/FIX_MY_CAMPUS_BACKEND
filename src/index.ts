import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

import authRoutes from './routes/auth.routes';
import complaintRoutes from './routes/complaint.routes';
import adminRoutes from './routes/admin.routes';
import maintenanceRoutes from './routes/maintenance.routes';
import notificationRoutes from './routes/notification.routes';
import uploadRoutes from './routes/upload.routes';
import { checkAndEscalateOverdueComplaints } from './services/slaService';
import { getApiDocumentationHtml } from './docs/apiDocsHtml';

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploaded complaint files
app.use('/uploads', express.static(uploadsDir));

// Interactive API Documentation
app.get('/api-docs', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(getApiDocumentationHtml());
});

app.get('/', (_req, res) => {
  res.redirect('/api-docs');
});

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    system: 'Fix My Campus – Smart Campus Complaint Management Platform',
    timestamp: new Date().toISOString(),
    documentation: 'http://localhost:' + PORT + '/api-docs',
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled application error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred',
  });
});

// Periodic SLA Monitor (runs every 3 minutes)
setInterval(async () => {
  try {
    const overdueCount = await checkAndEscalateOverdueComplaints();
    if (overdueCount > 0) {
      console.log(`[SLA Monitor] Escalated ${overdueCount} overdue complaints.`);
    }
  } catch (error) {
    console.error('[SLA Monitor] Error during automatic escalation check:', error);
  }
}, 3 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Fix My Campus API Server listening on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📁 Static Uploads: http://localhost:${PORT}/uploads`);
  
  // Run immediate initial SLA check
  checkAndEscalateOverdueComplaints().catch(console.error);
});
