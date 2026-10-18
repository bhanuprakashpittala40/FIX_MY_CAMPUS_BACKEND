export function getApiDocumentationHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fix My Campus – REST API Reference</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0284c7;
      --primary-dark: #0369a1;
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --badge-get: #10b981;
      --badge-post: #3b82f6;
      --badge-patch: #f59e0b;
      --badge-delete: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 40px 20px;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    header {
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }
    h1 { font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 8px; }
    h1 span { color: #38bdf8; }
    p.subtitle { color: var(--text-muted); font-size: 14px; }
    .badge-bar { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
    .status-pill {
      font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px;
      background: #0284c720; color: #38bdf8; border: 1px solid #0284c740;
    }
    .section-title {
      font-size: 18px; font-weight: 700; margin: 32px 0 16px;
      color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;
      display: flex; items-center; gap: 8px;
    }
    .endpoint-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px 24px;
      margin-bottom: 14px;
      transition: all 0.2s ease;
    }
    .endpoint-card:hover { border-color: #475569; transform: translateY(-1px); }
    .endpoint-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .endpoint-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .method-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px;
      text-transform: uppercase;
    }
    .method-get { background: #10b98120; color: #34d399; border: 1px solid #10b98140; }
    .method-post { background: #3b82f620; color: #60a5fa; border: 1px solid #3b82f640; }
    .method-patch { background: #f59e0b20; color: #fbbf24; border: 1px solid #f59e0b40; }
    .method-delete { background: #ef444420; color: #f87171; border: 1px solid #ef444440; }
    .endpoint-path {
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px; font-weight: 600; color: #fff;
    }
    .auth-tag {
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      background: #0f172a; padding: 2px 8px; border-radius: 4px; border: 1px solid #334155;
    }
    .endpoint-desc { font-size: 13px; color: var(--text-muted); margin-top: 8px; }
    .code-box {
      background: #0f172a; border: 1px solid #334155; border-radius: 8px;
      padding: 12px 16px; margin-top: 10px; font-family: 'JetBrains Mono', monospace;
      font-size: 12px; color: #cbd5e1; overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Fix My Campus <span>REST API Reference</span></h1>
      <p class="subtitle">Complete backend API documentation with authentication, smart priority calculation, and complaint workflows.</p>
      <div class="badge-bar">
        <span class="status-pill">Base URL: http://localhost:5000/api</span>
        <span class="status-pill">Express 4 + TypeScript</span>
        <span class="status-pill">Prisma ORM</span>
        <span class="status-pill">JWT Auth</span>
      </div>
    </header>

    <!-- Authentication Section -->
    <div class="section-title">1. Authentication (/api/auth)</div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-post">POST</span>
          <span class="endpoint-path">/api/auth/register</span>
        </div>
        <span class="auth-tag">Public</span>
      </div>
      <div class="endpoint-desc">Registers a new student or faculty account with hashed password and generates JWT token.</div>
      <div class="code-box">Body: { "name": "Alex Rivera", "email": "student@campus.edu", "password": "...", "role": "STUDENT", "department": "CS" }</div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-post">POST</span>
          <span class="endpoint-path">/api/auth/login</span>
        </div>
        <span class="auth-tag">Public</span>
      </div>
      <div class="endpoint-desc">Authenticates user credentials and returns JWT bearer token.</div>
      <div class="code-box">Body: { "email": "admin@campus.edu", "password": "..." }</div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-post">POST</span>
          <span class="endpoint-path">/api/auth/demo-login</span>
        </div>
        <span class="auth-tag">Public</span>
      </div>
      <div class="endpoint-desc">Instant 1-click role switcher for testing (STUDENT, FACULTY, MAINTENANCE, ADMIN).</div>
      <div class="code-box">Body: { "role": "ADMIN" }</div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-get">GET</span>
          <span class="endpoint-path">/api/auth/me</span>
        </div>
        <span class="auth-tag">Bearer JWT</span>
      </div>
      <div class="endpoint-desc">Retrieves authenticated profile and unread notification counter.</div>
    </div>

    <!-- Complaints Section -->
    <div class="section-title">2. Complaint Lifecycle (/api/complaints)</div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-get">GET</span>
          <span class="endpoint-path">/api/complaints</span>
        </div>
        <span class="auth-tag">Bearer JWT</span>
      </div>
      <div class="endpoint-desc">Query complaints with multi-parameter filtering (status, priority, category, building, search, overdue), sorting, and pagination.</div>
      <div class="code-box">Query Params: ?status=IN_PROGRESS&priority=HIGH&page=1&limit=10&isOverdue=true</div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-post">POST</span>
          <span class="endpoint-path">/api/complaints</span>
        </div>
        <span class="auth-tag">Bearer JWT</span>
      </div>
      <div class="endpoint-desc">Submits new complaint and evaluates priority through the Smart Priority Engine.</div>
      <div class="code-box">Body: { "title": "Water leak", "description": "...", "categoryId": "...", "buildingId": "...", "safetyRisk": "HAZARD", "severity": "MAJOR", "affectedCount": "BUILDING_WIDE" }</div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-get">GET</span>
          <span class="endpoint-path">/api/complaints/:id</span>
        </div>
        <span class="auth-tag">Bearer JWT</span>
      </div>
      <div class="endpoint-desc">Retrieves detailed complaint record with chronological audit log, comments, and stakeholder data.</div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-patch">PATCH</span>
          <span class="endpoint-path">/api/complaints/:id/status</span>
        </div>
        <span class="auth-tag">Bearer JWT (Role Checked)</span>
      </div>
      <div class="endpoint-desc">Enforces lifecycle state machine transitions with mandatory justification checks.</div>
      <div class="code-box">Body: { "status": "ON_HOLD", "holdReason": "Waiting for sensor delivery", "expectedRestartDate": "2026-10-25" }</div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-patch">PATCH</span>
          <span class="endpoint-path">/api/complaints/:id/assign</span>
        </div>
        <span class="auth-tag">Admin Only</span>
      </div>
      <div class="endpoint-desc">Assigns a complaint to a maintenance technician and transitions status to ASSIGNED.</div>
    </div>

    <!-- Maintenance Section -->
    <div class="section-title">3. Maintenance Operations (/api/maintenance)</div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-get">GET</span>
          <span class="endpoint-path">/api/maintenance/dashboard</span>
        </div>
        <span class="auth-tag">Maintenance / Admin</span>
      </div>
      <div class="endpoint-desc">Returns technician task metrics and urgent queue items.</div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-post">POST</span>
          <span class="endpoint-path">/api/maintenance/:id/accept</span>
        </div>
        <span class="auth-tag">Maintenance Assigned</span>
      </div>
      <div class="endpoint-desc">Accepts assignment and transitions status to IN_PROGRESS.</div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-post">POST</span>
          <span class="endpoint-path">/api/maintenance/:id/resolve</span>
        </div>
        <span class="auth-tag">Maintenance Assigned</span>
      </div>
      <div class="endpoint-desc">Completes task with mandatory resolution notes and optional after-repair photos.</div>
      <div class="code-box">Body: { "resolutionNotes": "Repaired loose junction and tested voltage.", "resolutionImages": ["/uploads/..."] }</div>
    </div>

    <!-- Admin Section -->
    <div class="section-title">4. Administration & Governance (/api/admin)</div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-get">GET</span>
          <span class="endpoint-path">/api/admin/metrics</span>
        </div>
        <span class="auth-tag">Admin Only</span>
      </div>
      <div class="endpoint-desc">Campus KPI metrics: Total, Pending, In Progress, Resolved, Overdue Breaches, SLA Compliance Rate.</div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-get">GET</span>
          <span class="endpoint-path">/api/admin/analytics</span>
        </div>
        <span class="auth-tag">Admin Only</span>
      </div>
      <div class="endpoint-desc">Visual datasets for Recharts: Category distribution, status breakdown, facility heatmap.</div>
    </div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-get">GET</span>
          <span class="endpoint-path">/api/admin/priority-rules</span>
        </div>
        <span class="auth-tag">Admin Only</span>
      </div>
      <div class="endpoint-desc">Retrieves configurable Smart Priority Engine scoring weights and SLA targets.</div>
    </div>

    <!-- Uploads -->
    <div class="section-title">5. File & Image Uploads (/api/upload)</div>

    <div class="endpoint-card">
      <div class="endpoint-header">
        <div class="endpoint-left">
          <span class="method-badge method-post">POST</span>
          <span class="endpoint-path">/api/upload/multiple</span>
        </div>
        <span class="auth-tag">Bearer JWT</span>
      </div>
      <div class="endpoint-desc">Uploads up to 5 images (JPEG, PNG, WebP) and stores them in /uploads.</div>
    </div>

  </div>
</body>
</html>`;
}
