import { Router, Response } from 'express';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRole(['MAINTENANCE', 'ADMIN']));

// 1. Maintenance Dashboard Overview
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    const [activeAssigned, inProgress, onHold, completed, overdue] = await Promise.all([
      prisma.complaint.count({
        where: {
          assignedToId: user.id,
          status: { in: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'REOPENED'] },
        },
      }),
      prisma.complaint.count({
        where: { assignedToId: user.id, status: 'IN_PROGRESS' },
      }),
      prisma.complaint.count({
        where: { assignedToId: user.id, status: 'ON_HOLD' },
      }),
      prisma.complaint.count({
        where: { assignedToId: user.id, status: { in: ['RESOLVED', 'CLOSED'] } },
      }),
      prisma.complaint.count({
        where: {
          assignedToId: user.id,
          isOverdue: true,
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
      }),
    ]);

    // Top urgent items
    const urgentTasks = await prisma.complaint.findMany({
      where: {
        assignedToId: user.id,
        status: { in: ['ASSIGNED', 'IN_PROGRESS', 'REOPENED', 'ON_HOLD'] },
      },
      orderBy: [{ priority: 'desc' }, { slaDeadline: 'asc' }],
      take: 5,
      include: {
        category: { select: { name: true, icon: true } },
        building: { select: { name: true, code: true } },
        submittedBy: { select: { name: true, phone: true } },
      },
    });

    res.json({
      metrics: {
        activeAssigned,
        inProgress,
        onHold,
        completed,
        overdue,
      },
      urgentTasks: urgentTasks.map((t) => ({
        ...t,
        images: JSON.parse(t.images || '[]'),
        resolutionImages: JSON.parse(t.resolutionImages || '[]'),
      })),
    });
  } catch (error) {
    console.error('Error fetching maintenance dashboard:', error);
    res.status(500).json({ error: 'Failed to retrieve maintenance dashboard metrics' });
  }
});

// 2. Accept Assignment
router.post('/:id/accept', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    if (complaint.assignedToId !== user.id && user.role !== 'ADMIN') {
      res.status(403).json({ error: 'This complaint is not assigned to you' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resComplaint = await tx.complaint.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
        include: {
          category: true,
          building: true,
          submittedBy: true,
        },
      });

      await tx.complaintActivity.create({
        data: {
          complaintId: id,
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          previousStatus: complaint.status,
          newStatus: 'IN_PROGRESS',
          action: 'ACCEPTED',
          comments: `Technician ${user.name} accepted the task and initiated resolution work.`,
        },
      });

      // Notify requester
      await tx.notification.create({
        data: {
          userId: complaint.submittedById,
          complaintId: id,
          title: `Work Commenced: ${complaint.ticketNumber}`,
          message: `Technician ${user.name} has started work on "${complaint.title}".`,
          type: 'STATUS_CHANGE',
        },
      });

      return resComplaint;
    });

    res.json({
      message: 'Assignment accepted, complaint marked In Progress',
      complaint: {
        ...updated,
        images: JSON.parse(updated.images || '[]'),
        resolutionImages: JSON.parse(updated.resolutionImages || '[]'),
      },
    });
  } catch (error) {
    console.error('Error accepting assignment:', error);
    res.status(500).json({ error: 'Failed to accept assignment' });
  }
});

// 3. Reject Assignment with Mandatory Reason
router.post('/:id/reject', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user!;

    if (!reason || reason.trim().length < 5) {
      res.status(400).json({ error: 'A mandatory explanation (min 5 characters) is required to reject an assignment' });
      return;
    }

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    if (complaint.assignedToId !== user.id && user.role !== 'ADMIN') {
      res.status(403).json({ error: 'This complaint is not assigned to you' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Unassign and set back to UNDER_REVIEW
      const resComplaint = await tx.complaint.update({
        where: { id },
        data: {
          assignedToId: null,
          status: 'UNDER_REVIEW',
        },
      });

      await tx.complaintActivity.create({
        data: {
          complaintId: id,
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          previousStatus: complaint.status,
          newStatus: 'UNDER_REVIEW',
          action: 'ASSIGNMENT_REJECTED',
          comments: `Assignment declined by ${user.name}. Reason: ${reason.trim()}`,
        },
      });

      // Notify Admins
      const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true } });
      for (const admin of admins) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            complaintId: id,
            title: `Assignment Declined: ${complaint.ticketNumber}`,
            message: `Technician ${user.name} declined "${complaint.title}". Reason: ${reason.trim()}. Needs reassignment.`,
            type: 'REASSIGNMENT_NEEDED',
          },
        });
      }

      return resComplaint;
    });

    res.json({ message: 'Assignment declined and returned for reassignment', complaint: updated });
  } catch (error) {
    console.error('Error rejecting assignment:', error);
    res.status(500).json({ error: 'Failed to decline assignment' });
  }
});

// 4. Mark Completed / Resolved with Resolution Notes & Before-and-After Images
router.post('/:id/resolve', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { resolutionNotes, resolutionImages } = req.body;
    const user = req.user!;

    if (!resolutionNotes || resolutionNotes.trim().length < 5) {
      res.status(400).json({ error: 'Detailed resolution notes (min 5 characters) are required to complete this job' });
      return;
    }

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    if (complaint.assignedToId !== user.id && user.role !== 'ADMIN') {
      res.status(403).json({ error: 'You are not assigned to this complaint' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resComplaint = await tx.complaint.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolutionNotes: resolutionNotes.trim(),
          resolutionImages: JSON.stringify(resolutionImages || []),
        },
        include: {
          category: true,
          building: true,
          submittedBy: true,
        },
      });

      await tx.complaintActivity.create({
        data: {
          complaintId: id,
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          previousStatus: complaint.status,
          newStatus: 'RESOLVED',
          action: 'RESOLVED',
          comments: `Work marked as completed by ${user.name}. Details: "${resolutionNotes.trim()}"`,
        },
      });

      // Notify Requester to inspect and close or reopen
      await tx.notification.create({
        data: {
          userId: complaint.submittedById,
          complaintId: id,
          title: `✅ Complaint Resolved: ${complaint.ticketNumber}`,
          message: `Technician ${user.name} has completed repairs on "${complaint.title}". Please verify and mark as closed or reopen if issue persists.`,
          type: 'RESOLVED',
        },
      });

      return resComplaint;
    });

    res.json({
      message: 'Complaint successfully marked as resolved',
      complaint: {
        ...updated,
        images: JSON.parse(updated.images || '[]'),
        resolutionImages: JSON.parse(updated.resolutionImages || '[]'),
      },
    });
  } catch (error) {
    console.error('Error resolving complaint:', error);
    res.status(500).json({ error: 'Failed to mark complaint as resolved' });
  }
});

// 5. Work History for Technician
router.get('/history', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const history = await prisma.complaint.findMany({
      where: {
        assignedToId: user.id,
        status: { in: ['RESOLVED', 'CLOSED'] },
      },
      orderBy: { resolvedAt: 'desc' },
      include: {
        category: true,
        building: true,
        submittedBy: { select: { name: true, email: true } },
      },
    });

    res.json({
      history: history.map((c) => ({
        ...c,
        images: JSON.parse(c.images || '[]'),
        resolutionImages: JSON.parse(c.resolutionImages || '[]'),
      })),
    });
  } catch (error) {
    console.error('Error fetching maintenance history:', error);
    res.status(500).json({ error: 'Failed to retrieve completed work history' });
  }
});

export default router;
