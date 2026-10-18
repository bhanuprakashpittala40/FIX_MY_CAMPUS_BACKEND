import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest, requireRole } from '../middleware/auth';
import { checkAndEscalateOverdueComplaints } from '../services/slaService';

const router = Router();

// Apply auth and require ADMIN role to all routes in this file
router.use(authenticate, requireRole(['ADMIN']));

// 1. Dashboard Metrics
router.get('/metrics', async (_req, res: Response): Promise<void> => {
  try {
    // Trigger SLA check on dashboard visit
    await checkAndEscalateOverdueComplaints();

    const [
      total,
      submitted,
      underReview,
      assigned,
      inProgress,
      onHold,
      resolved,
      closed,
      rejected,
      reopened,
      overdue,
      critical,
      totalUsers,
    ] = await Promise.all([
      prisma.complaint.count(),
      prisma.complaint.count({ where: { status: 'SUBMITTED' } }),
      prisma.complaint.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.complaint.count({ where: { status: 'ASSIGNED' } }),
      prisma.complaint.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.complaint.count({ where: { status: 'ON_HOLD' } }),
      prisma.complaint.count({ where: { status: 'RESOLVED' } }),
      prisma.complaint.count({ where: { status: 'CLOSED' } }),
      prisma.complaint.count({ where: { status: 'REJECTED' } }),
      prisma.complaint.count({ where: { status: 'REOPENED' } }),
      prisma.complaint.count({ where: { isOverdue: true } }),
      prisma.complaint.count({ where: { priority: 'CRITICAL', status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      prisma.user.count({ where: { isActive: true } }),
    ]);

    // Calculate SLA compliance rate
    const resolvedComplaints = await prisma.complaint.findMany({
      where: { status: { in: ['RESOLVED', 'CLOSED'] } },
      select: { createdAt: true, resolvedAt: true, slaDeadline: true },
    });

    let slaCompliantCount = 0;
    let totalResolutionHours = 0;

    for (const c of resolvedComplaints) {
      if (c.resolvedAt) {
        if (c.resolvedAt <= c.slaDeadline) {
          slaCompliantCount++;
        }
        const diffMs = c.resolvedAt.getTime() - c.createdAt.getTime();
        totalResolutionHours += diffMs / (1000 * 60 * 60);
      }
    }

    const slaComplianceRate =
      resolvedComplaints.length > 0 ? Math.round((slaCompliantCount / resolvedComplaints.length) * 100) : 100;

    const avgResolutionHours =
      resolvedComplaints.length > 0 ? Math.round((totalResolutionHours / resolvedComplaints.length) * 10) / 10 : 0;

    res.json({
      total,
      pending: submitted + underReview,
      activeInProgress: assigned + inProgress + onHold + reopened,
      resolved: resolved + closed,
      overdue,
      critical,
      rejected,
      totalUsers,
      slaComplianceRate,
      avgResolutionHours,
    });
  } catch (error) {
    console.error('Error fetching admin metrics:', error);
    res.status(500).json({ error: 'Failed to retrieve admin metrics' });
  }
});

// 2. Visual Analytics for Recharts
router.get('/analytics', async (_req, res: Response): Promise<void> => {
  try {
    const [categories, complaints, buildings] = await Promise.all([
      prisma.category.findMany({ select: { id: true, name: true } }),
      prisma.complaint.findMany({
        select: {
          id: true,
          status: true,
          priority: true,
          categoryId: true,
          buildingId: true,
          createdAt: true,
          isOverdue: true,
        },
      }),
      prisma.building.findMany({ select: { id: true, name: true, code: true } }),
    ]);

    // Category breakdown
    const categoryMap: Record<string, { name: string; total: number; resolved: number; critical: number }> = {};
    for (const cat of categories) {
      categoryMap[cat.id] = { name: cat.name, total: 0, resolved: 0, critical: 0 };
    }

    // Status breakdown
    const statusMap: Record<string, number> = {
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      ON_HOLD: 0,
      RESOLVED: 0,
      CLOSED: 0,
      REJECTED: 0,
      REOPENED: 0,
    };

    // Priority breakdown
    const priorityMap: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    // Building breakdown
    const buildingMap: Record<string, { name: string; code: string; count: number; overdue: number }> = {};
    for (const b of buildings) {
      buildingMap[b.id] = { name: b.name, code: b.code, count: 0, overdue: 0 };
    }

    for (const c of complaints) {
      if (categoryMap[c.categoryId]) {
        categoryMap[c.categoryId].total++;
        if (['RESOLVED', 'CLOSED'].includes(c.status)) categoryMap[c.categoryId].resolved++;
        if (c.priority === 'CRITICAL') categoryMap[c.categoryId].critical++;
      }

      if (statusMap[c.status] !== undefined) {
        statusMap[c.status]++;
      }

      if (priorityMap[c.priority] !== undefined) {
        priorityMap[c.priority]++;
      }

      if (buildingMap[c.buildingId]) {
        buildingMap[c.buildingId].count++;
        if (c.isOverdue) buildingMap[c.buildingId].overdue++;
      }
    }

    res.json({
      byCategory: Object.values(categoryMap),
      byStatus: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
      byPriority: Object.entries(priorityMap).map(([priority, count]) => ({ priority, count })),
      byBuilding: Object.values(buildingMap),
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
});

// 3. Activity / Audit Logs
router.get('/audit-logs', async (req, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const [total, activities] = await Promise.all([
      prisma.complaintActivity.count(),
      prisma.complaintActivity.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          complaint: {
            select: { id: true, ticketNumber: true, title: true, priority: true },
          },
        },
      }),
    ]);

    res.json({
      data: activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

// 4. User Management
router.get('/users', async (_req, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            complaintsSubmitted: true,
            complaintsAssigned: true,
          },
        },
      },
    });

    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

router.patch('/users/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, isActive, department, phone } = req.body;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(role ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(phone !== undefined ? { phone } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        phone: true,
        isActive: true,
      },
    });

    res.json({ message: 'User updated successfully', user: updated });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// 5. Campus Buildings Management
router.get('/buildings', async (_req, res: Response): Promise<void> => {
  try {
    const buildings = await prisma.building.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { complaints: true } },
      },
    });
    res.json({ buildings });
  } catch (error) {
    console.error('Error fetching buildings:', error);
    res.status(500).json({ error: 'Failed to retrieve buildings' });
  }
});

router.post('/buildings', async (req, res: Response): Promise<void> => {
  try {
    const { name, code, zone, floors, isCritical } = req.body;
    if (!name || !code || !zone) {
      res.status(400).json({ error: 'Name, unique code, and zone are required' });
      return;
    }

    const building = await prisma.building.create({
      data: {
        name,
        code: code.toUpperCase().trim(),
        zone,
        floors: Number(floors) || 1,
        isCritical: Boolean(isCritical),
      },
    });

    res.status(201).json({ message: 'Building created successfully', building });
  } catch (error) {
    console.error('Error creating building:', error);
    res.status(500).json({ error: 'Failed to create building' });
  }
});

router.patch('/buildings/:id', async (req, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code, zone, floors, isCritical, isActive } = req.body;

    const building = await prisma.building.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(code ? { code: code.toUpperCase().trim() } : {}),
        ...(zone ? { zone } : {}),
        ...(floors !== undefined ? { floors: Number(floors) } : {}),
        ...(isCritical !== undefined ? { isCritical: Boolean(isCritical) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });

    res.json({ message: 'Building updated successfully', building });
  } catch (error) {
    console.error('Error updating building:', error);
    res.status(500).json({ error: 'Failed to update building' });
  }
});

// 6. Category Configuration
router.get('/categories', async (_req, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: { select: { complaints: true } },
      },
    });
    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to retrieve categories' });
  }
});

router.post('/categories', async (req, res: Response): Promise<void> => {
  try {
    const { name, description, icon, slaHours, displayOrder } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Category name is required' });
      return;
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        icon: icon || 'Wrench',
        slaHours: Number(slaHours) || 48,
        displayOrder: Number(displayOrder) || 0,
      },
    });

    res.status(201).json({ message: 'Category created successfully', category });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.patch('/categories/:id', async (req, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, icon, slaHours, displayOrder, isActive } = req.body;

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(icon ? { icon } : {}),
        ...(slaHours !== undefined ? { slaHours: Number(slaHours) } : {}),
        ...(displayOrder !== undefined ? { displayOrder: Number(displayOrder) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });

    res.json({ message: 'Category updated successfully', category });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// 7. Priority Rules Configuration
router.get('/priority-rules', async (_req, res: Response): Promise<void> => {
  try {
    let ruleConfig = await prisma.priorityRuleConfig.findUnique({
      where: { key: 'smart_priority_rules' },
    });

    if (!ruleConfig) {
      const defaultRules = {
        safetyWeights: { IMMEDIATE_DANGER: 45, HAZARD: 25, NONE: 0 },
        severityWeights: { CATASTROPHIC: 35, MAJOR: 25, MODERATE: 15, MINOR: 5 },
        affectedWeights: { CAMPUS_WIDE: 25, BUILDING_WIDE: 18, GROUP: 10, INDIVIDUAL: 2 },
        locationCriticalBonus: 15,
        thresholds: { CRITICAL: 75, HIGH: 45, MEDIUM: 22 },
        slaHours: { CRITICAL: 4, HIGH: 24, MEDIUM: 72, LOW: 168 },
      };

      ruleConfig = await prisma.priorityRuleConfig.create({
        data: {
          key: 'smart_priority_rules',
          value: JSON.stringify(defaultRules),
        },
      });
    }

    res.json({ rules: JSON.parse(ruleConfig.value), updatedAt: ruleConfig.updatedAt });
  } catch (error) {
    console.error('Error fetching priority rules:', error);
    res.status(500).json({ error: 'Failed to retrieve priority rules' });
  }
});

router.put('/priority-rules', async (req, res: Response): Promise<void> => {
  try {
    const { rules } = req.body;
    if (!rules || typeof rules !== 'object') {
      res.status(400).json({ error: 'Valid rules configuration object is required' });
      return;
    }

    const updated = await prisma.priorityRuleConfig.upsert({
      where: { key: 'smart_priority_rules' },
      update: { value: JSON.stringify(rules) },
      create: { key: 'smart_priority_rules', value: JSON.stringify(rules) },
    });

    res.json({ message: 'Priority rules configuration saved', rules: JSON.parse(updated.value) });
  } catch (error) {
    console.error('Error saving priority rules:', error);
    res.status(500).json({ error: 'Failed to update priority rules' });
  }
});

export default router;
