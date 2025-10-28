// utils.ts
import { v4 as uuidv4 } from 'uuid';
import type {
    Entry,
    EntryType,
    Member,
    Method,
    User,
    UserRole,
    AttendanceStatus,
    Settings,
    WeeklyHistoryRecord,
    ServiceType,
    WeeklyHistoryAttendanceBreakdown,
    WeeklyHistoryDonations,
} from './types';

// --- String & Sanitization ---

export function sanitizeString(input: any): string {
    if (typeof input === 'string') {
        // Basic trim and santize. In a real app, you might use a library like DOMPurify.
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
        id: sanitizeString(raw.id) || uuidv4(),
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
        id: sanitizeString(raw.id) || uuidv4(),
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
        id: sanitizeString(raw.id) || uuidv4(),
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
    const validStatuses: AttendanceStatus[] = ['present', 'absent', 'sick', 'travel', 'catechumen'];
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