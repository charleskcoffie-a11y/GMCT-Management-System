import React, { useEffect, useMemo, useState } from 'react';
import type { AttendanceRecord, AttendanceStatus, Member, Settings, User } from '../types';
import { sanitizeAttendanceStatus } from '../utils';

interface AdminAttendanceViewProps {
    members: Member[];
    attendance: AttendanceRecord[];
    settings: Settings;
    currentUser: User;
}

const STATUSES: Array<'present' | 'absent' | 'sick' | 'travel'> = ['present', 'absent', 'sick', 'travel'];

const AdminAttendanceView: React.FC<AdminAttendanceViewProps> = ({ members, attendance, settings, currentUser }) => {
    const orderedRecords = useMemo(
        () => [...attendance].sort((a, b) => b.date.localeCompare(a.date)),
        [attendance],
    );

    const [selectedDate, setSelectedDate] = useState<string>(() => orderedRecords[0]?.date ?? '');
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [memberFilter, setMemberFilter] = useState('');

    useEffect(() => {
        if (orderedRecords.length === 0) {
            setSelectedDate('');
            setSelectedMemberId(null);
            return;
        }
        setSelectedDate(prev => (prev && orderedRecords.some(record => record.date === prev) ? prev : orderedRecords[0].date));
    }, [orderedRecords]);

    const summary = useMemo(() => {
        const perDate = orderedRecords.map(record => {
            const stats = record.records.reduce(
                (acc, item) => {
                    const status = sanitizeAttendanceStatus(item.status);
                    acc[status] = (acc[status] ?? 0) + 1;
                    return acc;
                },
                {} as Record<string, number>,
            );
            return { date: record.date, stats };
        });

        const totals = orderedRecords.reduce<Record<string, number>>((acc, record) => {
            record.records.forEach(item => {
                const status = sanitizeAttendanceStatus(item.status);
                acc[status] = (acc[status] ?? 0) + 1;
            });
            return acc;
        }, {});

        return { perDate, totals };
    }, [orderedRecords]);

    const selectedRecord = useMemo(
        () => orderedRecords.find(record => record.date === selectedDate),
        [orderedRecords, selectedDate],
    );

    const selectedStats = useMemo(() => {
        if (!selectedRecord) return {} as Record<string, number>;
        return selectedRecord.records.reduce((acc, item) => {
            const status = sanitizeAttendanceStatus(item.status);
            acc[status] = (acc[status] ?? 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [selectedRecord]);

    const classGroups = useMemo(() => {
        if (!selectedRecord) return [] as Array<{ label: string; members: Array<{ member: Member | undefined; status: AttendanceStatus }>; counts: Record<AttendanceStatus, number> }>;
        const statusMap = new Map<string, AttendanceStatus>();
        selectedRecord.records.forEach(entry => {
            statusMap.set(entry.memberId, sanitizeAttendanceStatus(entry.status));
        });

        const groups = new Map<string, { label: string; members: Array<{ member: Member | undefined; status: AttendanceStatus }>; counts: Record<AttendanceStatus, number> }>();

        members.forEach(member => {
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
            group.counts[status] = (group.counts[status] ?? 0) + 1;
        });

        const sortedGroups = Array.from(groups.values()).sort((a, b) => {
            const classNumber = (label: string) => {
                const match = label.match(/Class (\d+)/);
                return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
            };
            const aValue = classNumber(a.label);
            const bValue = classNumber(b.label);
            if (aValue !== bValue) return aValue - bValue;
            return a.label.localeCompare(b.label);
        });
        sortedGroups.forEach(group => {
            group.members.sort((a, b) => (a.member?.name ?? '').localeCompare(b.member?.name ?? ''));
        });
        return sortedGroups;
    }, [members, selectedRecord]);

    const filteredClassGroups = useMemo(() => {
        const query = memberFilter.trim().toLowerCase();
        if (!query) return classGroups;
        return classGroups
            .map(group => {
                const membersInGroup = group.members.filter(row => {
                    const name = row.member?.name?.toLowerCase() ?? '';
                    const id = row.member?.id?.toLowerCase() ?? '';
                    return name.includes(query) || id.includes(query);
                });
                const counts = membersInGroup.reduce(
                    (acc, row) => {
                        acc[row.status] = (acc[row.status] ?? 0) + 1;
                        return acc;
                    },
                    { present: 0, absent: 0, sick: 0, travel: 0 } as Record<AttendanceStatus, number>,
                );
                return { ...group, members: membersInGroup, counts };
            })
            .filter(group => group.members.length > 0);
    }, [classGroups, memberFilter]);

    const selectedMember = members.find(member => member.id === selectedMemberId);

    const selectedMemberHistory = useMemo(() => {
        if (!selectedMemberId) return [] as Array<{ date: string; status: string }>;
        return orderedRecords
            .map(record => {
                const status = record.records.find(item => item.memberId === selectedMemberId)?.status;
                return { date: record.date, status: status ? sanitizeAttendanceStatus(status) : 'absent' };
            })
            .filter(item => item.status)
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [orderedRecords, selectedMemberId]);

    return (
        <div className="space-y-6">
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-violet-100/70 p-6">
                <h2 className="text-2xl font-bold text-slate-800">Attendance Overview</h2>
                <p className="text-slate-500">{members.length} members tracked. Viewing as {currentUser.role}.</p>
                <p className="text-sm text-slate-500">Attendance categories are aggregated across {attendance.length} service dates.</p>
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-emerald-50 to-lime-100/70 p-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Totals</h3>
                {Object.keys(summary.totals).length === 0 ? (
                    <p className="text-slate-500">No attendance has been recorded yet.</p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(summary.totals).map(([status, count]) => (
                            <div key={status} className="rounded-2xl p-4 shadow-sm border border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100/70">
                                <h4 className="text-sm font-semibold text-slate-500 uppercase">{status}</h4>
                                <p className="text-2xl font-bold text-slate-800">{count}</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-sky-50 to-cyan-100/70 p-6 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h3 className="text-xl font-semibold text-slate-800">By Service Date</h3>
                        <p className="text-sm text-slate-500">Select a date to inspect attendance and drill into member history.</p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-3 md:items-center">
                        {orderedRecords.length > 0 && (
                            <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2">
                                {orderedRecords.map(record => (
                                    <option key={record.date} value={record.date}>{record.date}</option>
                                ))}
                            </select>
                        )}
                        <input
                            value={memberFilter}
                            onChange={e => setMemberFilter(e.target.value)}
                            placeholder="Filter members by name or ID"
                            className="border border-slate-300 rounded-lg px-3 py-2 w-full md:w-64"
                        />
                    </div>
                </div>
                {summary.perDate.length === 0 ? (
                    <p className="text-slate-500">No attendance records to display.</p>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {STATUSES.map(status => (
                                <div key={status} className="rounded-2xl bg-white/70 border border-white/60 px-4 py-3">
                                    <p className="text-xs uppercase font-semibold text-slate-500">{status}</p>
                                    <p className="text-xl font-bold text-slate-800">{selectedStats[status] ?? 0}</p>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-4">
                            {!selectedRecord ? (
                                <p className="text-slate-500">No attendance captured for {selectedDate}.</p>
                            ) : filteredClassGroups.length === 0 ? (
                                <p className="text-slate-500">{memberFilter ? 'No members match your filter.' : 'No members found for the selected criteria.'}</p>
                            ) : (
                                filteredClassGroups.map(group => (
                                    <div key={group.label} className="rounded-2xl border border-white/60 bg-white/80 p-4 space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <h4 className="text-lg font-semibold text-slate-800">{group.label}</h4>
                                            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                                {STATUSES.map(status => (
                                                    <span key={status} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                                                        {status}: {group.counts[status] ?? 0}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                            {group.members.map((row, index) => (
                                                <div key={row.member?.id ?? `${group.label}-${index}`} className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3 flex items-center justify-between">
                                                    <div>
                                                        {row.member ? (
                                                            <button onClick={() => setSelectedMemberId(row.member?.id ?? null)} className="font-semibold text-indigo-600 hover:text-indigo-700">
                                                                {row.member.name}
                                                            </button>
                                                        ) : (
                                                            <span className="font-semibold text-slate-500">Unknown member</span>
                                                        )}
                                                        <p className="text-xs text-slate-500 break-all">{row.member?.id ?? 'ID unavailable'}</p>
                                                    </div>
                                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full capitalize ${row.status === 'present' ? 'bg-emerald-100 text-emerald-700' : row.status === 'sick' ? 'bg-amber-100 text-amber-700' : row.status === 'travel' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {row.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-slate-600">Quick overview</h4>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {summary.perDate.map(record => (
                                    <div key={record.date} className={`px-3 py-2 rounded-2xl border text-xs ${record.date === selectedDate ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                                        <p className="font-semibold">{record.date}</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {STATUSES.map(status => (
                                                <span key={status} className="uppercase tracking-wide">
                                                    {status[0]}:{record.stats[status] ?? 0}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <p className="text-xs text-slate-400">Class limit configured to {settings.maxClasses}. Ensure member class assignments are up to date for accurate reporting.</p>

            {selectedMember && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="w-full max-w-lg rounded-3xl border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-sky-100/80 shadow-xl">
                        <header className="flex items-center justify-between px-6 py-4 border-b border-white/60">
                            <div>
                                <h3 className="text-xl font-semibold text-slate-800">{selectedMember.name}</h3>
                                <p className="text-sm text-slate-500">Attendance history</p>
                            </div>
                            <button onClick={() => setSelectedMemberId(null)} className="text-slate-500 hover:text-slate-700">Close</button>
                        </header>
                        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-3">
                            {selectedMemberHistory.length === 0 ? (
                                <p className="text-slate-500 text-sm">No history recorded yet.</p>
                            ) : (
                                selectedMemberHistory.map(item => (
                                    <div key={`${item.date}-${item.status}`} className="flex items-center justify-between rounded-2xl bg-white/80 border border-white/60 px-4 py-3">
                                        <span className="font-medium text-slate-700">{item.date}</span>
                                        <span className="capitalize text-slate-600">{item.status}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAttendanceView;
