# Remix of EduSync Parent Hub v. 1.1

Build a complete, production-ready, multi-tenant SaaS application called EduSync Parent Hub. This is a real, functional, deployable product that schools can subscribe to and use immediately with real data, real authentication, real-time updates, and real WhatsApp integration pathways. It must not be a mock, demo, or simulation. Every core flow must work end-to-end with a proper backend, database, authentication, real-time subscriptions, role-based access control, and clean UI. Use a modern full-stack stack that Lovable can generate reliably (prefer React + TypeScript + Tailwind + shadcn/ui + Supabase for auth, database, real-time, storage, and edge functions; or equivalent production-capable stack). Include proper environment variable handling, row-level security, and clear deployment readiness.







1. Product Vision & Positioning



EduSync Parent Hub is a white-labelable, multi-tenant SaaS platform that gives schools a single source of truth for academic communication. Teachers update attendance, marks, behaviour notes, homework, and notices once. Parents (and optionally students) see everything in real time via a beautiful web portal and a WhatsApp-linked experience. The product dramatically reduces WhatsApp/phone/email volume from parents asking “What homework is due?”, “Did my child attend today?”, “What was the test score?”, or “Any behaviour notes?”. 







Core value proposition: One update by the teacher → instant visibility for all linked parents. Schools pay a monthly/annual subscription based on number of students or active parents. The platform must support multiple independent schools (tenants) with complete data isolation.







2. Master Control Centre (Platform Super Admin Dashboard) – Highest Priority



Create a completely separate, highly secured Master Control Centre that serves as the absolute master control panel for the entire SaaS platform. This is the command centre for mass production, white-labelling, feature management, and demo data seeding at scale.







Access Control (Strict & Exclusive):



- The Master Control Centre has its own dedicated login page (completely separate from school/tenant logins).



- Registration and login forms must be present (email + password fields).



- “Login with Google” button must be implemented using Google OAuth.



- Password reset functionality must exist and send the reset email exclusively to the authorised Google account.



- Only one Google account is ever allowed: `timmytim691@gmail.com`.



- When a user clicks “Login with Google”, the system must automatically authenticate and grant access only if the Google account is exactly `timmytim691@gmail.com`. Any other Google account must be rejected with a clear error message (“Access restricted to authorised platform administrator only”).



- Email/password login is also restricted exclusively to `timmytim691@gmail.com`. No other email address can ever register or log into the Master Control Centre.



- After successful Google login with the authorised account, the user is logged in automatically and redirected straight into the Master Control Centre.



- Implement server-side enforcement (not just frontend checks). Use Supabase Auth (or equivalent) with custom claims or a dedicated platform_admins table that only ever contains this single email. All Master Control Centre routes and API endpoints must verify the authenticated user is exactly this email before allowing any action.



- Session must be highly secure (short-lived tokens, secure cookies, etc.).







Master Control Centre Capabilities (Fully Functional Toggle + Seeding System):



This dashboard is the single place from which the entire product can be configured for mass selling without ever touching code:







- Global Feature Toggle System: A comprehensive, database-driven feature flag system. Every major feature in the entire application (Attendance module, Marks/Grades, Behaviour Notes, Homework, Notices, WhatsApp integration, Parent messaging, Advanced analytics, Student portal, Fee module placeholder, Transport tracking placeholder, Report card generator, Bulk import, Dark mode, PWA install prompt, etc.) must appear as a clean toggle switch or enable/disable button in the Master Control Centre. 



  - Toggling a feature on/off must immediately enable or disable that feature across the entire platform (or per plan / per tenant) without any code deployment.



  - Support both global toggles and per-tenant overrides.



  - Feature flags must be checked on both frontend (hide/show UI) and backend (block API access if disabled).



  - Include ability to add new custom feature flags via the UI (name, key, description, default state).







- White-Label & Mass Production Controls:



  - Full white-label engine: upload platform logo, set primary/secondary colours, custom domain mapping readiness, remove “Powered by EduSync” branding, custom email sender name/domain, custom favicon.



  - Plan & Pricing Manager: create/edit subscription plans (Starter, Growth, Enterprise, Custom), set seat limits, feature bundles per plan, pricing, trial duration. These plans are what schools subscribe to.



  - Tenant (School) Manager: create new schools, suspend/activate schools, view all tenants, impersonate a school admin (with audit log), force password resets, view usage metrics per school.



  - Global Branding Templates: create reusable white-label themes that can be applied to new tenants with one click.



  - Feature Packaging: assign which feature toggles belong to which plans so that when a school is on the Starter plan, certain modules are automatically locked.



  - Mass Onboarding Tools: bulk create demo schools, generate invite links.



  - Platform-wide Announcement System: push banners or maintenance notices to all tenants or selected tenants.



  - Analytics Super Dashboard: total schools, active parents, total students, attendance marking volume, feature adoption rates, revenue metrics (when Stripe is connected), churn indicators.



  - System Health & Logs: view error rates, real-time connection counts, storage usage, audit logs of every critical action taken inside the Master Control Centre itself.



  - Ability to enable/disable entire modules (e.g., turn off Behaviour Notes globally if needed) via toggles.







- One-Click Seed Data / Demo Data Generator (Critical Feature):



  Inside the Master Control Centre there must be a prominent, dedicated “Seed Demo Data” section with clear buttons and options. This allows the platform owner (or anyone with Master Control Centre access) to instantly populate realistic, high-volume demo data so that any stakeholder can log in and immediately experience the full power of the product.



  - Provide a primary button: “Seed Full Realistic Demo School (Maximum Capacity)”.



  - When clicked, the system must generate a complete, production-quality demo tenant (school) that represents the scale of the largest ordinary schools in South Africa (approximately 3,000–3,500 students, matching real mega-schools such as Ogwini Comprehensive High School and similar institutions).



  - The seeded school must include:



    - Full school structure: multiple grades (e.g. Grade R–12 or Grade 8–12 for high school focus, plus primary options), multiple classes/sections per grade (e.g. 8A, 8B, 8C… up to realistic numbers), subjects, academic year and terms.



    - Students: 3,000+ students (or configurable up to the practical maximum the database and UI can handle smoothly for demo purposes; target the capacity of South Africa’s largest ordinary schools ≈ 3,300+). Distribute students realistically across grades and classes. Include student photos (placeholder avatars), admission numbers, dates of birth, and basic profiles.



    - Parents / Guardians: Hundreds of unique parent accounts. Critically, create many parents who have multiple children enrolled in the same school (different grades/classes) so the multi-child switcher, unified family view, and cross-child insights are clearly demonstrated. Also create single-child parents for contrast. Link parents to students with proper relationship types (Mother, Father, Guardian, etc.).



    - Staff: Full complement of staff including:



      - 1 Principal / School Admin account.



      - Multiple Deputy Principals / HODs.



      - 80–120+ Teachers (realistic for a mega-school), assigned to classes and subjects.



      - Support staff if relevant.



    - Realistic historical and current data across all modules:



      - Attendance records for the past several months (mix of Present, Absent, Late, Excused) with realistic patterns.



      - Multiple assessments and marks per subject (class tests, mid-terms, projects, exams) with varied performance.



      - Behaviour notes (positive and negative) distributed across students.



      - Homework assignments (current, upcoming, and past) with some marked complete/overdue.



      - School-wide, grade-wide, and class notices (some urgent, some with attachments).



      - Notification history so the notification centre is populated.



    - Pre-created login credentials that are clearly displayed in the Master Control Centre after seeding (and also in a downloadable credentials sheet or on-screen table). Examples of credentials that must be generated and shown:



      - Principal / School Admin: e.g. `principal@demo-edusync.school` / password



      - Several Teachers: e.g. `teacher1@demo-edusync.school`, `maths.head@demo-edusync.school`, etc.



      - Multiple Parent accounts, including at least 5–10 parents who have 2–4 children each, plus single-child parents.



      - Optional Student accounts if the Student role is enabled.



    - All seeded users must be fully functional: parents can log in and immediately see real-time multi-child dashboards, attendance, marks, homework, behaviour notes, and notices for all their children. Teachers can mark attendance and enter marks that appear instantly for parents. The Principal can see school-wide analytics.



  - Additional seed options:



    - “Seed Smaller Demo School” (e.g. 400–800 students) for lighter demos.



    - “Clear All Demo Data” (with confirmation).



    - “Re-seed / Reset Demo School” (wipe and regenerate fresh data).



    - Option to seed multiple demo schools at once for sales demos.



    - Progress indicator and success summary showing exactly how many students, parents, teachers, attendance records, marks, etc. were created.



  - The seeded data must be rich enough to showcase every major advantage of the software: real-time updates, multi-child parent experience, reduced query volume, teacher efficiency, school-wide visibility, behaviour tracking, homework management, and beautiful dashboards.



  - After seeding, the Master Control Centre must display a clear “Demo Login Credentials” card/panel with copy buttons for every major role so anyone can immediately test the product.







All changes made in the Master Control Centre (toggles, branding, plan changes, tenant status, seeding) must take effect in real time or on next page load for the affected tenants without requiring code changes or redeploys.







3. User Roles & Permissions (Strict RBAC)



Implement five primary roles with fine-grained permissions enforced at the database (Row Level Security) and application level:







- Platform Super Admin (only `timmytim691@gmail.com` via Master Control Centre): Full god-mode access as described above, including the Seed Demo Data tools.



- School Admin / Principal: Full control within their school — manage staff, classes, subjects, academic year/terms, parent invitations, settings, branding (within limits set by Master Control Centre), reports, notices, and subscription status.



- Teacher: Assigned to classes/subjects. Can mark attendance, enter marks/grades, create behaviour notes, assign homework, post class notices, view their class parent contacts (limited), and see aggregated class insights.



- Parent / Guardian: Linked to one or more children. Read-only access to their children’s data only. Can receive notifications, view history, download reports, message teacher (optional moderated channel), and manage their notification preferences. Multi-child support must be excellent.



- Student (optional secondary role, toggleable per school or globally via Master Control Centre): Limited view of their own attendance, marks, homework, and notices.







Support multiple guardians per student and multiple children per parent. Support class teachers, subject teachers, and co-teachers.







4. Core Functional Modules (Must Be Fully Working)







A. Authentication & Onboarding



- Email + password signup/login with email verification (for school users).



- Magic link / OTP login option.



- School Admin invites teachers and parents via email (secure invite links that expire).



- Parent self-registration via school-specific invite code or QR.



- WhatsApp-linked login / deep-link flow (design the data model and UI so that a parent can link their WhatsApp number; prepare backend endpoints and UI for future WhatsApp Business API / Twilio / 360Dialog integration; include a “Continue with WhatsApp” button and phone verification flow).



- Password reset, profile management, multi-factor readiness.



- First-login onboarding wizards for each role (school setup for Admin, class assignment for Teacher, child linking for Parent).



- Note: Master Control Centre authentication is completely isolated and restricted as specified in section 2.







B. School & Academic Structure



- Multi-tenant: each school is an isolated tenant with its own subdomain or path-based tenancy + branding (logo, primary color, school name) controlled/overrideable from Master Control Centre.



- Academic year / terms / semesters management.



- Classes / grades / sections (e.g., Grade 5A, Grade 5B).



- Subjects linked to classes and teachers.



- Student enrolment with unique student ID, admission number, date of birth, photo, medical notes (optional), guardian relationships.



- Bulk CSV import for students, parents, and staff (with validation and error reporting).



- Class timetable / schedule (basic version that can later expand).







C. Real-Time Attendance



- Teachers mark attendance per class/period (Present, Absent, Late, Excused, Half-day).



- Support daily and period-wise attendance.



- Bulk mark + individual overrides.



- Real-time push to all linked parents the moment attendance is submitted or changed.



- Parent dashboard shows today’s status, weekly/monthly calendar view, absence history, and percentage.



- Automated absence alerts (configurable thresholds).



- Export attendance reports (PDF/CSV) for school admin.







D. Marks / Grades / Assessments



- Flexible grading system configurable per school (percentage, letter grades, GPA, custom scales, continuous assessment + exams).



- Teachers create assessments (class test, homework mark, mid-term, final, project) with max marks, weight, date, and subject.



- Enter marks individually or via spreadsheet-like grid.



- Automatic calculation of term averages, overall percentage, rank (optional, privacy-respecting).



- Real-time visibility for parents the moment marks are published (draft vs published status).



- Parent view: subject-wise breakdown, progress graphs over time, comparison to class average (optional toggle), downloadable report cards.



- Historical year-over-year comparison.







E. Behaviour Notes & Incidents



- Teachers log positive or negative behaviour notes with categories (e.g., Excellent participation, Disruption, Incomplete work, Leadership), severity, date/time, and optional private teacher notes vs parent-visible notes.



- Attachment support (photo of work, incident form).



- Parent receives real-time notification for new notes.



- School Admin can view school-wide behaviour trends and flag patterns.



- Optional points / house system for gamification (configurable).







F. Homework & Assignments



- Teachers create homework with title, description, subject, due date, attachments (PDF, images, links), and optional submission requirement.



- Mark as completed / submitted by student or parent confirmation.



- Real-time list for parents filtered by child and due date.



- Overdue highlighting and reminders.



- Simple submission tracking (file upload or “marked done”).







G. School & Class Notices / Announcements



- School-wide, grade-wide, or class-specific notices.



- Rich text + attachments + priority (normal / urgent).



- Scheduled publishing.



- Read receipts / acknowledgement tracking for important notices.



- Real-time feed on parent dashboard.







H. Parent Dashboard (Primary Experience)



Beautiful, mobile-first, real-time dashboard showing:



- Child switcher (if multiple children) — this must shine with the seeded multi-child parents.



- Today’s attendance status with visual indicator.



- Upcoming / overdue homework.



- Latest marks and recent assessments.



- Recent behaviour notes.



- Latest notices.



- Quick stats (attendance %, average marks, open items).



- Calendar view combining homework due dates, assessment dates, and school events.



- Notification center with filters.



- Download centre for report cards and official documents.







I. Teacher Dashboard



- My classes overview.



- Quick attendance marking.



- Pending homework to review.



- Recent parent activity / read rates.



- Class performance snapshots.



- Notice composer.







J. School Admin / Principal Dashboard



- School health metrics (active parents, attendance rates, engagement).



- Staff management.



- Student & parent directory with search and filters.



- Billing & subscription status.



- Audit logs of key actions.



- Branding and configuration centre (limited by Master Control Centre permissions).



- Report generator (attendance, academic performance, behaviour).







K. Real-Time Engine



Every relevant data change (attendance mark, new mark published, new behaviour note, new homework, new notice) must instantly appear for authorised parents without page refresh. Use Supabase Realtime (or equivalent WebSocket / subscription layer) with proper channel scoping per student/parent/school so parents only receive their data. Show subtle live indicators (“Updated just now”).







L. Notifications System



- In-app notification centre.



- Email notifications (transactional).



- Push notification readiness (web push + mobile later).



- WhatsApp notification pathway: design the message templates, opt-in system, and backend hooks so that when a school connects WhatsApp Business API credentials, key events (absence, new mark, urgent notice, homework due tomorrow) can be sent as templated messages. Include preference centre so parents can choose channels per event type.



- Quiet hours and digests option.



- All notification channels can be globally enabled/disabled from the Master Control Centre feature toggles.







5. Data Model (Core Entities – Implement Fully)



- Tenants / Schools



- Users (with role)



- PlatformAdmins (restricted to the single authorised email)



- FeatureFlags (global and per-tenant)



- Students



- ParentStudent links (many-to-many with relationship type)



- Classes / Sections



- Subjects



- ClassSubjectTeacher assignments



- AcademicYears / Terms



- AttendanceRecords



- Assessments & Marks



- BehaviourNotes



- HomeworkAssignments & Submissions



- Notices & NoticeReads



- Notifications



- Files / Attachments (Supabase Storage or equivalent)



- Subscriptions / Plans



- AuditLogs



- SchoolSettings (branding, grading scales, notification defaults, features toggles)



- PlatformSettings (global white-label and system config)



- DemoSeedJobs / SeedHistory (to track seeding operations)







All tables must have proper indexes, foreign keys, soft deletes where appropriate, and comprehensive Row Level Security policies so a parent can never see another family’s data, a teacher only sees their assigned classes, and only the authorised Master Control Centre email can access platform-level tables and trigger seeding.







6. UI/UX Requirements



- Modern, clean, trustworthy educational design (soft blues/greens, excellent typography, generous whitespace, accessible contrast).

Fully responsive (mobile-first; parents will use phones heavily).

Dark mode support (toggleable via Master Control Centre).

Skeleton loaders, optimistic updates, and smooth transitions.

Empty states with helpful guidance.

Powerful global search (students, notices, homework).

Accessibility (keyboard navigation, ARIA, screen-reader friendly).

Internationalisation-ready (at least English; structure for easy addition of other languages).

Beautiful data visualisations (attendance heatmaps/calendars, progress charts, grade distribution) using a modern charting library.

Printable / PDF export for report cards and official documents.

Master Control Centre itself must have a distinct, powerful, dark or high-density admin aesthetic suitable for a platform command centre, with clear sections for Feature Toggles, White-Label Studio, Tenant Manager, Plans & Billing, Seed Demo Data, Analytics, and System Health. The Seed Demo Data section must be highly visible and user-friendly, with clear previews of what will be created and easy-to-copy credentials after seeding.

7. SaaS & Business Features

Subscription plans (Starter, Growth, Enterprise) with student or parent seat limits, feature gates controlled entirely from the Master Control Centre feature toggle + plan system.

Stripe (or equivalent) integration for subscriptions, invoices, and customer portal.

School onboarding checklist and usage analytics for the school admin.

Feature flags / plan-based feature unlocking (all managed via Master Control Centre toggles).

Usage metering (active students, messages sent, storage).

White-label options (custom domain readiness, remove platform branding on higher plans) — fully controllable from Master Control Centre.

Admin-facing metrics and churn indicators.

8. Security, Compliance & Reliability

Strict Row Level Security on every table.

Input validation and sanitisation.

Rate limiting on sensitive endpoints.

Secure file uploads with type and size restrictions.

GDPR-ready: data export, deletion requests, consent tracking for notifications.

Audit logging of sensitive actions (especially everything done inside the Master Control Centre, including seeding operations).

Regular backup considerations and soft-delete recovery windows.

Clear privacy policy and terms placeholders.

Protection against common web vulnerabilities.

Master Control Centre authentication is the highest security priority — enforce the single-email restriction at every layer.

Seeding operations must be safe, idempotent where possible, and logged.

9. WhatsApp Mini-App / Linked Experience

Design the system so a parent can:

Link their WhatsApp number securely.

Receive rich notifications.

Potentially open a lightweight webview or progressive web app experience from WhatsApp.

Future-proof the data model and notification service for full conversational WhatsApp bot capabilities (e.g., “What is the homework for Maths today?”) without requiring a full rewrite.

WhatsApp integration itself must be toggleable from the Master Control Centre.

10. Additional Production Requirements

Comprehensive error handling and user-friendly error messages.

Loading and success states everywhere.

The Seed Demo Data feature in the Master Control Centre is mandatory and must produce immediately usable, realistic, high-volume data (3,000+ students scale, multi-child parents, full staff complement, rich academic history) so anyone can log in with the provided credentials and experience the complete product value proposition within seconds.

Clear README with setup instructions, environment variables, and how to deploy.

Modular code structure so features can be extended.

Performance: pagination, efficient queries, proper indexing (especially important for the large seeded datasets).

Mobile PWA readiness (installable, offline-friendly for recent data).

The entire feature set of the application must be controllable via the Master Control Centre toggles so the product can be sold in different configurations (basic parent portal vs full academic suite) without code changes.

11. Non-Goals for v1 (but architect for future)

Do not build a full LMS, video conferencing, or complex timetable optimiser in the first version. Focus on the parent visibility loop and teacher efficiency. Architecture should allow later addition of student portfolios, parent-teacher meeting booking, fee management, transport tracking, etc. All future modules should be added as new feature flags in the Master Control Centre.

Deliverables Expected from This Prompt

Generate a fully working application with:

A fully secured Master Control Centre accessible only by timmytim691@gmail.com (via email/password or Google OAuth auto-login), containing a complete feature toggle system, white-label controls, tenant management, plan management, platform analytics, and a powerful one-click Seed Demo Data system that creates a realistic mega-school (≈3,000–3,500 students), full staff including principal, hundreds of parents (many with multiple children), rich academic history across all modules, and clearly displayed login credentials for immediate testing.

Complete authentication and role-based dashboards for School Admin/Principal, Teacher, and Parent (with excellent multi-child support).

Working real-time attendance, marks, behaviour, homework, and notices.

Multi-tenancy with data isolation.

Notification system foundation + WhatsApp readiness.

Subscription/billing foundation.

Beautiful, responsive UI.

Proper security (RLS) and clean code organisation.

Every feature in the product can be turned on or off from the Master Control Centre with simple toggles, enabling true mass-production white-label selling.

After using the Seed Demo Data button, any person can immediately log in as Principal, Teacher, or multi-child Parent and experience the full value of the software with realistic scale and data.

Make every screen and flow actually functional. Teachers must be able to update data and parents must see the changes in real time without refresh. The Master Control Centre must allow the platform owner to reconfigure the entire product’s feature set, branding, and demo data for different customers or sales situations without ever changing code. The product should be close enough to sell as a SaaS MVP to real schools with only configuration, branding, and WhatsApp Business API credentials needed to go live.

Prioritise reliability, clarity, and parent delight. The interface should feel calm, trustworthy, and information-dense without being overwhelming. Use progressive disclosure, smart defaults, and clear visual hierarchy.

Begin by scaffolding the full multi-tenant structure, the restricted Master Control Centre authentication (hard-locked to timmytim691@gmail.com), the feature flag system, the Seed Demo Data engine, authentication for normal users, core data models with RLS, and the three primary dashboards (Parent, Teacher, School Admin). Then implement the real-time academic modules one by one, ensuring each is fully wired end-to-end, controllable via Master Control Centre toggles, and populated realistically by the seeder before moving to the next. Include a polished landing/marketing page that explains the value proposition and has a clear “Start Free Trial / Request Demo” path for school administrators.

This must be a real product, not a prototype.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://edusync-sa.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/11f95b03-6dca-4e51-8e8b-6e996223533b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
