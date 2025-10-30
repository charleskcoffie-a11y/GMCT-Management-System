# GMCT Management System - Setup & Deployment Guide

This guide provides step-by-step instructions to configure and deploy the GMCT Management System. Following these steps will connect the app to your Microsoft 365 account for live cloud storage (via SharePoint) and host it on a private, shareable website (via GitHub Pages).

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
* **Full Backup & Restore** – Admins can export all application state to JSON and restore from that backup.
* **Custom Reports** – Generate bespoke CSV exports filtered by date ranges, contribution types, and class groupings.
* **Danger Zone** – A secure utility wipes local storage for a clean slate when necessary.

#### Live SharePoint Synchronization

* **Two-Way Sync** – When an administrator signs in with Microsoft 365, the app now reads from and writes to the configured SharePoint lists in real time so updates from multiple users stay in lock-step.
* **Automatic Column Provisioning** – The finance list receives the `GMCTId`, `GMCTDate`, `GMCTMemberId`, `GMCTMemberName`, `GMCTType`, `GMCTFund`, `GMCTMethod`, `GMCTAmount`, and `GMCTNote` columns automatically during the first sync.
* **Conflict-Free Merging** – Local, offline edits remain cached and are reconciled with the authoritative SharePoint copy as soon as connectivity is restored.

### 3. Technical Architecture & Design

* **Framework** – React with TypeScript delivers a type-safe, component-based SPA.
* **Build Tooling** – Vite powers rapid local development and optimized production bundles.
* **Styling** – Tailwind CSS provides responsive, utility-first styling across the interface.
* **Data Persistence** – Local Storage serves as the offline-first datastore for all records.
* **Data Integrity** – All persisted or imported data flows through sanitizer utilities to enforce expected shapes and prevent corruption.
* **Optional Cloud Sync** – Microsoft Authentication Library (MSAL) connects to Microsoft 365; when signed in, the app now performs continuous two-way synchronization with SharePoint Lists through the `sharepoint.ts` service. Default locations ship in `constants.ts`, but administrators can update the SharePoint site and list names at runtime from **Settings → SharePoint Storage** or the **Utilities → SharePoint Tools** panel.

### 4. Deployment & Setup

* **Hosting** – Designed for GitHub Pages deployment.
* **Automation** – A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and publishes the Vite bundle on every push to `main`.
* **Documentation** – This README walks administrators through Azure AD registration, SharePoint provisioning, credential configuration, and secure deployment.

## Part 1: Azure & SharePoint Setup (One-Time)

This part creates the necessary cloud infrastructure in your organization's Microsoft 365 account. You only need to do this once.

### Step 1.1: Register an Application in Azure AD

First, you need to register the application in Azure Active Directory (AD). This allows the app to securely sign in and access your data with permission.

1.  Navigate to the [Azure Portal](https://portal.azure.com) and sign in with an administrator account.
2.  In the search bar, type `App registrations` and select it.
3.  Click **"+ New registration"**.
4.  **Name:** Enter a name for the application, such as `GMCT Management System`.
5.  **Supported account types:** Select **"Accounts in this organizational directory only (Single tenant)"**. This is the most secure option.
6.  **Redirect URI:** Leave this blank for now. We will add it after deploying the app.
7.  Click **"Register"**.

After the app is created, you will be taken to its overview page. **Copy the following two values** and save them in a temporary text file. You will need them in Part 2.
*   `Application (client) ID`
*   `Directory (tenant) ID`

### Step 1.2: Configure API Permissions for Microsoft Graph

Now, you must grant the application permission to read user profiles and interact with SharePoint.

1.  In your new app registration, go to the **"API permissions"** page from the left-hand menu.
2.  Click **"+ Add a permission"**, then select **"Microsoft Graph"**.
3.  Choose **"Delegated permissions"**.
4.  In the "Select permissions" search box, find and add the following three permissions:
    *   `User.Read` (Allows users to sign in)
    *   `Sites.ReadWrite.All` (Allows reading/writing to SharePoint sites and lists)
    *   `Files.ReadWrite.AppFolder` (Allows file operations if needed in the future)
5.  Click **"Add permissions"**.
6.  Finally, click the **"Grant admin consent for [Your Organization Name]"** button, and confirm by clicking **"Yes"**. The status for all permissions should now show a green checkmark.

### Step 1.3: Create SharePoint Lists for Storage

The application will store its data in lists on a SharePoint site.

1.  Navigate to the SharePoint site you want to use for storage. **Copy the URL of this site's homepage** and save it for Part 2.
2.  From your SharePoint site, click **"+ New"** and select **"List"**.
3.  Choose **"Blank list"**.
4.  **Name:** `Members_DataBase`. Click **"Create"**.
5.  In the new list, the `Title` column already exists. Click the gear icon > **"List settings"** > click on the **"Title"** column and rename it to `Name`. Click **OK**.
6.  Back in the list view, click **"+ Add column"** > **"Single line of text"**. Name it `ID` and click **Save**.
7.  Click **"+ Add column"** > **"Single line of text"**. Name it `ClassNumber` and click **Save**.
8.  Create a second list named `Finance_Records` using the same process. Its columns will be configured automatically by the app in future updates.

> **Why SharePoint and not OneDrive?** The live multi-user sync relies on SharePoint list items so every contributor writes to the same structured dataset. You do not need OneDrive for cloud storage—the bundled OneDrive service remains a stub for future file features, but all real-time collaboration happens through SharePoint.

---

## Part 2: Application Code Configuration

Now, you'll update the app's code with the values you just gathered.

1.  Open the `constants.ts` file in a text editor.
2.  Find the following lines and replace the placeholder text with your actual credentials:

    ```javascript
    // Paste the 'Application (client) ID' from Step 1.1
    export const MSAL_CLIENT_ID = "YOUR_CLIENT_ID_HERE";
    
    // Paste the 'Directory (tenant) ID' from Step 1.1
    export const MSAL_TENANT_ID = "YOUR_TENANT_ID_HERE";
    
    // Paste the SharePoint Site homepage URL from Step 1.3 (used as the initial default)
    export const DEFAULT_SHAREPOINT_SITE_URL = "https://yourtenant.sharepoint.com/sites/YourSite";

    // These should match the names from Step 1.3 exactly
    export const DEFAULT_SHAREPOINT_MEMBERS_LIST_NAME = "Members_DataBase";
    export const DEFAULT_SHAREPOINT_ENTRIES_LIST_NAME = "Finance_Records";
    export const DEFAULT_SHAREPOINT_HISTORY_LIST_NAME = "Weekly_Service_History";
    ```
3.  Save the `constants.ts` file.

> **Tip:** After the app boots, you can fine-tune these SharePoint values without editing code by opening **Settings → SharePoint Storage** (or **Utilities → SharePoint Tools**) and saving the site URL plus list names you want to use long term.

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

#### If `git push` fails because `origin` is missing

When you work from a fresh folder or copy files into a new directory, Git might not know which remote repository to use. If you run `git push` or `git pull` and see an error like `fatal: 'origin' does not appear to be a git repository`, add the remote with the following commands (replace the placeholders with your GitHub path):

```bash
git remote add origin https://github.com/<your-username>/<repository-name>.git
git push -u origin main
```

The first command tells Git where the repository lives online. The second command uploads your `main` branch and remembers that `origin/main` is the default upstream, so future pushes only need `git push`.

### Step 3.3: Enable GitHub Pages

1.  In your repository, go to the **"Settings"** tab.
2.  On the left menu, click **"Pages"**.
3.  Under **"Build and deployment"**, choose **Source → GitHub Actions** and click **"Save"**. _Do not_ select the old "Deploy from a branch" option—if you do, GitHub Pages will serve the raw TypeScript files and the site will stay on the "Loading Application…" screen.
4.  After each push to `main`, open the **Actions** tab and wait for the **Deploy to GitHub Pages** workflow to finish. You should also see a successful deployment listed under **Deployments → github-pages** on the right side of your repository home page. Once it succeeds, reload the **Settings → Pages** screen. A green box will appear with your live website URL. **Copy this URL.** It will look like `https://<your-username>.github.io/<repository-name>/`.

### Step 3.4: Update Azure AD Redirect URI (Final Step)

Finally, tell Azure that your new website URL is allowed to handle sign-ins.

1.  Go back to your **App Registration** in the [Azure Portal](https://portal.azure.com).
2.  Go to the **"Authentication"** page.
3.  Click **"+ Add a platform"**, then select **"Single-page application (SPA)"**.
4.  In the **"Redirect URIs"** box, paste the GitHub Pages URL you copied in the previous step.
5.  Click **"Configure"** at the bottom.

---

## Part 4: Share Your App!

Your application is now live and fully configured.

*   You can now share the GitHub Pages URL with your team members.
*   They can open the link, sign in with their assigned user accounts, and start using the application immediately with no setup required.
*   When a user signs in with their Microsoft account, the app will connect to your SharePoint lists to sync member data.

---

## Troubleshooting

If the GitHub Pages site displays **"Loading Application…"** for more than a few seconds:

1.  Open your repository on GitHub and review the **Actions → Deploy to GitHub Pages** workflow run for the most recent commit. Resolve any build errors reported there.
2.  Confirm **Settings → Pages → Build and deployment → Source** is set to **GitHub Actions**. If it is set to "Deploy from a branch", GitHub will host the uncompiled TypeScript files and the app will never start.
3.  After a successful deploy, force-refresh your browser (`Ctrl+Shift+R` on Windows/Linux or `Cmd+Shift+R` on macOS) to make sure you are loading the newest bundle.

---

## Appendix: Working with Git Changes

### Preventing repeated merge conflicts

Conflicts usually appear when two different edits touch the same file but GitHub cannot decide how to merge them. You can reduce how often they appear by following this routine whenever you update the project:

1. **Pull the latest `main` branch first.** In the GitHub UI, download the newest files before uploading your edits. In a local clone, run `git pull origin main` before you start changing files.
2. **Edit and save your updates.** Make your changes only after you are sure you have the current files.
3. **Commit or upload the refreshed copy.** When you push or upload, you will be sending GitHub an updated version that already includes the latest work, so it will not conflict with the new commit from someone else.
4. **Resolve conflicts once, then repeat the steps above.** After you fix a conflict, make sure to pull again before the next round of edits. That prevents the same conflict from reappearing the next time you upload.

### What do red lines mean on GitHub?

When you review a change on GitHub (for example in a pull request or the file history), the platform highlights **removed or replaced lines in red** and **new lines in green**. Seeing red does not mean the application is broken—it only shows which lines are being deleted compared with the previous version. If you ever see literal conflict markers like `<<<<<<<` or `>>>>>>>` inside a file, those markers mean Git could not merge changes automatically. Remove the markers and choose the correct version of the code, then commit the cleaned file.

