// utils.ts
import type {
    AttendanceRecord,
    AttendanceStatus,
    Entry,
    EntryType,
    Member,
    MemberAttendance,
    Method,
    ServiceType,
    Settings,
    User,
    UserRole,
    WeeklyHistoryAttendanceBreakdown,
    WeeklyHistoryDonations,
    WeeklyHistoryRecord,
} from './types';
import {
    DEFAULT_SHAREPOINT_ENTRIES_LIST_NAME,
    DEFAULT_SHAREPOINT_HISTORY_LIST_NAME,
    DEFAULT_SHAREPOINT_MEMBERS_LIST_NAME,
    DEFAULT_SHAREPOINT_SITE_URL,
} from './constants';

// --- String & Sanitization ---

export function sanitizeString(input: any): string {
    if (typeof input === 'string') {
        // Basic trim and sanitize. In a real app, you might use a library like DOMPurify.
        return input.trim();
    }
    return '';
}

export function capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}


// --- Data Type Sanitizers ---

export function sanitizeEntry(raw: any): Entry {
    const parsedDate = new Date(raw.date);
    const date = (raw.date && !isNaN(parsedDate.getTime()))
        ? parsedDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    
    return {
        id: sanitizeString(raw.id) || generateId('entry'),
        spId: sanitizeString(raw.spId),
        date: date,
        memberID: sanitizeString(raw.memberID),
        memberName: sanitizeString(raw.memberName),
        type: raw.type ? sanitizeEntryType(raw.type) : 'tithe',
        fund: sanitizeString(raw.fund) || "General",
        method: sanitizeMethod(raw.method),
        amount: isNaN(parseFloat(raw.amount)) ? 0 : parseFloat(raw.amount),
        note: sanitizeString(raw.note),
    };
}

export function sanitizeMember(raw: any): Member {
    return {
        id: sanitizeString(raw.id) || generateId('member'),
        spId: sanitizeString(raw.spId),
        name: sanitizeString(raw.name) || "Unnamed Member",
        classNumber: sanitizeString(raw.classNumber),
    };
}

export function sanitizeUser(raw: any): User {
    return {
        username: sanitizeString(raw.username) || "InvalidUser",
        password: sanitizeString(raw.password), // Note: Password should be handled securely
        role: sanitizeUserRole(raw.role),
        classLed: sanitizeString(raw.classLed),
    };
}

export function sanitizeSettings(raw: any): Settings {
    const source: Record<string, unknown> = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
    const maxRaw = source.maxClasses;
    const parsedMaxClasses = typeof maxRaw === 'string'
        ? parseInt(maxRaw, 10)
        : typeof maxRaw === 'number'
            ? maxRaw
            : NaN;

    const enforceRaw = source.enforceDirectory;
    let enforceDirectory: boolean;
    if (typeof enforceRaw === 'boolean') {
        enforceDirectory = enforceRaw;
    } else if (typeof enforceRaw === 'string') {
        enforceDirectory = enforceRaw.trim().toLowerCase() !== 'false';
    } else {
        enforceDirectory = true;
    }

    const currencyRaw = source.currency;

    return {
        currency: typeof currencyRaw === 'string' ? sanitizeString(currencyRaw) || 'USD' : 'USD',
        maxClasses: Number.isFinite(parsedMaxClasses) && parsedMaxClasses > 0 ? parsedMaxClasses : 10,
        enforceDirectory,
        sharePointSiteUrl: sanitizeString(source.sharePointSiteUrl) || DEFAULT_SHAREPOINT_SITE_URL,
        sharePointEntriesListName: sanitizeString(source.sharePointEntriesListName) || DEFAULT_SHAREPOINT_ENTRIES_LIST_NAME,
        sharePointMembersListName: sanitizeString(source.sharePointMembersListName) || DEFAULT_SHAREPOINT_MEMBERS_LIST_NAME,
        sharePointHistoryListName: sanitizeString(source.sharePointHistoryListName) || DEFAULT_SHAREPOINT_HISTORY_LIST_NAME,
    };
}

export function sanitizeWeeklyHistoryRecord(raw: any): WeeklyHistoryRecord {
    const attendanceRaw = raw.attendance && typeof raw.attendance === 'object' ? raw.attendance : {};
    const adultsRaw = attendanceRaw.adults && typeof attendanceRaw.adults === 'object' ? attendanceRaw.adults : attendanceRaw;
    const visitorsRaw = attendanceRaw.visitors && typeof attendanceRaw.visitors === 'object' ? attendanceRaw.visitors : {};

    const parsedDate = new Date(raw.dateOfService);
    const dateOfService = (raw.dateOfService && !isNaN(parsedDate.getTime()))
        ? parsedDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    const legacyServiceTypes: string[] = Array.isArray(raw.serviceTypes) ? raw.serviceTypes : [];
    const serviceTypeInput: string = raw.serviceType ?? legacyServiceTypes[0] ?? '';

    const attendance: WeeklyHistoryAttendanceBreakdown = {
        adultsMale: normalizeNumber(adultsRaw.adultsMale ?? adultsRaw.male ?? adultsRaw.men ?? attendanceRaw.men),
        adultsFemale: normalizeNumber(adultsRaw.adultsFemale ?? adultsRaw.female ?? attendanceRaw.women),
        children: normalizeNumber(adultsRaw.children ?? attendanceRaw.children ?? attendanceRaw.junior),
        adherents: normalizeNumber(attendanceRaw.adherents),
        catechumens: normalizeNumber(attendanceRaw.catechumens),
        visitors: {
            total: normalizeNumber(visitorsRaw.total ?? attendanceRaw.visitors),
            names: sanitizeString(visitorsRaw.names ?? attendanceRaw.visitorNames),
            specialVisitorName: sanitizeString(visitorsRaw.specialVisitorName ?? attendanceRaw.specialVisitorName),
            specialVisitorPosition: sanitizeString(visitorsRaw.specialVisitorPosition ?? attendanceRaw.specialVisitorPosition),
            specialVisitorSummary: sanitizeString(visitorsRaw.specialVisitorSummary ?? attendanceRaw.specialVisitorSummary),
        },
    };

    const donationsRaw = raw.donations && typeof raw.donations === 'object' ? raw.donations : {};
    const donations: WeeklyHistoryDonations = {
        description: sanitizeString(donationsRaw.description || raw.specialDonationsDetails),
        quantity: sanitizeString(donationsRaw.quantity),
        donatedBy: sanitizeString(donationsRaw.donatedBy),
    };

    return {
        id: sanitizeString(raw.id) || generateId('history'),
        dateOfService: dateOfService,
        societyName: sanitizeString(raw.societyName),
        preacher: sanitizeString(raw.preacher) || sanitizeString(raw.officiant),
        guestPreacher: raw.guestPreacher === true || raw.guestPreacher === 'true',
        preacherSociety: sanitizeString(raw.preacherSociety),
        liturgist: sanitizeString(raw.liturgist),
        serviceType: sanitizeServiceType(serviceTypeInput),
        serviceTypeOther: sanitizeString(raw.serviceTypeOther),
        sermonTopic: sanitizeString(raw.sermonTopic),
        memoryText: sanitizeString(raw.memoryText),
        sermonSummary: sanitizeString(raw.sermonSummary) || sanitizeString(raw.worshipHighlights),
        worshipHighlights: sanitizeString(raw.worshipHighlights),
        announcementsBy: sanitizeString(raw.announcementsBy),
        announcementsKeyPoints: sanitizeString(raw.announcementsKeyPoints),
        attendance,
        newMembersDetails: sanitizeString(raw.newMembersDetails),
        newMembersContact: sanitizeString(raw.newMembersContact),
        donations,
        events: sanitizeString(raw.events),
        observations: sanitizeString(raw.observations),
        preparedBy: sanitizeString(raw.preparedBy),
    };
}

function normalizeNumber(value: any): number {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

// --- Enum Sanitizers ---

export function sanitizeEntryType(type: any): EntryType {
    const validTypes: EntryType[] = [
        "tithe",
        "offering",
        "thanksgiving-offering",
        "first-fruit",
        "pledge",
        "harvest-levy",
        "other",
    ];
    return validTypes.includes(type) ? type : "other";
}

export function sanitizeMethod(method: any): Method {
    const validMethods: Method[] = ["cash", "check", "card", "e-transfer", "mobile", "other"];
    return validMethods.includes(method) ? method : "cash";
}

export function sanitizeUserRole(role: any): UserRole {
    const validRoles: UserRole[] = ['admin', 'finance', 'class-leader', 'statistician'];
    return validRoles.includes(role) ? role : 'finance';
}

export function sanitizeAttendanceStatus(status: any): AttendanceStatus {
    const validStatuses: AttendanceStatus[] = ['present', 'absent', 'sick', 'travel'];
    return validStatuses.includes(status) ? status : 'absent';
}

export function sanitizeServiceType(type: any): ServiceType {
    const valid: ServiceType[] = ['communion', 'harvest', 'divine-service', 'teaching-service', 'other'];
    if (typeof type === 'string') {
        const normalized = type.trim().toLowerCase();
        const matched = valid.find(option => option === normalized || option === normalized.replace(' ', '-'));
        if (matched) return matched;
        const byLabel = valid.find(option => {
            const label = serviceTypeLabel(option).toLowerCase();
            return label === normalized;
        });
        if (byLabel) return byLabel;
    }
    return 'divine-service';
}

function sanitizeMemberAttendance(raw: any): MemberAttendance {
    return {
        memberId: sanitizeString(raw.memberId),
        status: sanitizeAttendanceStatus(raw.status),
    };
}

export function sanitizeAttendanceRecord(raw: any): AttendanceRecord {
    const recordsRaw = Array.isArray(raw?.records) ? raw.records : [];
    return {
        date: sanitizeString(raw?.date) || new Date().toISOString().slice(0, 10),
        records: recordsRaw.map(item => sanitizeMemberAttendance(item)),
    };
}

export function sanitizeEntriesCollection(raw: unknown): Entry[] {
    return Array.isArray(raw) ? raw.map(item => sanitizeEntry(item)) : [];
}

export function sanitizeMembersCollection(raw: unknown): Member[] {
    return Array.isArray(raw) ? raw.map(item => sanitizeMember(item)) : [];
}

export function sanitizeUsersCollection(raw: unknown, fallback: User[] = []): User[] {
    const users = Array.isArray(raw) ? raw.map(item => sanitizeUser(item)) : [];
    return users.length > 0 ? users : fallback;
}

export function sanitizeAttendanceCollection(raw: unknown): AttendanceRecord[] {
    return Array.isArray(raw) ? raw.map(item => sanitizeAttendanceRecord(item)) : [];
}

export function sanitizeWeeklyHistoryCollection(raw: unknown): WeeklyHistoryRecord[] {
    return Array.isArray(raw) ? raw.map(item => sanitizeWeeklyHistoryRecord(item)) : [];
}

export function serviceTypeLabel(type: ServiceType): string {
    switch (type) {
        case 'communion':
            return 'Communion';
        case 'harvest':
            return 'Harvest';
        case 'divine-service':
            return 'Divine Service';
        case 'teaching-service':
            return 'Teaching Service';
        case 'other':
        default:
            return 'Other';
    }
}


// --- CSV Handling ---

export function fromCsv(csvText: string): any[] {
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const obj: { [key: string]: any } = {};
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = values[j] ? values[j].trim() : '';
        }
        rows.push(obj);
    }
    return rows;
}

export function toCsv(data: any[]): string {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header];
                const strValue = (value === null || value === undefined) ? '' : String(value);
                // Handle commas within values by wrapping in quotes
                return strValue.includes(',') ? `"${strValue}"` : strValue;
            }).join(',')
        )
    ];
    return csvRows.join('\n');
}

// --- Formatting ---

export function formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount);
}
let fallbackCounter = 0;

function generateUuidFromCrypto(cryptoObj: Crypto | undefined): string | null {
    if (!cryptoObj) {
        return null;
    }

    if (typeof cryptoObj.randomUUID === 'function') {
        return cryptoObj.randomUUID();
    }

    if (typeof cryptoObj.getRandomValues === 'function') {
        const buffer = new Uint8Array(16);
        cryptoObj.getRandomValues(buffer);

        // Per RFC 4122, version 4 UUIDs set the version and variant bits explicitly
        buffer[6] = (buffer[6] & 0x0f) | 0x40;
        buffer[8] = (buffer[8] & 0x3f) | 0x80;

        const hex = Array.from(buffer, byte => byte.toString(16).padStart(2, '0'));
        return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
    }

    return null;
}

export function generateId(prefix: string = 'gmct'): string {
    try {
        const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis as typeof globalThis & { crypto?: Crypto }).crypto : undefined;
        const uuid = generateUuidFromCrypto(cryptoObj);
        if (uuid) {
            return uuid;
        }
    } catch (error) {
        console.warn('generateId: crypto API is unavailable, falling back to pseudo-random id generation.', error);
    }

    fallbackCounter = (fallbackCounter + 1) % 0x10000;
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).slice(2, 10);
    return `${prefix}-${timestamp}-${randomPart}-${fallbackCounter.toString(36).padStart(4, '0')}`;
}
