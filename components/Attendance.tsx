import React, { useEffect, useMemo, useState } from 'react';
import type { AttendanceRecord, AttendanceStatus, Member, Settings, User } from '../types';
import { sanitizeAttendanceStatus } from '../utils';

interface AttendanceProps {
    members: Member[];
    attendance: AttendanceRecord[];
    setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
    currentUser: User;
    settings: Settings;
    onAttendanceSaved: (timestamp: number) => void;
}

type StatusOption = {
    value: AttendanceStatus;
    label: string;
    description?: string;
    activeClass: string;
    inactiveClass: string;
};

const STATUS_OPTIONS: StatusOption[] = [
    {
        value: 'present',
        label: 'Present',
        description: 'Counted in attendance',
        activeClass: 'bg-emerald-600 text-white border-emerald-500',
        inactiveClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    },
    {
        value: 'sick',
        label: 'Sick',
        description: 'Unable to attend due to illness',
        activeClass: 'bg-amber-500 text-white border-amber-400',
        inactiveClass: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    },
    {
        value: 'travel',
        label: 'Travelling',
        description: 'Away on official or personal travel',
        activeClass: 'bg-sky-600 text-white border-sky-500',
        inactiveClass: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
    },
    {
        value: 'absent',
        label: 'Mark Absent',
        description: 'Remove from the selected list',
        activeClass: 'bg-slate-600 text-white border-slate-500',
        inactiveClass: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200',
    },
];

const statusLabel: Record<AttendanceStatus, string> = {
    present: 'Present',
    absent: 'Absent',
    sick: 'Sick',
    travel: 'Travelling',
};

const Attendance: React.FC<AttendanceProps> = ({ members, attendance, setAttendance, currentUser, settings: _settings, onAttendanceSaved }) => {
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [memberQuery, setMemberQuery] = useState('');
    const [selectedStatuses, setSelectedStatuses] = useState<Record<string, AttendanceStatus>>({});
    const [confirmation, setConfirmation] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(true);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const scopedMembers = useMemo(() => {
        if (currentUser.role === 'class-leader' && currentUser.classLed) {
            return members.filter(member => member.classNumber === currentUser.classLed);
        }
        return members;
    }, [members, currentUser]);

    const scopedMemberIds = useMemo(() => new Set(scopedMembers.map(member => member.id)), [scopedMembers]);

    const memberLookup = useMemo(() => new Map(members.map(member => [member.id, member])), [members]);

    const record = useMemo(
        () => attendance.find(item => item.date === date),
        [attendance, date],
    );

    useEffect(() => {
        setConfirmation(null);
        setMemberQuery('');
        setIsEditing(record ? false : true);
    }, [date, record]);

    const baselineSelection = useMemo(() => {
        if (!record) return {} as Record<string, AttendanceStatus>;
        const selection: Record<string, AttendanceStatus> = {};
        for (const item of record.records) {
            if (!scopedMemberIds.has(item.memberId)) continue;
            const sanitized = sanitizeAttendanceStatus(item.status);
            if (sanitized !== 'absent') {
                selection[item.memberId] = sanitized;
            }
        }
        return selection;
    }, [record, scopedMemberIds]);

    useEffect(() => {
        if (!isEditing) return;
        setSelectedStatuses(baselineSelection);
    }, [baselineSelection, isEditing]);

    const availableMembers = useMemo(() => {
        const query = memberQuery.trim().toLowerCase();
        if (!query) return [] as Member[];
        return scopedMembers
            .filter(member => !selectedStatuses[member.id])
            .filter(member => {
                const name = member.name.toLowerCase();
                const id = member.id.toLowerCase();
                return name.includes(query) || id.includes(query);
            })
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 8);
    }, [memberQuery, scopedMembers, selectedStatuses]);

    const selectedEntries = useMemo(() => {
        const entries = Object.entries(selectedStatuses)
            .map(([memberId, status]) => {
                const member = memberLookup.get(memberId);
                return member && scopedMemberIds.has(memberId) ? { member, status } : null;
            })
            .filter((entry): entry is { member: Member; status: AttendanceStatus } => Boolean(entry));

        const direction = sortDirection === 'asc' ? 1 : -1;

        entries.sort((a, b) => {
            const classA = a.member.classNumber ? Number(a.member.classNumber) : direction === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
            const classB = b.member.classNumber ? Number(b.member.classNumber) : direction === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
            if (classA !== classB) {
                return (classA - classB) * direction;
            }
            return a.member.name.localeCompare(b.member.name) * direction;
        });

        return entries;
    }, [selectedStatuses, memberLookup, scopedMemberIds, sortDirection]);

    const hasChanges = useMemo(() => {
        const baselineEntries = Object.entries(baselineSelection).sort(([a], [b]) => a.localeCompare(b));
        const currentEntries = Object.entries(selectedStatuses).sort(([a], [b]) => a.localeCompare(b));
        if (baselineEntries.length !== currentEntries.length) return true;
        return currentEntries.some(([memberId, status], index) => {
            const [baseId, baseStatus] = baselineEntries[index];
            return memberId !== baseId || status !== baseStatus;
        });
    }, [baselineSelection, selectedStatuses]);

    const summaryByClass = useMemo(() => {
        const groups = new Map<string, { label: string; members: Array<{ member: Member; status: AttendanceStatus }>; counts: Record<AttendanceStatus, number> }>();

        const statusMap = new Map<string, AttendanceStatus>();
        if (record) {
            record.records.forEach(item => {
                if (scopedMemberIds.has(item.memberId)) {
                    statusMap.set(item.memberId, sanitizeAttendanceStatus(item.status));
                }
            });
        }

        scopedMembers.forEach(member => {
            const status = statusMap.get(member.id) ?? 'absent';
            const key = member.classNumber ?? 'unassigned';
            const label = member.classNumber ? `Class ${member.classNumber}` : 'No Class Assigned';
            if (!groups.has(key)) {
                groups.set(key, {
                    label,
                    members: [],
                    counts: { present: 0, absent: 0, sick: 0, travel: 0 },
                });
            }
            const group = groups.get(key)!;
            group.members.push({ member, status });
            group.counts[status] += 1;
        });

        return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [record, scopedMemberIds, scopedMembers]);

    const totalSummary = useMemo(() => {
        return summaryByClass.reduce(
            (acc, group) => {
                (Object.keys(group.counts) as AttendanceStatus[]).forEach(status => {
                    acc[status] += group.counts[status];
                });
                return acc;
            },
            { present: 0, absent: 0, sick: 0, travel: 0 } as Record<AttendanceStatus, number>,
        );
    }, [summaryByClass]);

    const handleSelectMember = (memberId: string) => {
        if (!scopedMemberIds.has(memberId)) return;
        setSelectedStatuses(prev => ({ ...prev, [memberId]: prev[memberId] ?? 'present' }));
        setMemberQuery('');
    };

    const handleStatusChange = (memberId: string, status: AttendanceStatus) => {
        setSelectedStatuses(prev => {
            const next = { ...prev };
            if (status === 'absent') {
                delete next[memberId];
            } else {
                next[memberId] = status;
            }
            return next;
        });
    };

    const handleSave = () => {
        const scopedRecords = scopedMembers.map(member => ({
            memberId: member.id,
            status: selectedStatuses[member.id] ?? 'absent',
        }));

        const remainingRecords = record?.records.filter(item => !scopedMemberIds.has(item.memberId)) ?? [];
        const mergedRecords = [...remainingRecords, ...scopedRecords];

        setAttendance(prev => {
            const index = prev.findIndex(item => item.date === date);
            if (index === -1) {
                return [...prev, { date, records: mergedRecords }];
            }
            const next = [...prev];
            next[index] = { date, records: mergedRecords };
            return next;
        });

        setConfirmation('Attendance successfully saved.');
        setIsEditing(false);
        onAttendanceSaved(Date.now());
    };

    return (
        <div className="space-y-6">
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-lime-50 to-emerald-100/70 p-6 space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Mark Attendance</h2>
                        <p className="text-slate-500">Search for members to record their status. Everyone else will be marked absent automatically.</p>
                    </div>
                    <label className="flex flex-col md:flex-row md:items-center gap-2 text-sm font-semibold text-slate-600">
                        Service date
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </label>
                </div>
                {record && !isEditing && (
                    <div className="rounded-2xl border border-emerald-200 bg-white/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-emerald-700">Attendance already captured for this date.</p>
                            <p className="text-xs text-slate-500">Use the Edit button to make updates or add new statuses.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setIsEditing(true); setConfirmation(null); setMemberQuery(''); }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg"
                        >
                            Edit attendance
                        </button>
                    </div>
                )}
                {confirmation && (
                    <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm font-semibold" role="status">
                        {confirmation}
                    </div>
                )}
            </section>

            {isEditing ? (
                <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-cyan-50 to-sky-100/70 p-6 space-y-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h3 className="text-xl font-semibold text-slate-800">Select members</h3>
                            <p className="text-sm text-slate-500">Search by name or ID to add members who are Present, Sick, or Travelling.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                            className="self-start lg:self-auto bg-white/80 border border-sky-200 text-sky-700 font-semibold px-4 py-2 rounded-lg hover:bg-white"
                        >
                            Sort by Class {sortDirection === 'asc' ? '↑' : '↓'}
                        </button>
                    </div>
                    <div className="relative">
                        <input
                            value={memberQuery}
                            onChange={e => setMemberQuery(e.target.value)}
                            placeholder="Type a member name or ID to add them"
                            className="border border-slate-300 rounded-lg px-3 py-2 w-full"
                        />
                        {availableMembers.length > 0 && (
                            <ul className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                                {availableMembers.map(member => (
                                    <li key={member.id}>
                                        <button
                                            type="button"
                                            onClick={() => handleSelectMember(member.id)}
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100"
                                        >
                                            <span className="font-semibold text-slate-800">{member.name}</span>
                                            <span className="block text-xs text-slate-500">{member.id} • {member.classNumber ? `Class ${member.classNumber}` : 'No class assigned'}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <p className="text-xs text-slate-500">Members not added to this list remain marked as Absent.</p>
                    <div className="rounded-3xl border border-white/60 bg-white/70 p-4">
                        {selectedEntries.length === 0 ? (
                            <p className="text-slate-500 text-sm">No members selected yet. Search above to start tracking attendance for this date.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[28rem] overflow-y-auto pr-1">
                                {selectedEntries.map(({ member, status }) => (
                                    <div key={member.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm flex flex-col gap-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-slate-800">{member.name}</p>
                                                <p className="text-xs text-slate-500 break-all">{member.id}</p>
                                                <p className="text-xs text-slate-500">{member.classNumber ? `Class ${member.classNumber}` : 'No class assigned'}</p>
                                            </div>
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status === 'present' ? 'bg-emerald-100 text-emerald-700' : status === 'sick' ? 'bg-amber-100 text-amber-700' : status === 'travel' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {statusLabel[status]}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {STATUS_OPTIONS.map(option => (
                                                <button
                                                    type="button"
                                                    key={option.value}
                                                    onClick={() => handleStatusChange(member.id, option.value)}
                                                    className={`px-3 py-1.5 rounded-full border text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-200 ${status === option.value ? option.activeClass : option.inactiveClass}`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleStatusChange(member.id, 'absent')}
                                            className="self-start text-xs font-semibold text-slate-500 hover:text-slate-700"
                                        >
                                            Remove from list
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {hasChanges && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleSave}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2 rounded-lg shadow-sm"
                            >
                                Save Attendance
                            </button>
                        </div>
                    )}
                </section>
            ) : (
                <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-violet-100/70 p-6 space-y-6">
                    <div className="flex flex-col gap-2">
                        <h3 className="text-xl font-semibold text-slate-800">Attendance Summary</h3>
                        <p className="text-sm text-slate-500">Grouped by class for {date}. Select “Edit attendance” above to make changes.</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(Object.keys(totalSummary) as AttendanceStatus[]).map(status => (
                            <div key={status} className="rounded-2xl bg-white/80 border border-white/60 px-4 py-3">
                                <p className="text-xs uppercase font-semibold text-slate-500">{statusLabel[status]}</p>
                                <p className="text-2xl font-bold text-slate-800">{totalSummary[status]}</p>
                            </div>
                        ))}
                    </div>
                    <div className="space-y-4">
                        {summaryByClass.map(group => (
                            <div key={group.label} className="rounded-2xl border border-white/60 bg-white/80 p-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="text-lg font-semibold text-slate-800">{group.label}</h4>
                                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                        {(Object.keys(group.counts) as AttendanceStatus[]).map(status => (
                                            <span key={status} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                                                {statusLabel[status]}: {group.counts[status]}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {group.members.map(({ member, status }) => (
                                        <div key={member.id} className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3 flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold text-slate-800">{member.name}</p>
                                                <p className="text-xs text-slate-500 break-all">{member.id}</p>
                                            </div>
                                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${status === 'present' ? 'bg-emerald-100 text-emerald-700' : status === 'sick' ? 'bg-amber-100 text-amber-700' : status === 'travel' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {statusLabel[status]}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default Attendance;
