import React, { useMemo } from 'react';
import type { Entry, Settings } from '../types';
import { formatCurrency } from '../utils';

interface InsightsProps {
    entries: Entry[];
    settings: Settings;
}

const Insights: React.FC<InsightsProps> = ({ entries, settings }) => {
    const stats = useMemo(() => {
        if (entries.length === 0) {
            return {
                average: 0,
                largest: null as Entry | null,
                latest: null as Entry | null,
            };
        }

        const sortedByAmount = [...entries].sort((a, b) => b.amount - a.amount);
        const sortedByDate = [...entries].sort((a, b) => b.date.localeCompare(a.date));
        const sum = entries.reduce((acc, entry) => acc + entry.amount, 0);
        return {
            average: sum / entries.length,
            largest: sortedByAmount[0] ?? null,
            latest: sortedByDate[0] ?? null,
        };
    }, [entries]);

    const classTotals = useMemo(() => {
        const totals = entries.reduce<Record<string, number>>((acc, entry) => {
            const classNumber = entry.memberID.split('-')[0] ?? 'Unknown';
            acc[classNumber] = (acc[classNumber] ?? 0) + entry.amount;
            return acc;
        }, {});
        return Object.entries(totals).sort((a, b) => b[1] - a[1]);
    }, [entries]);

    return (
        <div className="space-y-6">
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-rose-50 to-pink-100/70 p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Key Metrics</h2>
                {entries.length === 0 ? (
                    <p className="text-slate-500">Add financial records to unlock insights.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-2xl p-4 shadow-sm border border-white/60 bg-gradient-to-br from-white via-amber-50 to-orange-100/60">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase">Average Gift</h3>
                            <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.average, settings.currency)}</p>
                        </div>
                        <div className="rounded-2xl p-4 shadow-sm border border-white/60 bg-gradient-to-br from-white via-sky-50 to-indigo-100/60">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase">Largest Gift</h3>
                            <p className="text-2xl font-bold text-slate-800">{stats.largest ? formatCurrency(stats.largest.amount, settings.currency) : '—'}</p>
                            {stats.largest && <p className="text-sm text-slate-500">{stats.largest.memberName}</p>}
                        </div>
                        <div className="rounded-2xl p-4 shadow-sm border border-white/60 bg-gradient-to-br from-white via-emerald-50 to-teal-100/60">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase">Latest Entry</h3>
                            <p className="text-2xl font-bold text-slate-800">{stats.latest ? stats.latest.date : '—'}</p>
                            {stats.latest && <p className="text-sm text-slate-500">{stats.latest.memberName}</p>}
                        </div>
                    </div>
                )}
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-sky-50 to-cyan-100/70 p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Class Contribution Leaderboard</h2>
                {classTotals.length === 0 ? (
                    <p className="text-slate-500">No class level data available yet.</p>
                ) : (
                    <table className="w-full text-left text-slate-600">
                        <thead className="uppercase text-sm text-slate-500 border-b">
                            <tr>
                                <th className="px-4 py-2">Class</th>
                                <th className="px-4 py-2">Total Given</th>
                            </tr>
                        </thead>
                        <tbody>
                            {classTotals.map(([classNumber, amount]) => (
                                <tr key={classNumber} className="border-b last:border-0">
                                    <td className="px-4 py-2 font-medium text-slate-800">{classNumber}</td>
                                    <td className="px-4 py-2">{formatCurrency(amount, settings.currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    );
};

export default Insights;
