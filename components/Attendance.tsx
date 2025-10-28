import React, { useMemo, useState } from 'react';
import type { AttendanceRecord, AttendanceStatus, Member, Settings, User } from '../types';

interface AttendanceProps {
    members: Member[];
    attendance: AttendanceRecord[];
    setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
    currentUser: User;
    settings: Settings;
}

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'sick', 'travel', 'catechumen'];

const Attendance: React.FC<AttendanceProps> = ({ members, attendance, setAttendance, currentUser, settings }) => {
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

    const filteredMembers = useMemo(() => {
        if (currentUser.role === 'class-leader' && currentUser.classLed) {
            return members.filter(member => member.classNumber === currentUser.classLed);
        }
        return members;
    }, [members, currentUser]);

    const record = useMemo(() => attendance.find(item => item.date === date), [attendance, date]);

    const getStatus = (memberId: string): AttendanceStatus => {
        const status = record?.records.find(item => item.memberId === memberId)?.status;
        return status ?? 'absent';
    };

    const updateStatus = (memberId: string, status: AttendanceStatus) => {
        setAttendance(prev => {
            const existingIndex = prev.findIndex(item => item.date === date);
            if (existingIndex === -1) {
                return [...prev, { date, records: [{ memberId, status }] }];
            }
            const updatedRecords = [...prev[existingIndex].records];
            const recordIndex = updatedRecords.findIndex(item => item.memberId === memberId);
            if (recordIndex === -1) {
                updatedRecords.push({ memberId, status });
            } else {
                updatedRecords[recordIndex] = { memberId, status };
            }
            const next = [...prev];
            next[existingIndex] = { date, records: updatedRecords };
            return next;
        });
    };

    return (
        <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                <h2 className="text-2xl font-bold text-slate-800">Mark Attendance</h2>
                <p className="text-slate-500">Select the service date and update each member's status.</p>
                <div className="mt-4">
                    <label className="text-sm font-semibold text-slate-600">Service date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 ml-2" />
                </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-slate-800">Members ({filteredMembers.length})</h3>
                    <span className="text-sm text-slate-500">Class limit: {settings.maxClasses}</span>
                </div>
                {filteredMembers.length === 0 ? (
                    <p className="text-slate-500">No members assigned to your view.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-slate-600">
                            <thead className="uppercase text-sm text-slate-500 border-b">
                                <tr>
                                    <th className="px-4 py-2">Name</th>
                                    <th className="px-4 py-2">Class</th>
                                    <th className="px-4 py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMembers.map(member => (
                                    <tr key={member.id} className="border-b last:border-0">
                                        <td className="px-4 py-2 font-medium text-slate-800">{member.name}</td>
                                        <td className="px-4 py-2">{member.classNumber ?? '—'}</td>
                                        <td className="px-4 py-2">
                                            <select value={getStatus(member.id)} onChange={e => updateStatus(member.id, e.target.value as AttendanceStatus)} className="border border-slate-300 rounded-lg px-3 py-2">
                                                {STATUSES.map(status => (
                                                    <option key={status} value={status}>{status}</option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
};

export default Attendance;
