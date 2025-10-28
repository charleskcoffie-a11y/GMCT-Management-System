import React, { useEffect, useMemo, useState } from 'react';
import type { AttendanceRecord, Member, Settings, User } from '../types';
import { sanitizeAttendanceStatus } from '../utils';

interface AdminAttendanceViewProps {
    members: Member[];
    attendance: AttendanceRecord[];
    settings: Settings;
    currentUser: User;
}

const STATUSES: Array<'present' | 'absent' | 'sick' | 'travel' | 'catechumen'> = ['present', 'absent', 'sick', 'travel', 'catechumen'];

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

    const memberRows = useMemo(() => {
        if (!selectedRecord) return [] as Array<{ member: Member | undefined; status: string }>;
        const map = new Map(members.map(member => [member.id, member]));
        const baseRows = selectedRecord.records
            .map(entry => ({ member: map.get(entry.memberId), status: sanitizeAttendanceStatus(entry.status) }))
            .sort((a, b) => (a.member?.name ?? '').localeCompare(b.member?.name ?? ''));

        const query = memberFilter.trim().toLowerCase();
        if (!query) return baseRows;
        return baseRows.filter(row => {
            const name = row.member?.name?.toLowerCase() ?? '';
            const id = row.member?.id?.toLowerCase() ?? '';
            return name.includes(query) || id.includes(query);
        });
    }, [members, selectedRecord, memberFilter]);

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
                        <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/80">
                            <table className="w-full text-left text-slate-600">
                                <thead className="uppercase text-sm text-slate-500 border-b bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-2">Member</th>
                                        <th className="px-4 py-2">Class</th>
                                        <th className="px-4 py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {memberRows.map((row, index) => (
                                        <tr key={row.member?.id ?? `${selectedDate}-${row.status}-${index}`} className="border-b last:border-0">
                                            <td className="px-4 py-2">
                                                {row.member ? (
                                                    <button onClick={() => setSelectedMemberId(row.member?.id ?? null)} className="font-semibold text-indigo-600 hover:text-indigo-700">
                                                        {row.member.name}
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-500">Unknown member</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2">{row.member?.classNumber ? `Class ${row.member.classNumber}` : '—'}</td>
                                            <td className="px-4 py-2 capitalize">{row.status}</td>
                                        </tr>
                                    ))}
                                    {memberRows.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                                                {memberFilter ? 'No members match your filter.' : `No attendance captured for ${selectedDate}.`}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
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
