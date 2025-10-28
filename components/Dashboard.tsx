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
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Financial Overview</h2>
                <p className="text-slate-600">Total recorded giving: <strong>{formatCurrency(totals.sum, settings.currency)}</strong></p>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Giving by Type</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(totals.byType).map(([type, amount]) => (
                        <div key={type} className="border border-slate-200 rounded-xl p-4">
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
