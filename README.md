# GMCT Management System - Setup & Deployment Guide

This guide provides step-by-step instructions to configure and deploy the GMCT Management System. Following these steps will connect the app to your Microsoft 365 account for live cloud storage (via SharePoint) and host it on a private, shareable website (via GitHub Pages).

---

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
    
    // Paste the SharePoint Site homepage URL from Step 1.3
    export const SHAREPOINT_SITE_URL = "https://yourtenant.sharepoint.com/sites/YourSite";

    // These should match the names from Step 1.3 exactly
    export const SHAREPOINT_MEMBERS_LIST_NAME = "Members_DataBase";
    export const SHAREPOINT_ENTRIES_LIST_NAME = "Finance_Records";
    ```
3.  Save the `constants.ts` file.

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

codex/restore-missing-imports-for-app.tsx
You can either upload through the GitHub web UI or push from your local machine. The key requirement is that the `main` branch contains all of the source files (including `App.tsx`, `components/`, and the edited `constants.ts`). A GitHub Actions workflow included with this project will take care of building the optimized production bundle and publishing it, so you **should not** commit the `dist/` folder yourself.
=======
You can either upload through the GitHub web UI or push from your local machine. The key requirement is that the `main` branch contains all of the source files (including `App.tsx`, `components/`, and the edited `constants.ts`). GitHub Pages will build directly from this branch, so you **do not** need to commit the `dist/` folder.
main

**Option A – Upload in the browser**

1.  In your new repository, click **"Add file"** > **"Upload files"**.
2.  Drag and drop **all application files and folders** into the upload area. This includes the `constants.ts` file you just edited.
3.  Click **"Commit changes"**.

**Option B – Push from your computer**

1.  Clone the empty repository to your machine: `git clone https://github.com/<your-username>/<repository-name>.git`
2.  Copy this project into the cloned folder, run `npm install`, and verify it builds locally with `npm run build`.
3.  Commit all files (except `dist/`) and push them to the `main` branch.

### Step 3.3: Enable GitHub Pages

1.  In your repository, go to the **"Settings"** tab.
2.  On the left menu, click **"Pages"**.
codex/restore-missing-imports-for-app.tsx
3.  Under **"Build and deployment"**, choose **Source → GitHub Actions** and click **"Save"**. _Do not_ select the old "Deploy from a branch" option—if you do, GitHub Pages will serve the raw TypeScript files and the site will stay on the "Loading Application…" screen.
4.  After each push to `main`, open the **Actions** tab and wait for the **Deploy to GitHub Pages** workflow to finish. You should also see a successful deployment listed under **Deployments → github-pages** on the right side of your repository home page. Once it succeeds, reload the **Settings → Pages** screen. A green box will appear with your live website URL. **Copy this URL.** It will look like `https://<your-username>.github.io/<repository-name>/`.
=======
3.  Under **"Build and deployment"**, set **Source** to **"Deploy from a branch"**.
4.  Choose the `main` branch and the **`/(root)`** folder, then click **"Save"**. GitHub Pages will publish straight from the project root. (Because `vite.config.ts` already sets a relative base path, no extra configuration is required.)
5.  Wait for the deployment banner to finish building, then refresh the page. A green box will appear with your live website URL. **Copy this URL.** It will look like `https://<your-username>.github.io/<repository-name>/`.
main

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

If you ever see Git merge conflict markers (for example, `<<<<<<<` or `>>>>>>>`) inside `README.md`, open the file in your editor, remove the markers, and keep the instructions that match your current deployment method. Save the resolved file, run `git add README.md`, and create a new commit to finalize the fix.
