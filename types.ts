export type EntryType = "tithe" | "offering" | "first-fruit" | "pledge" | "harvest-levy" | "other";
export type Method = "cash" | "check" | "card" | "e-transfer" | "mobile" | "other";

export interface Entry {
    id: string;
    date: string; // ISO format YYYY-MM-DD
    memberID: string;
    memberName: string;
    type: EntryType;
    fund: string;
    method: Method;
    amount: number;
    note?: string;
}

export interface Member {
    id: string; // Our app's UUID
    spId?: string; // SharePoint's internal list item ID
    name: string;
    classNumber?: string;
}

export interface Settings {
    currency: string;
    maxClasses: number;
    enforceDirectory: boolean; // if true, member names must be selected from the directory
}

export type UserRole = 'admin' | 'finance' | 'class-leader' | 'statistician';

export interface User {
    username: string;
    password?: string; // Should be hashed in a real app, but plain for this exercise
    role: UserRole;
    classLed?: string; // Class number if role is 'class-leader'
}

export type AttendanceStatus = 'present' | 'absent' | 'sick' | 'travel' | 'catechumen';

export interface MemberAttendance {
    memberId: string;
    status: AttendanceStatus;
}

export interface AttendanceRecord {
    date: string; // ISO format YYYY-MM-DD
    records: MemberAttendance[];
}

export interface WeeklyHistoryRecord {
    id: string;
    dateOfService: string; // ISO format YYYY-MM-DD
    societyName: string;
    officiant: string;
    liturgist: string;
    serviceTypes: string[]; // e.g., ['Divine Service', 'Communion']
    serviceTypeOther: string;
    sermonTopic: string;
    worshipHighlights: string;
    announcementsBy: string;
    attendance: {
        men: number;
        women: number;
        junior: number;
        adherents: number;
        visitors: number;
        catechumens: number;
    };
    newMembersDetails: string;
    newMembersContact: string;
    specialDonationsDetails: string;
    events: string;
    observations: string;
    preparedBy: string;
}

export type Tab = 'home' | 'records' | 'members' | 'insights' | 'users' | 'settings' | 'attendance' | 'admin-attendance' | 'utilities' | 'history';

export interface CloudState {
  ready: boolean;
  signedIn: boolean;
  account?: any;
  accessToken?: string;
  message: string;
}