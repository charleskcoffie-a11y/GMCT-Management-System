import React, { useMemo } from 'react';
import type { AttendanceRecord, Member, Settings, User } from '../types';

interface AdminAttendanceViewProps {
    members: Member[];
    attendance: AttendanceRecord[];
    settings: Settings;
    currentUser: User;
}

const AdminAttendanceView: React.FC<AdminAttendanceViewProps> = ({ members, attendance, settings, currentUser }) => {
    const summary = useMemo(() => {
        const perDate = attendance.map(record => {
            const stats = record.records.reduce(
                (acc, item) => {
                    acc[item.status] = (acc[item.status] ?? 0) + 1;
                    return acc;
                },
                {} as Record<string, number>,
            );
            return { date: record.date, stats };
        });

        const totals = attendance.reduce<Record<string, number>>((acc, record) => {
            record.records.forEach(item => {
                acc[item.status] = (acc[item.status] ?? 0) + 1;
            });
            return acc;
        }, {});

        return { perDate, totals };
    }, [attendance]);

    return (
        <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                <h2 className="text-2xl font-bold text-slate-800">Attendance Overview</h2>
                <p className="text-slate-500">{members.length} members tracked. Viewing as {currentUser.role}.</p>
                <p className="text-sm text-slate-500">Attendance categories are aggregated across {attendance.length} service dates.</p>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Totals</h3>
                {Object.keys(summary.totals).length === 0 ? (
                    <p className="text-slate-500">No attendance has been recorded yet.</p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(summary.totals).map(([status, count]) => (
                            <div key={status} className="border border-slate-200 rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-slate-500 uppercase">{status}</h4>
                                <p className="text-2xl font-bold text-slate-800">{count}</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-4">By Service Date</h3>
                {summary.perDate.length === 0 ? (
                    <p className="text-slate-500">No attendance records to display.</p>
                ) : (
                    <table className="w-full text-left text-slate-600">
                        <thead className="uppercase text-sm text-slate-500 border-b">
                            <tr>
                                <th className="px-4 py-2">Date</th>
                                <th className="px-4 py-2">Breakdown</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summary.perDate.map(record => (
                                <tr key={record.date} className="border-b last:border-0">
                                    <td className="px-4 py-2 font-medium text-slate-800">{record.date}</td>
                                    <td className="px-4 py-2">
                                        <div className="flex flex-wrap gap-2 text-sm text-slate-500">
                                            {Object.entries(record.stats).map(([status, count]) => (
                                                <span key={status} className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md">{status}: {count}</span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            <p className="text-xs text-slate-400">Class limit configured to {settings.maxClasses}. Ensure member class assignments are up to date for accurate reporting.</p>
        </div>
    );
};

export default AdminAttendanceView;
