import prisma from '../prisma/client';

export async function checkAndEscalateOverdueComplaints() {
  try {
    const now = new Date();

    // Find complaints that are not resolved or closed, and deadline has passed
    const overdueComplaints = await prisma.complaint.findMany({
      where: {
        status: {
          notIn: ['RESOLVED', 'CLOSED', 'REJECTED'],
        },
        slaDeadline: {
          lt: now,
        },
        isOverdue: false,
      },
      include: {
        submittedBy: true,
        assignedTo: true,
      },
    });

    for (const complaint of overdueComplaints) {
      await prisma.$transaction(async (tx) => {
        await tx.complaint.update({
          where: { id: complaint.id },
          data: { isOverdue: true },
        });

        await tx.complaintActivity.create({
          data: {
            complaintId: complaint.id,
            actorName: 'System SLA Monitor',
            actorRole: 'SYSTEM',
            action: 'SLA_BREACH',
            previousStatus: complaint.status,
            newStatus: complaint.status,
            comments: `SLA Deadline (${complaint.slaDeadline.toISOString()}) breached. Flagged as OVERDUE for administrative escalation.`,
          },
        });

        // Notify Admins
        const admins = await tx.user.findMany({
          where: { role: 'ADMIN', isActive: true },
        });

        for (const admin of admins) {
          await tx.notification.create({
            data: {
              userId: admin.id,
              complaintId: complaint.id,
              title: `⚠️ Overdue Complaint: ${complaint.ticketNumber}`,
              message: `Complaint "${complaint.title}" has breached its SLA deadline and requires immediate managerial review.`,
              type: 'SLA_BREACH',
            },
          });
        }

        // Notify assigned technician if any
        if (complaint.assignedToId) {
          await tx.notification.create({
            data: {
              userId: complaint.assignedToId,
              complaintId: complaint.id,
              title: `⚠️ Deadline Exceeded: ${complaint.ticketNumber}`,
              message: `Your assigned task "${complaint.title}" is now overdue. Please expedite resolution or provide an update.`,
              type: 'SLA_BREACH',
            },
          });
        }
      });
    }

    return overdueComplaints.length;
  } catch (error) {
    console.error('Error checking overdue complaints:', error);
    return 0;
  }
}
