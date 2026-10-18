import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest, requireRole } from '../middleware/auth';
import { calculatePriority } from '../services/priorityEngine';
import { SafetyRiskLevel, SeverityLevel, AffectedCountLevel, PriorityLevel, ComplaintStatus } from '../types';

const router = Router();

// Validation Schemas
const createComplaintSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  categoryId: z.string().min(1, 'Category is required'),
  buildingId: z.string().min(1, 'Building is required'),
  locationDetails: z.string().min(2, 'Specific room or location details required'),
  safetyRisk: z.enum(['IMMEDIATE_DANGER', 'HAZARD', 'NONE']).default('NONE'),
  severity: z.enum(['CATASTROPHIC', 'MAJOR', 'MODERATE', 'MINOR']).default('MODERATE'),
  affectedCount: z.enum(['CAMPUS_WIDE', 'BUILDING_WIDE', 'GROUP', 'INDIVIDUAL']).default('INDIVIDUAL'),
  images: z.array(z.string()).optional().default([]),
});

const statusUpdateSchema = z.object({
  status: z.enum([
    'SUBMITTED',
    'UNDER_REVIEW',
    'ASSIGNED',
    'IN_PROGRESS',
    'ON_HOLD',
    'RESOLVED',
    'CLOSED',
    'REJECTED',
    'REOPENED',
  ]),
  notes: z.string().optional(),
  rejectionReason: z.string().optional(),
  holdReason: z.string().optional(),
  expectedRestartDate: z.string().optional(),
  reopenReason: z.string().optional(),
  resolutionNotes: z.string().optional(),
  resolutionImages: z.array(z.string()).optional(),
});

// Helper for generating ticket numbers: FMC-YYYYMM-XXXX
async function generateTicketNumber(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
  const count = await prisma.complaint.count();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `FMC-${dateStr}-${(count + 1).toString().padStart(4, '0')}-${randomSuffix}`;
}

// 1. Get Dropdown Options (Categories, Buildings, Maintenance Technicians)
router.get('/meta/options', authenticate, async (_req, res: Response): Promise<void> => {
  try {
    const [categories, buildings, technicians] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.building.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        where: { role: 'MAINTENANCE', isActive: true },
        select: { id: true, name: true, email: true, department: true },
      }),
    ]);

    res.json({ categories, buildings, technicians });
  } catch (error) {
    console.error('Error fetching meta options:', error);
    res.status(500).json({ error: 'Failed to fetch metadata options' });
  }
});

// 2. List Complaints with Filtering, Sorting, and Pagination
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const {
      status,
      priority,
      categoryId,
      buildingId,
      search,
      isOverdue,
      assignedToMe,
      submittedByMe,
      page = '1',
      limit = '10',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * take;

    const where: any = {};

    // Role-based visibility scoping
    if (user.role === 'STUDENT' || user.role === 'FACULTY') {
      where.submittedById = user.id;
    } else if (user.role === 'MAINTENANCE') {
      if (assignedToMe === 'true' || !req.query.scope || req.query.scope === 'assigned') {
        where.assignedToId = user.id;
      }
    }

    // Explicit filter overrides if specified
    if (submittedByMe === 'true') {
      where.submittedById = user.id;
    }
    if (assignedToMe === 'true') {
      where.assignedToId = user.id;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (priority && priority !== 'ALL') {
      where.priority = priority;
    }
    if (categoryId && categoryId !== 'ALL') {
      where.categoryId = categoryId;
    }
    if (buildingId && buildingId !== 'ALL') {
      where.buildingId = buildingId;
    }
    if (isOverdue === 'true') {
      where.isOverdue = true;
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { ticketNumber: { contains: q } },
        { title: { contains: q } },
        { description: { contains: q } },
        { locationDetails: { contains: q } },
      ];
    }

    const orderBy: any = {};
    if (sortBy === 'priority') {
      orderBy.calculatedScore = sortOrder === 'asc' ? 'asc' : 'desc';
    } else if (sortBy === 'slaDeadline') {
      orderBy.slaDeadline = sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
      orderBy.createdAt = sortOrder === 'asc' ? 'asc' : 'desc';
    }

    const [total, complaints] = await Promise.all([
      prisma.complaint.count({ where }),
      prisma.complaint.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          category: { select: { id: true, name: true, icon: true, slaHours: true } },
          building: { select: { id: true, name: true, code: true, zone: true } },
          submittedBy: { select: { id: true, name: true, email: true, role: true, department: true } },
          assignedTo: { select: { id: true, name: true, email: true, department: true } },
          _count: { select: { comments: true, activities: true } },
        },
      }),
    ]);

    const formatted = complaints.map((c) => ({
      ...c,
      images: JSON.parse(c.images || '[]'),
      resolutionImages: JSON.parse(c.resolutionImages || '[]'),
    }));

    res.json({
      data: formatted,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ error: 'Failed to retrieve complaints list' });
  }
});

// 3. Get Single Complaint Details
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        category: true,
        building: true,
        submittedBy: { select: { id: true, name: true, email: true, role: true, department: true, phone: true } },
        assignedTo: { select: { id: true, name: true, email: true, department: true, phone: true } },
        activities: {
          orderBy: { createdAt: 'desc' },
        },
        comments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    // Role check: If student/faculty, only view their own complaints unless public view
    if ((user.role === 'STUDENT' || user.role === 'FACULTY') && complaint.submittedById !== user.id) {
      res.status(403).json({ error: 'You do not have permission to view this complaint' });
      return;
    }

    res.json({
      ...complaint,
      images: JSON.parse(complaint.images || '[]'),
      resolutionImages: JSON.parse(complaint.resolutionImages || '[]'),
    });
  } catch (error) {
    console.error('Error fetching complaint details:', error);
    res.status(500).json({ error: 'Failed to retrieve complaint' });
  }
});

// 4. Create New Complaint with Smart Priority Evaluation
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const parseResult = createComplaintSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const {
      title,
      description,
      categoryId,
      buildingId,
      locationDetails,
      safetyRisk,
      severity,
      affectedCount,
      images,
    } = parseResult.data;

    // Verify building & category
    const [building, category] = await Promise.all([
      prisma.building.findUnique({ where: { id: buildingId } }),
      prisma.category.findUnique({ where: { id: categoryId } }),
    ]);

    if (!building) {
      res.status(400).json({ error: 'Invalid building selected' });
      return;
    }
    if (!category) {
      res.status(400).json({ error: 'Invalid category selected' });
      return;
    }

    // Smart Priority Engine calculation
    const priorityResult = calculatePriority({
      safetyRisk: safetyRisk as SafetyRiskLevel,
      severity: severity as SeverityLevel,
      affectedCount: affectedCount as AffectedCountLevel,
      isLocationCritical: building.isCritical,
      categorySlaHours: category.slaHours,
    });

    const ticketNumber = await generateTicketNumber();

    const complaint = await prisma.$transaction(async (tx) => {
      const created = await tx.complaint.create({
        data: {
          ticketNumber,
          title,
          description,
          locationDetails,
          status: 'SUBMITTED',
          priority: priorityResult.priority,
          calculatedScore: priorityResult.score,
          safetyRisk,
          severity,
          affectedCount,
          locationImpact: building.isCritical,
          slaDeadline: priorityResult.slaDeadline,
          images: JSON.stringify(images),
          submittedById: user.id,
          buildingId,
          categoryId,
        },
        include: {
          category: true,
          building: true,
          submittedBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Log initial creation activity
      await tx.complaintActivity.create({
        data: {
          complaintId: created.id,
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          previousStatus: null,
          newStatus: 'SUBMITTED',
          action: 'CREATED',
          comments: `Complaint submitted. Priority evaluated to ${priorityResult.priority} (Score: ${priorityResult.score}). Reasoning: ${priorityResult.breakdown.reasoning}`,
        },
      });

      // If Critical or immediate danger, send high-priority alert to all administrators
      if (priorityResult.priority === 'CRITICAL' || safetyRisk === 'IMMEDIATE_DANGER') {
        const admins = await tx.user.findMany({
          where: { role: 'ADMIN', isActive: true },
        });

        for (const admin of admins) {
          await tx.notification.create({
            data: {
              userId: admin.id,
              complaintId: created.id,
              title: `🚨 CRITICAL COMPLAINT: ${created.ticketNumber}`,
              message: `High risk complaint "${created.title}" reported at ${building.name}. Immediate safety assessment required.`,
              type: 'CRITICAL_ALERT',
            },
          });
        }
      }

      return created;
    });

    res.status(201).json({
      message: 'Complaint submitted successfully',
      complaint: {
        ...complaint,
        images: JSON.parse(complaint.images),
        priorityEvaluation: priorityResult,
      },
    });
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(500).json({ error: 'Failed to submit complaint' });
  }
});

// 5. Update Status with Lifecycle RBAC Rules
router.patch('/:id/status', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const parseResult = statusUpdateSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const {
      status: targetStatus,
      notes,
      rejectionReason,
      holdReason,
      expectedRestartDate,
      reopenReason,
      resolutionNotes,
      resolutionImages,
    } = parseResult.data;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        submittedBy: true,
        assignedTo: true,
      },
    });

    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    const currentStatus = complaint.status as ComplaintStatus;

    // RBAC and lifecycle transition validation
    if (user.role === 'STUDENT' || user.role === 'FACULTY') {
      if (complaint.submittedById !== user.id) {
        res.status(403).json({ error: 'You can only update your own complaints' });
        return;
      }

      // Students/Faculty can only close a resolved ticket or reopen it
      if (targetStatus === 'CLOSED') {
        if (currentStatus !== 'RESOLVED') {
          res.status(400).json({ error: 'Only resolved complaints can be closed by the requester' });
          return;
        }
      } else if (targetStatus === 'REOPENED') {
        if (currentStatus !== 'RESOLVED' && currentStatus !== 'CLOSED') {
          res.status(400).json({ error: 'Only resolved or closed complaints can be reopened' });
          return;
        }
        if (!reopenReason || reopenReason.trim().length < 5) {
          res.status(400).json({ error: 'A valid reason (min 5 characters) is mandatory to reopen a complaint' });
          return;
        }
      } else {
        res.status(403).json({
          error: `As a ${user.role}, you cannot transition complaint directly to "${targetStatus}".`,
        });
        return;
      }
    } else if (user.role === 'MAINTENANCE') {
      // Technicians can accept (IN_PROGRESS), put ON_HOLD, or mark RESOLVED
      if (complaint.assignedToId !== user.id && user.role !== 'ADMIN') {
        res.status(403).json({ error: 'You are not assigned to this complaint' });
        return;
      }

      const allowedTechnicianTransitions = ['IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'UNDER_REVIEW'];
      if (!allowedTechnicianTransitions.includes(targetStatus)) {
        res.status(403).json({
          error: `Technicians cannot transition complaint to "${targetStatus}".`,
        });
        return;
      }

      if (targetStatus === 'ON_HOLD') {
        if (!holdReason || holdReason.trim().length < 5) {
          res.status(400).json({ error: 'A specific reason is required to place work on hold' });
          return;
        }
      }

      if (targetStatus === 'RESOLVED') {
        if (!resolutionNotes || resolutionNotes.trim().length < 5) {
          res.status(400).json({ error: 'Resolution details and notes are required to resolve the issue' });
          return;
        }
      }
    } else if (user.role === 'ADMIN') {
      // Admins have supervisory transition rights
      if (targetStatus === 'REJECTED') {
        if (!rejectionReason || rejectionReason.trim().length < 5) {
          res.status(400).json({ error: 'A clear rejection reason (min 5 chars) is mandatory' });
          return;
        }
      }
    }

    // Execute state transition
    const updateData: any = {
      status: targetStatus,
    };

    let activityComment = notes || `Status changed from ${currentStatus} to ${targetStatus}`;

    if (targetStatus === 'RESOLVED') {
      updateData.resolvedAt = new Date();
      if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
      if (resolutionImages && resolutionImages.length > 0) {
        updateData.resolutionImages = JSON.stringify(resolutionImages);
      }
      activityComment = resolutionNotes ? `Resolved: ${resolutionNotes}` : activityComment;
    } else if (targetStatus === 'CLOSED') {
      updateData.closedAt = new Date();
      activityComment = notes ? `Closed by user: ${notes}` : 'Issue verified and closed by requester.';
    } else if (targetStatus === 'REJECTED') {
      updateData.rejectionReason = rejectionReason;
      activityComment = `Rejected: ${rejectionReason}`;
    } else if (targetStatus === 'ON_HOLD') {
      updateData.holdReason = holdReason;
      if (expectedRestartDate) updateData.expectedRestartDate = new Date(expectedRestartDate);
      activityComment = `Placed On Hold: ${holdReason}${expectedRestartDate ? ` (Expected restart: ${expectedRestartDate})` : ''}`;
    } else if (targetStatus === 'REOPENED') {
      updateData.reopenReason = reopenReason;
      activityComment = `Reopened by requester: ${reopenReason}`;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.complaint.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          building: true,
          submittedBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.complaintActivity.create({
        data: {
          complaintId: id,
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          previousStatus: currentStatus,
          newStatus: targetStatus,
          action: 'STATUS_CHANGE',
          comments: activityComment,
        },
      });

      // Send notifications
      // 1. Notify Requester if changed by Admin or Maintenance
      if (user.id !== complaint.submittedById) {
        await tx.notification.create({
          data: {
            userId: complaint.submittedById,
            complaintId: id,
            title: `Complaint Status: ${targetStatus}`,
            message: `Your complaint "${complaint.title}" has been moved to ${targetStatus}. ${activityComment}`,
            type: 'STATUS_CHANGE',
          },
        });
      }

      // 2. Notify Assigned Technician if changed by Admin or Requester
      if (complaint.assignedToId && user.id !== complaint.assignedToId) {
        await tx.notification.create({
          data: {
            userId: complaint.assignedToId,
            complaintId: id,
            title: `Task Status Update: ${targetStatus}`,
            message: `Complaint "${complaint.title}" assigned to you has been updated to ${targetStatus}.`,
            type: 'STATUS_CHANGE',
          },
        });
      }

      return result;
    });

    res.json({
      message: `Status updated to ${targetStatus}`,
      complaint: {
        ...updated,
        images: JSON.parse(updated.images || '[]'),
        resolutionImages: JSON.parse(updated.resolutionImages || '[]'),
      },
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update complaint status' });
  }
});

// 6. Assign Maintenance Technician (Admin Only)
router.patch('/:id/assign', authenticate, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { assignedToId, notes } = req.body;
    const user = req.user!;

    if (!assignedToId) {
      res.status(400).json({ error: 'Assigned maintenance technician ID is required' });
      return;
    }

    const technician = await prisma.user.findFirst({
      where: { id: assignedToId, role: 'MAINTENANCE', isActive: true },
    });

    if (!technician) {
      res.status(400).json({ error: 'Selected technician is invalid or inactive' });
      return;
    }

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    const newStatus = complaint.status === 'SUBMITTED' || complaint.status === 'UNDER_REVIEW' ? 'ASSIGNED' : complaint.status;

    const updated = await prisma.$transaction(async (tx) => {
      const resComplaint = await tx.complaint.update({
        where: { id },
        data: {
          assignedToId: technician.id,
          status: newStatus,
        },
        include: {
          assignedTo: { select: { id: true, name: true, email: true, department: true } },
        },
      });

      await tx.complaintActivity.create({
        data: {
          complaintId: id,
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          previousStatus: complaint.status,
          newStatus,
          action: 'ASSIGNED',
          comments: `Assigned to ${technician.name} (${technician.department || 'Maintenance'}). ${notes || ''}`,
        },
      });

      // Notify technician
      await tx.notification.create({
        data: {
          userId: technician.id,
          complaintId: id,
          title: `🛠️ New Task Assignment: ${complaint.ticketNumber}`,
          message: `You have been assigned to complaint "${complaint.title}". Priority: ${complaint.priority}.`,
          type: 'ASSIGNMENT',
        },
      });

      // Notify requester
      await tx.notification.create({
        data: {
          userId: complaint.submittedById,
          complaintId: id,
          title: `Maintenance Assigned: ${complaint.ticketNumber}`,
          message: `Technician ${technician.name} has been assigned to work on your complaint.`,
          type: 'ASSIGNMENT',
        },
      });

      return resComplaint;
    });

    res.json({ message: 'Complaint assigned successfully', complaint: updated });
  } catch (error) {
    console.error('Error assigning technician:', error);
    res.status(500).json({ error: 'Failed to assign technician' });
  }
});

// 7. Update Priority (Admin Only)
router.patch('/:id/priority', authenticate, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { priority, reason } = req.body;
    const user = req.user!;

    if (!['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
      res.status(400).json({ error: 'Invalid priority level' });
      return;
    }

    if (!reason || reason.trim().length < 5) {
      res.status(400).json({ error: 'A justification reason (min 5 characters) is required to override priority' });
      return;
    }

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    // Recalculate SLA based on new priority
    const slaHoursMap: Record<string, number> = { CRITICAL: 4, HIGH: 24, MEDIUM: 72, LOW: 168 };
    const newDeadline = new Date(complaint.createdAt.getTime() + (slaHoursMap[priority] || 48) * 3600 * 1000);

    const updated = await prisma.$transaction(async (tx) => {
      const resComplaint = await tx.complaint.update({
        where: { id },
        data: {
          priority,
          slaDeadline: newDeadline,
          isOverdue: new Date() > newDeadline,
        },
      });

      await tx.complaintActivity.create({
        data: {
          complaintId: id,
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          previousStatus: complaint.status,
          newStatus: complaint.status,
          action: 'PRIORITY_UPDATE',
          comments: `Priority manually modified from ${complaint.priority} to ${priority}. Reason: ${reason}`,
        },
      });

      return resComplaint;
    });

    res.json({ message: 'Priority updated successfully', complaint: updated });
  } catch (error) {
    console.error('Error modifying priority:', error);
    res.status(500).json({ error: 'Failed to update priority' });
  }
});

// 8. Add Comment / Work Note to Complaint
router.post('/:id/comments', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const user = req.user!;

    if (!comment || comment.trim().length < 2) {
      res.status(400).json({ error: 'Comment must be at least 2 characters long' });
      return;
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: { submittedBy: true, assignedTo: true },
    });

    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    const newComment = await prisma.$transaction(async (tx) => {
      const createdComment = await tx.complaintComment.create({
        data: {
          complaintId: id,
          userId: user.id,
          comment: comment.trim(),
        },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      await tx.complaintActivity.create({
        data: {
          complaintId: id,
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          previousStatus: complaint.status,
          newStatus: complaint.status,
          action: user.role === 'MAINTENANCE' ? 'WORK_NOTE' : 'COMMENT',
          comments: `${user.role === 'MAINTENANCE' ? 'Work note added' : 'Comment posted'}: "${comment.trim()}"`,
        },
      });

      // Notify party if not author
      if (user.id !== complaint.submittedById) {
        await tx.notification.create({
          data: {
            userId: complaint.submittedById,
            complaintId: id,
            title: `New Note on ${complaint.ticketNumber}`,
            message: `${user.name} (${user.role}) added a note: "${comment.trim().slice(0, 80)}"`,
            type: 'COMMENT',
          },
        });
      }

      if (complaint.assignedToId && user.id !== complaint.assignedToId) {
        await tx.notification.create({
          data: {
            userId: complaint.assignedToId,
            complaintId: id,
            title: `New Message on ${complaint.ticketNumber}`,
            message: `${user.name} (${user.role}) commented: "${comment.trim().slice(0, 80)}"`,
            type: 'COMMENT',
          },
        });
      }

      return createdComment;
    });

    res.status(201).json({ message: 'Comment posted successfully', comment: newComment });
  } catch (error) {
    console.error('Error posting comment:', error);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

export default router;
