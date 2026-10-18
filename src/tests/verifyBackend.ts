import { calculatePriority } from '../services/priorityEngine';
import prisma from '../prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fix-my-campus-super-secret-jwt-key-2026';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
  }
}

async function runTests() {
  console.log('🧪 Starting Fix My Campus Backend Test Suite...\n');

  // Test Suite 1: Smart Priority Engine Rules
  console.log('--- Test Suite 1: Smart Priority Engine Evaluation ---');
  
  // Rule 1: Immediate Danger triggers CRITICAL (4h)
  const dangerRes = calculatePriority({
    safetyRisk: 'IMMEDIATE_DANGER',
    severity: 'MINOR',
    affectedCount: 'INDIVIDUAL',
    isLocationCritical: false,
  });
  assert(dangerRes.priority === 'CRITICAL' && dangerRes.slaHours === 4, 'Immediate Danger forces CRITICAL priority with 4-hour SLA');

  // Rule 2: High severity + Campus wide triggers CRITICAL
  const campusWideRes = calculatePriority({
    safetyRisk: 'NONE',
    severity: 'CATASTROPHIC',
    affectedCount: 'CAMPUS_WIDE',
    isLocationCritical: true,
  });
  assert(campusWideRes.priority === 'CRITICAL' && campusWideRes.score >= 75, 'Catastrophic + Campus Wide evaluates to CRITICAL');

  // Rule 3: Major severity + Building wide triggers HIGH (24h)
  const highRes = calculatePriority({
    safetyRisk: 'HAZARD',
    severity: 'MAJOR',
    affectedCount: 'INDIVIDUAL',
    isLocationCritical: false,
  });
  assert(highRes.priority === 'HIGH' && highRes.slaHours === 24, 'Hazard + Major evaluates to HIGH priority with 24-hour SLA');

  // Rule 4: Moderate severity triggers MEDIUM (72h)
  const medRes = calculatePriority({
    safetyRisk: 'NONE',
    severity: 'MODERATE',
    affectedCount: 'GROUP',
    isLocationCritical: false,
  });
  assert(medRes.priority === 'MEDIUM' && medRes.slaHours === 72, 'Moderate issue evaluates to MEDIUM priority with 72-hour SLA');

  // Rule 5: Minor severity triggers LOW (168h)
  const lowRes = calculatePriority({
    safetyRisk: 'NONE',
    severity: 'MINOR',
    affectedCount: 'INDIVIDUAL',
    isLocationCritical: false,
  });
  assert(lowRes.priority === 'LOW' && lowRes.slaHours === 168, 'Minor issue evaluates to LOW priority with 7-day SLA');

  // Test Suite 2: Database Models & Relationships
  console.log('\n--- Test Suite 2: Database Schema & Entity Relationships ---');
  const userCount = await prisma.user.count();
  assert(userCount >= 4, `Database has seeded users (Found: ${userCount})`);

  const buildingCount = await prisma.building.count();
  assert(buildingCount >= 8, `Campus buildings seeded (Found: ${buildingCount})`);

  const categoryCount = await prisma.category.count();
  assert(categoryCount >= 9, `Complaint categories configured (Found: ${categoryCount})`);

  const complaintCount = await prisma.complaint.count();
  assert(complaintCount >= 5, `Realistic complaints seeded across lifecycle (Found: ${complaintCount})`);

  // Test Suite 3: Authentication & Password Security
  console.log('\n--- Test Suite 3: Auth Security & Password Hashing ---');
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@campus.edu' } });
  assert(adminUser !== null, 'Admin user account exists');
  if (adminUser) {
    const isPasswordValid = await bcrypt.compare('Admin@123', adminUser.password);
    assert(isPasswordValid, 'Admin password bcrypt hashing validated');

    // JWT Generation & Verification
    const token = jwt.sign(
      { id: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const decoded: any = jwt.verify(token, JWT_SECRET);
    assert(decoded.role === 'ADMIN' && decoded.email === adminUser.email, 'JWT payload verification succeeded');
  }

  // Test Suite 4: Lifecycle State Transitions
  console.log('\n--- Test Suite 4: Complaint Lifecycle & Audit Logs ---');
  const testCategory = await prisma.category.findFirst();
  const testBuilding = await prisma.building.findFirst();
  const student = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
  const technician = await prisma.user.findFirst({ where: { role: 'MAINTENANCE' } });

  if (testCategory && testBuilding && student && technician) {
    const priorityCalc = calculatePriority({
      safetyRisk: 'HAZARD',
      severity: 'MAJOR',
      affectedCount: 'GROUP',
      isLocationCritical: testBuilding.isCritical,
    });

    // 1. Submit
    const testComplaint = await prisma.complaint.create({
      data: {
        ticketNumber: `FMC-TEST-${Date.now()}`,
        title: 'Automated Test: Pipe Leakage in Science Wing',
        description: 'Water leaking steadily from overhead valve onto laboratory benches.',
        locationDetails: 'Test Room 101',
        status: 'SUBMITTED',
        priority: priorityCalc.priority,
        calculatedScore: priorityCalc.score,
        safetyRisk: 'HAZARD',
        severity: 'MAJOR',
        affectedCount: 'GROUP',
        slaDeadline: priorityCalc.slaDeadline,
        submittedById: student.id,
        buildingId: testBuilding.id,
        categoryId: testCategory.id,
      },
    });
    assert(testComplaint.status === 'SUBMITTED', 'Complaint initialized with SUBMITTED status');

    // 2. Assign
    const assigned = await prisma.complaint.update({
      where: { id: testComplaint.id },
      data: { assignedToId: technician.id, status: 'ASSIGNED' },
    });
    assert(assigned.status === 'ASSIGNED' && assigned.assignedToId === technician.id, 'Assigned technician and updated status to ASSIGNED');

    // 3. In Progress
    const inProg = await prisma.complaint.update({
      where: { id: testComplaint.id },
      data: { status: 'IN_PROGRESS' },
    });
    assert(inProg.status === 'IN_PROGRESS', 'Technician accepted and status changed to IN_PROGRESS');

    // 4. Resolve
    const resolved = await prisma.complaint.update({
      where: { id: testComplaint.id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolutionNotes: 'Replaced compression washer and tested water flow under pressure.',
      },
    });
    assert(resolved.status === 'RESOLVED' && resolved.resolutionNotes !== null, 'Technician marked task as RESOLVED with resolution notes');

    // 5. Close
    const closed = await prisma.complaint.update({
      where: { id: testComplaint.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    assert(closed.status === 'CLOSED' && closed.closedAt !== null, 'Requester verified and closed complaint');

    // Clean up test complaint
    await prisma.complaint.delete({ where: { id: testComplaint.id } });
  }

  console.log(`\n========================================`);
  console.log(`Summary: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log(`========================================\n`);

  if (passedTests === totalTests) {
    console.log('🎉 All Fix My Campus backend tests passed successfully!');
    process.exit(0);
  } else {
    console.error('⚠️ Some tests failed.');
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error('Fatal error during test run:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
