// utils.ts
import { v4 as uuidv4 } from 'uuid';
import type { Entry, EntryType, Member, Method, User, UserRole, AttendanceStatus, Settings, WeeklyHistoryRecord } from './types';

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
    return {
        currency: sanitizeString(raw.currency) || 'USD',
        maxClasses: typeof raw.maxClasses === 'number' && raw.maxClasses > 0 ? raw.maxClasses : 10,
        enforceDirectory: typeof raw.enforceDirectory === 'boolean' ? raw.enforceDirectory : true,
    }
}

export function sanitizeWeeklyHistoryRecord(raw: any): WeeklyHistoryRecord {
    const attendance = raw.attendance && typeof raw.attendance === 'object' ? raw.attendance : {};

    const parsedDate = new Date(raw.dateOfService);
    const dateOfService = (raw.dateOfService && !isNaN(parsedDate.getTime()))
        ? parsedDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    
    return {
        id: sanitizeString(raw.id) || uuidv4(),
        dateOfService: dateOfService,
        societyName: sanitizeString(raw.societyName),
        officiant: sanitizeString(raw.officiant),
        liturgist: sanitizeString(raw.liturgist),
        serviceTypes: Array.isArray(raw.serviceTypes) ? raw.serviceTypes.map(sanitizeString) : [],
        serviceTypeOther: sanitizeString(raw.serviceTypeOther),
        sermonTopic: sanitizeString(raw.sermonTopic),
        worshipHighlights: sanitizeString(raw.worshipHighlights),
        announcementsBy: sanitizeString(raw.announcementsBy),
        attendance: {
            men: isNaN(parseInt(attendance.men, 10)) ? 0 : parseInt(attendance.men, 10),
            women: isNaN(parseInt(attendance.women, 10)) ? 0 : parseInt(attendance.women, 10),
            junior: isNaN(parseInt(attendance.junior, 10)) ? 0 : parseInt(attendance.junior, 10),
            adherents: isNaN(parseInt(attendance.adherents, 10)) ? 0 : parseInt(attendance.adherents, 10),
            visitors: isNaN(parseInt(attendance.visitors, 10)) ? 0 : parseInt(attendance.visitors, 10),
            catechumens: isNaN(parseInt(attendance.catechumens, 10)) ? 0 : parseInt(attendance.catechumens, 10),
        },
        newMembersDetails: sanitizeString(raw.newMembersDetails),
        newMembersContact: sanitizeString(raw.newMembersContact),
        specialDonationsDetails: sanitizeString(raw.specialDonationsDetails),
        events: sanitizeString(raw.events),
        observations: sanitizeString(raw.observations),
        preparedBy: sanitizeString(raw.preparedBy),
    };
}

// --- Enum Sanitizers ---

export function sanitizeEntryType(type: any): EntryType {
    const validTypes: EntryType[] = ["tithe", "offering", "first-fruit", "pledge", "harvest-levy", "other"];
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