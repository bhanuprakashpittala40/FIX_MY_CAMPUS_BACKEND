import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Fix My Campus database seeding...');

  // 1. Clean existing records
  await prisma.notification.deleteMany();
  await prisma.complaintComment.deleteMany();
  await prisma.complaintActivity.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.category.deleteMany();
  await prisma.building.deleteMany();
  await prisma.priorityRuleConfig.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing database entries.');

  // 2. Create Users
  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  const maintPassword = await bcrypt.hash('Maint@123', 10);
  const studentPassword = await bcrypt.hash('Student@123', 10);
  const facultyPassword = await bcrypt.hash('Faculty@123', 10);

  const adminUser = await prisma.user.create({
    data: {
      name: 'Dean Sarah Jenkins',
      email: 'admin@campus.edu',
      password: hashedPassword,
      role: 'ADMIN',
      department: 'Facilities & Campus Operations',
      phone: '+1 (555) 019-1001',
    },
  });

  const maintElectric = await prisma.user.create({
    data: {
      name: 'Marcus Vance',
      email: 'maintenance@campus.edu',
      password: maintPassword,
      role: 'MAINTENANCE',
      department: 'Electrical Maintenance',
      phone: '+1 (555) 019-2002',
    },
  });

  const maintPlumbing = await prisma.user.create({
    data: {
      name: 'Elena Rostova',
      email: 'plumbing@campus.edu',
      password: maintPassword,
      role: 'MAINTENANCE',
      department: 'Plumbing & Hydraulic Systems',
      phone: '+1 (555) 019-3003',
    },
  });

  const maintIT = await prisma.user.create({
    data: {
      name: 'Devon Chen',
      email: 'tech@campus.edu',
      password: maintPassword,
      role: 'MAINTENANCE',
      department: 'IT & Network Systems',
      phone: '+1 (555) 019-4004',
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      name: 'Alex Rivera',
      email: 'student@campus.edu',
      password: studentPassword,
      role: 'STUDENT',
      department: 'Computer Science & Engineering',
      phone: '+1 (555) 014-5005',
    },
  });

  const facultyUser = await prisma.user.create({
    data: {
      name: 'Dr. Patricia Gomez',
      email: 'faculty@campus.edu',
      password: facultyPassword,
      role: 'FACULTY',
      department: 'School of Engineering & Architecture',
      phone: '+1 (555) 017-6006',
    },
  });

  console.log('👤 Created Users (Admin, Maintenance, Student, Faculty)');

  // 3. Create Buildings
  const buildings = await Promise.all([
    prisma.building.create({
      data: {
        name: 'Science & Technology Complex',
        code: 'STC',
        zone: 'North Campus',
        floors: 5,
        isCritical: true,
      },
    }),
    prisma.building.create({
      data: {
        name: 'Main Academic Block',
        code: 'MAB',
        zone: 'Central Campus',
        floors: 4,
        isCritical: false,
      },
    }),
    prisma.building.create({
      data: {
        name: 'Central University Library',
        code: 'LIB',
        zone: 'Central Campus',
        floors: 3,
        isCritical: true,
      },
    }),
    prisma.building.create({
      data: {
        name: 'Student Hostel Block A (Men)',
        code: 'HA',
        zone: 'South Campus',
        floors: 6,
        isCritical: false,
      },
    }),
    prisma.building.create({
      data: {
        name: 'Student Hostel Block B (Women)',
        code: 'HB',
        zone: 'South Campus',
        floors: 6,
        isCritical: false,
      },
    }),
    prisma.building.create({
      data: {
        name: 'Campus Sports & Recreation Complex',
        code: 'CSC',
        zone: 'East Campus',
        floors: 2,
        isCritical: false,
      },
    }),
    prisma.building.create({
      data: {
        name: 'Central Dining Hall & Cafeteria',
        code: 'CDH',
        zone: 'Central Campus',
        floors: 2,
        isCritical: true,
      },
    }),
    prisma.building.create({
      data: {
        name: 'Administration Building',
        code: 'ADM',
        zone: 'West Campus',
        floors: 3,
        isCritical: false,
      },
    }),
  ]);

  console.log(`🏢 Created ${buildings.length} Campus Buildings.`);

  // 4. Create Categories
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Electrical Issues',
        slug: 'electrical-issues',
        description: 'Power outages, short circuits, broken switches, hazardous wiring, lights',
        icon: 'Zap',
        slaHours: 12,
        displayOrder: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Plumbing and Water Supply',
        slug: 'plumbing-water-supply',
        description: 'Water leaks, pipe blockages, drinking water stations, restroom fixtures',
        icon: 'Droplets',
        slaHours: 24,
        displayOrder: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Classroom and Laboratory Maintenance',
        slug: 'classroom-lab-maintenance',
        description: 'Projectors, lab benches, audio equipment, fume hoods, whiteboards',
        icon: 'GraduationCap',
        slaHours: 36,
        displayOrder: 3,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Wi-Fi and Internet',
        slug: 'wifi-internet',
        description: 'Campus Wi-Fi connectivity, Ethernet ports, DNS issues, slow bandwidth',
        icon: 'Wifi',
        slaHours: 12,
        displayOrder: 4,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Cleaning and Sanitation',
        slug: 'cleaning-sanitation',
        description: 'Trash disposal, restroom sanitation, spill clean-up, pest control',
        icon: 'Sparkles',
        slaHours: 18,
        displayOrder: 5,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Furniture and Infrastructure',
        slug: 'furniture-infrastructure',
        description: 'Broken desks, chairs, windows, doors, stair handrails, ceiling panels',
        icon: 'Armchair',
        slaHours: 72,
        displayOrder: 6,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Hostel Maintenance',
        slug: 'hostel-maintenance',
        description: 'Dorm room fittings, laundry room appliances, geysers, hostel common rooms',
        icon: 'Home',
        slaHours: 24,
        displayOrder: 7,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Security and Safety',
        slug: 'security-safety',
        description: 'Broken locks, emergency doors, CCTV cameras, fire extinguishers, alarms',
        icon: 'ShieldAlert',
        slaHours: 6,
        displayOrder: 8,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Other Issues',
        slug: 'other-issues',
        description: 'General campus facility inquiries and miscellaneous maintenance requests',
        icon: 'HelpCircle',
        slaHours: 48,
        displayOrder: 9,
      },
    }),
  ]);

  console.log(`🗂️ Created ${categories.length} Complaint Categories.`);

  // 5. Create Priority Rules Configuration
  await prisma.priorityRuleConfig.create({
    data: {
      key: 'smart_priority_rules',
      value: JSON.stringify({
        safetyWeights: { IMMEDIATE_DANGER: 45, HAZARD: 25, NONE: 0 },
        severityWeights: { CATASTROPHIC: 35, MAJOR: 25, MODERATE: 15, MINOR: 5 },
        affectedWeights: { CAMPUS_WIDE: 25, BUILDING_WIDE: 18, GROUP: 10, INDIVIDUAL: 2 },
        locationCriticalBonus: 15,
        thresholds: { CRITICAL: 75, HIGH: 45, MEDIUM: 22 },
        slaHours: { CRITICAL: 4, HIGH: 24, MEDIUM: 72, LOW: 168 },
      }),
    },
  });

  // Helper map
  const catMap = Object.fromEntries(categories.map((c) => [c.slug, c.id]));
  const bldgMap = Object.fromEntries(buildings.map((b) => [b.code, b.id]));

  const now = new Date();

  // 6. Create Realistic Sample Complaints
  // Complaint 1: Critical Live Wire (In Progress)
  const c1 = await prisma.complaint.create({
    data: {
      ticketNumber: 'FMC-202610-0001-8392',
      title: 'Live Exposed Wiring near Chemistry Lab Wash Area',
      description:
        'A high voltage electrical conduit casing has cracked open directly above the washbasin in Chem Lab 204. Sparks observed when the faucet is turned on. Extreme electric shock hazard for lab students.',
      locationDetails: 'Room 204, 2nd Floor, Chemistry Wing',
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
      calculatedScore: 95,
      safetyRisk: 'IMMEDIATE_DANGER',
      severity: 'CATASTROPHIC',
      affectedCount: 'GROUP',
      locationImpact: true,
      slaDeadline: new Date(now.getTime() + 2 * 3600 * 1000), // 2 hours from now
      isOverdue: false,
      images: JSON.stringify(['https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=800&auto=format&fit=crop']),
      submittedById: studentUser.id,
      assignedToId: maintElectric.id,
      buildingId: bldgMap['STC'],
      categoryId: catMap['electrical-issues'],
      createdAt: new Date(now.getTime() - 2 * 3600 * 1000),
    },
  });

  await prisma.complaintActivity.createMany({
    data: [
      {
        complaintId: c1.id,
        actorId: studentUser.id,
        actorName: studentUser.name,
        actorRole: studentUser.role,
        previousStatus: null,
        newStatus: 'SUBMITTED',
        action: 'CREATED',
        comments: 'Complaint logged. High safety risk identified: immediate electrical hazard.',
        createdAt: new Date(now.getTime() - 2 * 3600 * 1000),
      },
      {
        complaintId: c1.id,
        actorId: adminUser.id,
        actorName: adminUser.name,
        actorRole: adminUser.role,
        previousStatus: 'SUBMITTED',
        newStatus: 'ASSIGNED',
        action: 'ASSIGNED',
        comments: 'Assigned urgently to Marcus Vance (Electrical). Lab has been temporarily cordoned off.',
        createdAt: new Date(now.getTime() - 90 * 60 * 1000),
      },
      {
        complaintId: c1.id,
        actorId: maintElectric.id,
        actorName: maintElectric.name,
        actorRole: maintElectric.role,
        previousStatus: 'ASSIGNED',
        newStatus: 'IN_PROGRESS',
        action: 'ACCEPTED',
        comments: 'Power breaker for Chem Lab isolated. Bringing insulated conduit replacement and tester.',
        createdAt: new Date(now.getTime() - 60 * 60 * 1000),
      },
    ],
  });

  await prisma.complaintComment.create({
    data: {
      complaintId: c1.id,
      userId: maintElectric.id,
      comment: 'Breaker panel #4 circuit disconnected. Technicians on site replacing wiring conduit now.',
      createdAt: new Date(now.getTime() - 45 * 60 * 1000),
    },
  });

  // Complaint 2: Main Water Pipe Burst (Assigned)
  const c2 = await prisma.complaint.create({
    data: {
      ticketNumber: 'FMC-202610-0002-4912',
      title: 'Main Water Line Rupture Flooding Academic Corridor',
      description:
        'A pressurized junction pipe under the water cooler in the east corridor has ruptured. Water is seeping into classrooms 102 and 103, posing slip hazard and property damage.',
      locationDetails: '1st Floor East Hallway, outside Room 102',
      status: 'ASSIGNED',
      priority: 'HIGH',
      calculatedScore: 68,
      safetyRisk: 'HAZARD',
      severity: 'MAJOR',
      affectedCount: 'BUILDING_WIDE',
      locationImpact: false,
      slaDeadline: new Date(now.getTime() + 18 * 3600 * 1000),
      isOverdue: false,
      images: JSON.stringify(['https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop']),
      submittedById: facultyUser.id,
      assignedToId: maintPlumbing.id,
      buildingId: bldgMap['MAB'],
      categoryId: catMap['plumbing-water-supply'],
      createdAt: new Date(now.getTime() - 6 * 3600 * 1000),
    },
  });

  await prisma.complaintActivity.create({
    data: {
      complaintId: c2.id,
      actorId: adminUser.id,
      actorName: adminUser.name,
      actorRole: adminUser.role,
      previousStatus: 'SUBMITTED',
      newStatus: 'ASSIGNED',
      action: 'ASSIGNED',
      comments: 'Assigned to Elena Rostova. Janitorial dispatched for water extraction.',
      createdAt: new Date(now.getTime() - 4 * 3600 * 1000),
    },
  });

  // Complaint 3: Resolved Projector in Auditorium (Resolved)
  const c3 = await prisma.complaint.create({
    data: {
      ticketNumber: 'FMC-202610-0003-1284',
      title: 'Auditorium Ceiling Projector HDMI Input Dead',
      description:
        'Auditorium B projector displays "No Signal" on all inputs. Key guest lecture scheduled for Friday afternoon.',
      locationDetails: 'Auditorium B, Science Complex Ground Floor',
      status: 'RESOLVED',
      priority: 'MEDIUM',
      calculatedScore: 32,
      safetyRisk: 'NONE',
      severity: 'MODERATE',
      affectedCount: 'GROUP',
      locationImpact: true,
      slaDeadline: new Date(now.getTime() - 5 * 3600 * 1000),
      resolvedAt: new Date(now.getTime() - 6 * 3600 * 1000),
      isOverdue: false,
      images: JSON.stringify(['https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop']),
      resolutionNotes:
        'Replaced faulty wall-plate HDMI transceiver and fiber patch cable. Verified 4K 60Hz display output with test laptop.',
      resolutionImages: JSON.stringify(['https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop']),
      submittedById: facultyUser.id,
      assignedToId: maintIT.id,
      buildingId: bldgMap['STC'],
      categoryId: catMap['classroom-lab-maintenance'],
      createdAt: new Date(now.getTime() - 28 * 3600 * 1000),
    },
  });

  await prisma.complaintActivity.createMany({
    data: [
      {
        complaintId: c3.id,
        actorId: maintIT.id,
        actorName: maintIT.name,
        actorRole: maintIT.role,
        previousStatus: 'IN_PROGRESS',
        newStatus: 'RESOLVED',
        action: 'RESOLVED',
        comments: 'Completed audio-video patch cable and repeater replacement. Fully operational.',
        createdAt: new Date(now.getTime() - 6 * 3600 * 1000),
      },
    ],
  });

  // Complaint 4: Reopened Wi-Fi Issue (Reopened)
  const c4 = await prisma.complaint.create({
    data: {
      ticketNumber: 'FMC-202610-0004-9401',
      title: 'Severe Wi-Fi Signal Loss in Central Library 2nd Floor',
      description:
        'Access point AP-LIB-203 keeps resetting every 5 minutes. 40+ students studying for midterm exams cannot access research portals.',
      locationDetails: 'Central Library, 2nd Floor Quiet Study Zone',
      status: 'REOPENED',
      priority: 'HIGH',
      calculatedScore: 55,
      safetyRisk: 'NONE',
      severity: 'MAJOR',
      affectedCount: 'BUILDING_WIDE',
      locationImpact: true,
      slaDeadline: new Date(now.getTime() + 10 * 3600 * 1000),
      reopenReason: 'Access point rebooted but failed again after 30 minutes of high traffic.',
      isOverdue: false,
      images: JSON.stringify(['https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop']),
      submittedById: studentUser.id,
      assignedToId: maintIT.id,
      buildingId: bldgMap['LIB'],
      categoryId: catMap['wifi-internet'],
      createdAt: new Date(now.getTime() - 20 * 3600 * 1000),
    },
  });

  await prisma.complaintActivity.create({
    data: {
      complaintId: c4.id,
      actorId: studentUser.id,
      actorName: studentUser.name,
      actorRole: studentUser.role,
      previousStatus: 'RESOLVED',
      newStatus: 'REOPENED',
      action: 'REOPENED',
      comments: 'Reopened by student: AP continues dropping under load during peak library hours.',
      createdAt: new Date(now.getTime() - 2 * 3600 * 1000),
    },
  });

  // Complaint 5: On Hold Elevator Sensor (On Hold)
  const c5 = await prisma.complaint.create({
    data: {
      ticketNumber: 'FMC-202610-0005-7714',
      title: 'Hostel A South Elevator Door Sensor Malfunction',
      description:
        'Door photocell sensor fails to detect passengers entering, causing door to close abruptly. Elevator locked on ground floor for safety.',
      locationDetails: 'Men\'s Hostel Block A, South Wing Elevator',
      status: 'ON_HOLD',
      priority: 'MEDIUM',
      calculatedScore: 38,
      safetyRisk: 'HAZARD',
      severity: 'MODERATE',
      affectedCount: 'BUILDING_WIDE',
      locationImpact: false,
      holdReason: 'Awaiting specialized infrared door sensor delivery from Otis certified vendor.',
      expectedRestartDate: new Date(now.getTime() + 72 * 3600 * 1000),
      slaDeadline: new Date(now.getTime() + 48 * 3600 * 1000),
      isOverdue: false,
      images: JSON.stringify(['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop']),
      submittedById: studentUser.id,
      assignedToId: maintElectric.id,
      buildingId: bldgMap['HA'],
      categoryId: catMap['hostel-maintenance'],
      createdAt: new Date(now.getTime() - 14 * 3600 * 1000),
    },
  });

  // Complaint 6: Overdue Fire Door Lock (Overdue)
  const c6 = await prisma.complaint.create({
    data: {
      ticketNumber: 'FMC-202610-0006-3829',
      title: 'Emergency Fire Exit Door Jammed in Sports Complex',
      description:
        'Panic bar latch on ground floor east exit is jammed completely shut. Violates campus fire safety compliance.',
      locationDetails: 'Gymnasium East Exit Door #3',
      status: 'ASSIGNED',
      priority: 'CRITICAL',
      calculatedScore: 82,
      safetyRisk: 'HAZARD',
      severity: 'MAJOR',
      affectedCount: 'BUILDING_WIDE',
      locationImpact: false,
      slaDeadline: new Date(now.getTime() - 10 * 3600 * 1000), // In the past!
      isOverdue: true,
      images: JSON.stringify(['https://images.unsplash.com/photo-1558002038-1055907df827?w=800&auto=format&fit=crop']),
      submittedById: facultyUser.id,
      assignedToId: maintElectric.id,
      buildingId: bldgMap['CSC'],
      categoryId: catMap['security-safety'],
      createdAt: new Date(now.getTime() - 36 * 3600 * 1000),
    },
  });

  // Complaint 7: Freshly Submitted Complaint
  const c7 = await prisma.complaint.create({
    data: {
      ticketNumber: 'FMC-202610-0007-5501',
      title: 'Cafeteria Water Dispenser Filter Warning Light Flashing',
      description:
        'Drinking water cooler on cafeteria 1st floor shows red filter replacement light and low pressure flow.',
      locationDetails: 'Dining Hall 1st Floor Food Court',
      status: 'SUBMITTED',
      priority: 'LOW',
      calculatedScore: 12,
      safetyRisk: 'NONE',
      severity: 'MINOR',
      affectedCount: 'GROUP',
      locationImpact: true,
      slaDeadline: new Date(now.getTime() + 120 * 3600 * 1000),
      isOverdue: false,
      images: JSON.stringify(['https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=800&auto=format&fit=crop']),
      submittedById: studentUser.id,
      buildingId: bldgMap['CDH'],
      categoryId: catMap['cleaning-sanitation'],
      createdAt: new Date(now.getTime() - 30 * 60 * 1000),
    },
  });

  // Complaint 8: Closed Complaint
  await prisma.complaint.create({
    data: {
      ticketNumber: 'FMC-202610-0008-6623',
      title: 'AC Condensation Leakage in Dean Conference Room',
      description: 'Water droplets forming on table from ceiling split AC vent.',
      locationDetails: 'Admin Building Room 301',
      status: 'CLOSED',
      priority: 'MEDIUM',
      calculatedScore: 28,
      safetyRisk: 'NONE',
      severity: 'MODERATE',
      affectedCount: 'INDIVIDUAL',
      locationImpact: false,
      slaDeadline: new Date(now.getTime() - 48 * 3600 * 1000),
      resolvedAt: new Date(now.getTime() - 52 * 3600 * 1000),
      closedAt: new Date(now.getTime() - 50 * 3600 * 1000),
      resolutionNotes: 'Cleared drain pump siphon blockage and sanitized filter trays.',
      submittedById: facultyUser.id,
      assignedToId: maintElectric.id,
      buildingId: bldgMap['ADM'],
      categoryId: catMap['electrical-issues'],
      createdAt: new Date(now.getTime() - 72 * 3600 * 1000),
    },
  });

  // 7. Seed Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: adminUser.id,
        complaintId: c1.id,
        title: '🚨 CRITICAL COMPLAINT: ' + c1.ticketNumber,
        message: 'High risk complaint "Live Exposed Wiring near Chemistry Lab" reported at Science & Technology Complex.',
        type: 'CRITICAL_ALERT',
        read: false,
        createdAt: new Date(now.getTime() - 110 * 60 * 1000),
      },
      {
        userId: maintElectric.id,
        complaintId: c1.id,
        title: '🛠️ Urgent Assignment: ' + c1.ticketNumber,
        message: 'You have been assigned to Critical task "Live Exposed Wiring". SLA: 4 hours.',
        type: 'ASSIGNMENT',
        read: false,
        createdAt: new Date(now.getTime() - 90 * 60 * 1000),
      },
      {
        userId: studentUser.id,
        complaintId: c3.id,
        title: '✅ Complaint Resolved: ' + c3.ticketNumber,
        message: 'Technician Devon Chen has repaired "Auditorium Projector HDMI". Please review and close.',
        type: 'RESOLVED',
        read: false,
        createdAt: new Date(now.getTime() - 5 * 3600 * 1000),
      },
      {
        userId: adminUser.id,
        complaintId: c6.id,
        title: '⚠️ Overdue Complaint: ' + c6.ticketNumber,
        message: 'Complaint "Emergency Fire Exit Door Jammed" has breached SLA deadline and requires immediate managerial review.',
        type: 'SLA_BREACH',
        read: false,
        createdAt: new Date(now.getTime() - 8 * 3600 * 1000),
      },
    ],
  });

  console.log('🔔 Created demo Notifications.');
  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
