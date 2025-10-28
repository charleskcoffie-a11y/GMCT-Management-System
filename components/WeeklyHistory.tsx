import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { WeeklyHistoryRecord } from '../types';

interface WeeklyHistoryProps {
    history: WeeklyHistoryRecord[];
    setHistory: React.Dispatch<React.SetStateAction<WeeklyHistoryRecord[]>>;
}

const WeeklyHistory: React.FC<WeeklyHistoryProps> = ({ history, setHistory }) => {
    const [form, setForm] = useState<WeeklyHistoryRecord>(() => ({
        id: uuidv4(),
        dateOfService: new Date().toISOString().slice(0, 10),
        societyName: '',
        officiant: '',
        liturgist: '',
        serviceTypes: [],
        serviceTypeOther: '',
        sermonTopic: '',
        worshipHighlights: '',
        announcementsBy: '',
        attendance: {
            men: 0,
            women: 0,
            junior: 0,
            adherents: 0,
            visitors: 0,
            catechumens: 0,
        },
        newMembersDetails: '',
        newMembersContact: '',
        specialDonationsDetails: '',
        events: '',
        observations: '',
        preparedBy: '',
    }));

    const resetForm = () => {
        setForm(prev => ({
            ...prev,
            id: uuidv4(),
            dateOfService: new Date().toISOString().slice(0, 10),
            societyName: '',
            officiant: '',
            liturgist: '',
            serviceTypes: [],
            serviceTypeOther: '',
            sermonTopic: '',
            worshipHighlights: '',
            announcementsBy: '',
            attendance: {
                men: 0,
                women: 0,
                junior: 0,
                adherents: 0,
                visitors: 0,
                catechumens: 0,
            },
            newMembersDetails: '',
            newMembersContact: '',
            specialDonationsDetails: '',
            events: '',
            observations: '',
            preparedBy: '',
        }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setHistory(prev => [...prev, form]);
        resetForm();
    };

    return (
        <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Record Weekly History</h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Date of Service</span>
                        <input type="date" value={form.dateOfService} onChange={e => setForm(prev => ({ ...prev, dateOfService: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2" />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Society</span>
                        <input value={form.societyName} onChange={e => setForm(prev => ({ ...prev, societyName: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2" />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Officiant</span>
                        <input value={form.officiant} onChange={e => setForm(prev => ({ ...prev, officiant: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2" />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Liturgist</span>
                        <input value={form.liturgist} onChange={e => setForm(prev => ({ ...prev, liturgist: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2" />
                    </label>
                    <label className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-600">Sermon Topic</span>
                        <input value={form.sermonTopic} onChange={e => setForm(prev => ({ ...prev, sermonTopic: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2" />
                    </label>
                    <label className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-600">Highlights</span>
                        <textarea value={form.worshipHighlights} onChange={e => setForm(prev => ({ ...prev, worshipHighlights: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2" rows={3} />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Announcements By</span>
                        <input value={form.announcementsBy} onChange={e => setForm(prev => ({ ...prev, announcementsBy: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2" />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Prepared By</span>
                        <input value={form.preparedBy} onChange={e => setForm(prev => ({ ...prev, preparedBy: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2" />
                    </label>
                    <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(form.attendance).map(([key, value]) => (
                            <label key={key} className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-600 capitalize">{key}</span>
                                <input type="number" min={0} value={value} onChange={e => setForm(prev => ({
                                    ...prev,
                                    attendance: { ...prev.attendance, [key]: Number(e.target.value) },
                                }))} className="border border-slate-300 rounded-lg px-3 py-2" />
                            </label>
                        ))}
                    </div>
                    <label className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-600">Special Donations</span>
                        <textarea value={form.specialDonationsDetails} onChange={e => setForm(prev => ({ ...prev, specialDonationsDetails: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2" rows={2} />
                    </label>
                    <label className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-600">Events &amp; Observations</span>
                        <textarea value={form.events} onChange={e => setForm(prev => ({ ...prev, events: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2" rows={2} />
                        <textarea value={form.observations} onChange={e => setForm(prev => ({ ...prev, observations: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2" rows={2} placeholder="Additional observations" />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">New Members Details</span>
                        <textarea value={form.newMembersDetails} onChange={e => setForm(prev => ({ ...prev, newMembersDetails: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2" rows={2} />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">New Members Contact</span>
                        <textarea value={form.newMembersContact} onChange={e => setForm(prev => ({ ...prev, newMembersContact: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2" rows={2} />
                    </label>
                    <button type="submit" className="md:col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-4 py-2">Save Weekly Record</button>
                </form>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Submitted Reports</h2>
                <div className="space-y-4">
                    {history.map(record => (
                        <div key={record.id} className="border border-slate-200 rounded-xl p-4">
                            <h3 className="text-lg font-semibold text-slate-800">{record.dateOfService} — {record.societyName}</h3>
                            <p className="text-sm text-slate-500">Officiant: {record.officiant || 'N/A'} | Liturgist: {record.liturgist || 'N/A'}</p>
                            <p className="text-sm text-slate-500 mt-2">Attendance Total: {Object.values(record.attendance).reduce((acc, value) => acc + value, 0)}</p>
                        </div>
                    ))}
                    {history.length === 0 && <p className="text-slate-500">No reports submitted yet.</p>}
                </div>
            </section>
        </div>
    );
};

export default WeeklyHistory;
