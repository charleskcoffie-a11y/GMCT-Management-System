import React, { useMemo } from 'react';
import type { Entry, Settings } from '../types';
import { formatCurrency } from '../utils';

type DashboardProps = {
    entries: Entry[];
    settings: Settings;
};

const Dashboard: React.FC<DashboardProps> = ({ entries, settings }) => {
    const totals = useMemo(() => {
        const sum = entries.reduce((acc, entry) => acc + entry.amount, 0);
        const byType = entries.reduce<Record<string, number>>((acc, entry) => {
            acc[entry.type] = (acc[entry.type] ?? 0) + entry.amount;
            return acc;
        }, {});
        return { sum, byType };
    }, [entries]);

    return (
        <div className="space-y-6">
 codex/restore-missing-imports-for-app.tsx
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-amber-50 to-orange-100/70 p-6">

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
 main
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Financial Overview</h2>
                <p className="text-slate-600">Total recorded giving: <strong>{formatCurrency(totals.sum, settings.currency)}</strong></p>
            </section>

 codex/restore-missing-imports-for-app.tsx
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-sky-100/70 p-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Giving by Type</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(totals.byType).map(([type, amount], index) => (
                        <div
                            key={type}
                            className={`rounded-2xl p-4 shadow-sm border border-white/60 bg-gradient-to-br ${index % 3 === 0 ? 'from-white via-emerald-50 to-teal-100/60' : index % 3 === 1 ? 'from-white via-rose-50 to-pink-100/60' : 'from-white via-sky-50 to-cyan-100/60'}`}
                        >

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Giving by Type</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(totals.byType).map(([type, amount]) => (
                        <div key={type} className="border border-slate-200 rounded-xl p-4">
 main
                            <h4 className="text-sm font-semibold text-slate-500 uppercase">{type}</h4>
                            <p className="text-2xl font-bold text-slate-800">{formatCurrency(amount, settings.currency)}</p>
                        </div>
                    ))}
                    {entries.length === 0 && <p className="text-slate-500">No entries recorded yet.</p>}
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
