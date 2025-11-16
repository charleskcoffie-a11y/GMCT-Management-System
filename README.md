# GMCT Management System - Setup & Deployment Guide

This guide provides step-by-step instructions to configure and deploy the GMCT Management System. Following these steps will connect the app to your Supabase project for live cloud storage and host it on a private, shareable website (via GitHub Pages).

---

## Application Overview

### 1. High-Level Purpose

The GMCT Management System replaces manual spreadsheets with a centralized, role-aware record-keeping platform. It streamlines administrative tasks, surfaces financial and attendance trends, and keeps sensitive membership information secure while remaining accessible to the appropriate team members.

### 2. Core Features & Functionality

The single-page application exposes dedicated modules through a navigation sidebar. Each role unlocks a tailored toolset:

#### User Roles & Access Control

* **Admin** – Full-system oversight, including user management, configuration, and complete data access.
* **Finance** – Manages financial records and the member directory, and reviews reports.
* **Class Leader** – Views the directory and records attendance for their assigned class.
* **Statistician** – Views the directory and maintains the detailed Weekly History reports.

#### Financial Record Management

* **Data Entry Dashboard** – A dedicated Financial Records tab lists all contributions with sorting and filtering controls.
* **Smart Entry Modal** – Intelligent member lookup ensures clean data entry via a searchable datalist.
* **Full CRUD** – Create, review, edit, and delete financial entries, with confirmation safeguards before deletions.
* **Filtering & Sorting** – Narrow results by member, class, contribution type, and date range; all major columns support sorting.

#### Member Directory

* **Centralized Records** – The directory tab shows every member along with their class assignments.
* **CRUD Operations** – Admin and Finance roles can add, edit, or remove members.
* **Search & Filter** – Quickly locate members by name or class number.
* **CSV Import** – Bulk onboarding is available through a CSV upload utility.

#### Attendance Tracking & Reporting

* **Attendance Marking** – Class Leaders record statuses (Present, Absent, Sick, Travel, Catechumen) for each member by date.
* **Admin Reporting** – Finance and Admin roles review rollups and per-member statuses for a selected day.
* **Individual History** – Drill into a member’s complete attendance record directly from the report view.

#### Weekly Service History

* **Comprehensive Form** – Statisticians capture service details (date, preacher, liturgist, memory text, sermon topic, sermon summary, highlights), structured attendance (adult men/women, children, adherents, catechumens, visitor totals and names), special visitor bios, announcement key points, donation descriptions, and notes about new members or events.
* **Record Management** – Browse, edit, or remove historical weekly reports as needed.

#### Data Insights & Visualization

* **Dashboard Metrics** – Highlight cards summarize total contributions, entry counts, and average gift size.
* **Interactive Charts** – Recharts visualizations plot monthly giving trends and contribution type breakdowns.

#### Data Management & Utilities

* **Import/Export** – Financial records and member data can be imported from CSV and exported to CSV or JSON.
* **Full Backup & Restore** – Admins can export all application state—including financial records, member directory, attendance logs, weekly history reports, user accounts, and configuration settings—to JSON and restore from that backup.
* **Custom Reports** – Generate bespoke CSV exports filtered by date ranges, contribution types, and class groupings.
* **Danger Zone** – A secure utility wipes local storage for a clean slate when necessary.

### 3. Technical Architecture & Design

* **Framework** – React with TypeScript delivers a type-safe, component-based SPA.
* **Build Tooling** – Vite powers rapid local development and optimized production bundles.
* **Styling** – Tailwind CSS provides responsive, utility-first styling across the interface.
* **Data Persistence** – Local Storage serves as the offline-first datastore for all records.
* **Data Integrity** – All persisted or imported data flows through sanitizer utilities to enforce expected shapes and prevent corruption.
* **Optional Cloud Sync** – A Supabase REST integration keeps financial records, members, weekly reports, and tasks in sync. Configure your Supabase URL, anon key, and table names via environment variables in `constants.ts`.

### 4. Deployment & Setup

* **Hosting** – Designed for GitHub Pages deployment.
* **Automation** – A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and publishes the Vite bundle on every push to `main`.
* **Documentation** – This README walks administrators through Supabase provisioning, credential configuration, and secure deployment.

## Part 1: Supabase Setup (One-Time)

This part creates the necessary Supabase project the application uses for cloud synchronization.

### Step 1.1: Create a Supabase Project

1.  Navigate to [supabase.com](https://supabase.com), sign in, and click **New project**.
2.  Choose an organization, give the project a name (for example `gmct-records`), and set a strong database password.
3.  Once the project is ready, open **Settings → API** and copy the **Project URL** plus the **anon public key**. You'll need both values later when configuring the app and your GitHub Actions workflow.

### Step 1.2: Create Database Tables

Open the **SQL Editor** in Supabase and run the following script to provision the tables the app expects. The JSON columns store the nested objects captured by the weekly history forms and the task sync metadata.

```sql
create table if not exists entries (
  id text primary key,
  spId text,
  date text not null,
  memberID text not null,
  memberName text not null,
  type text not null,
  fund text not null,
  method text not null,
  amount numeric not null,
  note text
);

create table if not exists members (
  id text primary key,
  spId text,
  name text not null,
  classNumber text
);

create table if not exists weekly_history (
  id text primary key,
  spId text,
  dateOfService text not null,
  societyName text,
  preacher text,
  guestPreacher boolean default false,
  preacherSociety text,
  liturgist text,
  serviceType text,
  serviceTypeOther text,
  sermonTopic text,
  memoryText text,
  sermonSummary text,
  worshipHighlights text,
  announcementsBy text,
  announcementsKeyPoints text,
  attendance jsonb,
  newMembersDetails text,
  newMembersContact text,
  donations jsonb,
  events text,
  observations text,
  preparedBy text
);

create table if not exists tasks (
  id text primary key,
  spId text,
  title text not null,
  notes text,
  createdBy text,
  assignedTo text,
  dueDate text,
  status text not null,
  priority text not null,
  createdAt text not null,
  updatedAt text not null,
  _sync jsonb
);
```

### Step 1.3: Configure Row-Level Security

Supabase enables Row-Level Security (RLS) by default. Grant the `anon` role permission to read and write the tables (or disable RLS if you are hosting the project in a locked-down environment):

```sql
alter table entries enable row level security;
create policy "gmct_entries_rw" on entries for all to anon using (true) with check (true);

alter table members enable row level security;
create policy "gmct_members_rw" on members for all to anon using (true) with check (true);

alter table weekly_history enable row level security;
create policy "gmct_history_rw" on weekly_history for all to anon using (true) with check (true);

alter table tasks enable row level security;
create policy "gmct_tasks_rw" on tasks for all to anon using (true) with check (true);
```

If you prefer to restrict access further, create policies that only allow requests from specific API keys or IP addresses.

---

## Part 2: Application Code Configuration

The app reads Supabase credentials and default table names from Vite environment variables. Define them in a local `.env` file for development and as GitHub secrets for deployment:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_ENTRIES_TABLE=entries
VITE_SUPABASE_MEMBERS_TABLE=members
VITE_SUPABASE_HISTORY_TABLE=weekly_history
VITE_SUPABASE_TASKS_TABLE=tasks
```

Only the URL and anon key are strictly required—the table variables let you point the app at differently named tables if needed. After the app boots, administrators can also adjust the saved table names inside **Settings → Supabase Configuration** without rebuilding the code.

---

## Part 3: Deployment to GitHub Pages

This part uploads the configured application to a private website that you can share with your team.

### Step 3.1: Create a Private GitHub Repository

1.  Log in to your GitHub account.
2.  Click the **"+"** icon in the top-right corner and select **"New repository"**.
3.  **Repository name:** `gmct-records-app` (or a name of your choice).
4.  Select the **"Private"** option to protect your configuration details.
5.  Click **"Create repository"**.

### Step 3.2: Upload the Application Files

You can either upload through the GitHub web UI, work through a pull request, or push from your local machine. The key requirement is that the `main` branch contains all of the source files (including `App.tsx`, `components/`, and the edited `constants.ts`). A GitHub Actions workflow included with this project will take care of building the optimized production bundle and publishing it, so you **should not** commit the `dist/` folder yourself.

**Option A – Upload in the browser**

1.  In your new repository, click **"Add file"** > **"Upload files"**.
2.  Drag and drop **all application files and folders** into the upload area. This includes the `constants.ts` file you just edited.
3.  Click **"Commit changes"**.

**Option B – Push from your computer**

1.  Clone the empty repository to your machine: `git clone https://github.com/<your-username>/<repository-name>.git`
2.  Copy this project into the cloned folder, run `npm install`, and verify it builds locally with `npm run build`.
3.  Commit all files (except `dist/`) and push them to the `main` branch.

**Option C – Use a pull request workflow**

1.  Create a feature branch from `main` (for example, `git checkout -b feature/update-dashboard`).
2.  Commit your changes to that branch and push it to GitHub.
3.  Open a pull request targeting `main` and review the diffs as usual.
4.  Once the pull request is merged, the merge commit lands on `main` and automatically triggers the GitHub Actions deployment workflow—no extra manual steps required.

### Step 3.3: Add Supabase Secrets to GitHub

1.  In your repository, go to **Settings → Secrets and variables → Actions**.
2.  Create two **Repository secrets** named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` that match the values from Part 1. (Add the optional table variables here as well if you overrode them locally.)
3.  The included GitHub Actions workflow automatically exposes these secrets to the build step so the compiled bundle can talk to Supabase.

### Step 3.4: Enable GitHub Pages

1.  In your repository, go to the **"Settings"** tab.
2.  On the left menu, click **"Pages"**.
3.  Under **"Build and deployment"**, choose **Source → GitHub Actions** and click **"Save"**. _Do not_ select the old "Deploy from a branch" option—if you do, GitHub Pages will serve the raw TypeScript files and the site will stay on the "Loading Application…" screen.
4.  After each push to `main`, open the **Actions** tab and wait for the **Deploy to GitHub Pages** workflow to finish. You should also see a successful deployment listed under **Deployments → github-pages** on the right side of your repository home page. Once it succeeds, reload the **Settings → Pages** screen. A green box will appear with your live website URL. **Copy this URL.** It will look like `https://<your-username>.github.io/<repository-name>/`.

----

## Part 4: Share Your App!

Your application is now live and fully configured.

*   You can now share the GitHub Pages URL with your team members.
*   They can open the link, sign in with their assigned user accounts, and start using the application immediately with no setup required.
*   As long as the Supabase environment variables are configured, their changes will sync to your Supabase project whenever they are online.

---

## Troubleshooting

If the GitHub Pages site displays **"Loading Application…"** for more than a few seconds:

1.  Open your repository on GitHub and review the **Actions → Deploy to GitHub Pages** workflow run for the most recent commit. Resolve any build errors reported there.
2.  Confirm **Settings → Pages → Build and deployment → Source** is set to **GitHub Actions**. If it is set to "Deploy from a branch", GitHub will host the uncompiled TypeScript files and the app will never start.
3.  After a successful deploy, force-refresh your browser (`Ctrl+Shift+R` on Windows/Linux or `Cmd+Shift+R` on macOS) to make sure you are loading the newest bundle.

