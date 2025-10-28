export type EntryType = "tithe" | "offering" | "thanksgiving-offering" | "first-fruit" | "pledge" | "harvest-levy" | "other";
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

export type ServiceType = 'communion' | 'harvest' | 'divine-service' | 'teaching-service' | 'other';

export interface WeeklyHistoryVisitorsInfo {
    total: number;
    names: string;
    specialVisitorName: string;
    specialVisitorPosition: string;
    specialVisitorSummary: string;
}

export interface WeeklyHistoryAttendanceBreakdown {
    adultsMale: number;
    adultsFemale: number;
    children: number;
    adherents: number;
    catechumens: number;
    visitors: WeeklyHistoryVisitorsInfo;
}

export interface WeeklyHistoryDonations {
    description: string;
    quantity: string;
    donatedBy: string;
}

export interface WeeklyHistoryRecord {
    id: string;
    dateOfService: string; // ISO format YYYY-MM-DD
    societyName: string;
    preacher: string;
    guestPreacher: boolean;
    preacherSociety: string;
    liturgist: string;
    serviceType: ServiceType;
    serviceTypeOther: string;
    sermonTopic: string;
    memoryText: string;
    sermonSummary: string;
    worshipHighlights: string;
    announcementsBy: string;
    announcementsKeyPoints: string;
    attendance: WeeklyHistoryAttendanceBreakdown;
    newMembersDetails: string;
    newMembersContact: string;
    donations: WeeklyHistoryDonations;
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