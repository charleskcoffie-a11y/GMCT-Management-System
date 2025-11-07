// constants.ts

// --- Application Metadata ---
export const APP_VERSION = '0.0.0';

// --- MSAL / OneDrive Configuration ---
// IMPORTANT: Replace with your actual Azure App Registration Client ID
export const MSAL_CLIENT_ID = "c8358699-db35-45ca-997d-dc15c2be9553";
// IMPORTANT: To fix sign-in errors for single-tenant apps, replace this with your Azure Tenant ID.
// You can find this on the Overview page of your Azure Active Directory.
// e.g., "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" or "yourtenant.onmicrosoft.com"
export const MSAL_TENANT_ID = "10eb45a8-7562-4898-a5a5-8cc3598fd239";
export const GRAPH_SCOPES = ["User.Read", "Files.ReadWrite.AppFolder", "Sites.ReadWrite.All"];
// Corporate domains that are allowed to complete the in-app Microsoft 365 sign-in helper.
// Update this list to match the work or school accounts for your organisation.
export const MICROSOFT_ALLOWED_EMAIL_DOMAINS = [
    'gmct-ca.org',
    'gmct98.onmicrosoft.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
];

// --- SharePoint Configuration Defaults ---
// IMPORTANT: Replace with your SharePoint site URL
// e.g., "https://yourtenant.sharepoint.com/sites/YourSiteName"
export const DEFAULT_SHAREPOINT_SITE_URL = "https://gmct98.sharepoint.com/sites/Finance";

// IMPORTANT: Replace with the exact names of your SharePoint lists
export const DEFAULT_SHAREPOINT_MEMBERS_LIST_NAME = "Members_DataBase";
export const DEFAULT_SHAREPOINT_ENTRIES_LIST_NAME = "Finance_Records";
export const DEFAULT_SHAREPOINT_HISTORY_LIST_NAME = "Weekly_Service_History";
export const DEFAULT_SHAREPOINT_TASKS_LIST_NAME = "TASKS";

// Backwards-compatible aliases for existing configuration constants
export const SHAREPOINT_SITE_URL = DEFAULT_SHAREPOINT_SITE_URL;
export const SHAREPOINT_MEMBERS_LIST_NAME = DEFAULT_SHAREPOINT_MEMBERS_LIST_NAME;
export const SHAREPOINT_ENTRIES_LIST_NAME = DEFAULT_SHAREPOINT_ENTRIES_LIST_NAME;
export const SHAREPOINT_TASKS_LIST_NAME = DEFAULT_SHAREPOINT_TASKS_LIST_NAME;

// The base URL for Microsoft Graph API requests
export const SHAREPOINT_GRAPH_URL = "https://graph.microsoft.com/v1.0";

// --- App Defaults ---
export const DEFAULT_CURRENCY = 'CAD';
export const DEFAULT_MAX_CLASSES = 20;
