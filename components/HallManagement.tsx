import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HallRentalRecord } from '../types';
import { formatCurrency } from '../utils';

type HallManagementProps = {
    records: HallRentalRecord[];
    currency: string;
    onCreate: (payload: { amount: number; date: string }) => Promise<void> | void;
    isSubmitting?: boolean;
    isOffline?: boolean;
};

const HallManagement: React.FC<HallManagementProps> = ({ records, currency, onCreate, isSubmitting = false, isOffline = false }) => {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const chartData = useMemo(() => {
        const buckets = new Map<string, number>();
        records.forEach(record => {
            const month = record.date.slice(0, 7);
            buckets.set(month, (buckets.get(month) ?? 0) + record.amount);
        });
        return Array.from(buckets.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, total]) => ({ label, total }));
    }, [records]);

    const totalAmount = useMemo(() => records.reduce((acc, record) => acc + record.amount, 0), [records]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setSuccessMessage(null);

        const parsedAmount = parseFloat(amount);
        if (!date) {
            setError('Please pick a rental date.');
            return;
        }
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            setError('Enter a valid rental amount greater than zero.');
            return;
        }

        try {
            await onCreate({ amount: parsedAmount, date });
            setAmount('');
            setSuccessMessage('Hall rental saved locally and queued for SharePoint.');
        } catch (submitError) {
            console.error('Failed to create hall rental record', submitError);
            setError(submitError instanceof Error ? submitError.message : 'Unable to save the hall rental right now.');
        }
    };

    return (
        <div className="space-y-6">
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-sky-100/70 p-6 space-y-4">
                <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-bold text-slate-800">Hall Management</h2>
                    <p className="text-slate-500 text-sm">
                        Track hall rental income and sync updates to the SharePoint list <strong>Hall Rental</strong> for Finance and Admin teams.
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <label className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-600">Rental Date</span>
                        <input
                            type="date"
                            value={date}
                            onChange={event => setDate(event.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2"
                            required
                        />
                    </label>
                    <label className="flex flex-col gap-2 md:col-span-1">
                        <span className="text-sm font-semibold text-slate-600">Amount ({currency})</span>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={event => setAmount(event.target.value)}
                            placeholder="0.00"
                            className="border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </label>
                    <button
                        type="submit"
                        className="md:col-span-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Saving…' : 'Save Rental'}
                    </button>
                </form>
                {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
                {successMessage && <p className="text-sm text-emerald-600" role="status">{successMessage}</p>}
                {isOffline && (
                    <p className="text-xs text-amber-600">Offline mode: records will sync when the device reconnects.</p>
                )}
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-emerald-50 to-lime-100/70 p-6 space-y-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-xl font-semibold text-slate-800">Rental Performance</h3>
                    <p className="text-sm text-slate-500">Total collected: {formatCurrency(totalAmount, currency)}</p>
                </div>
                <div className="h-72">
                    {chartData.length === 0 ? (
                        <p className="text-sm text-slate-500">No hall rentals recorded yet.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5f5" />
                                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={value => formatCurrency(value, currency)} />
                                <Tooltip formatter={(value: number) => formatCurrency(value, currency)} labelFormatter={label => `Month ${label}`} />
                                <Bar dataKey="total" fill="#4f46e5" radius={[12, 12, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-white/80 backdrop-blur p-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Recent Rentals</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-slate-600">
                        <thead className="uppercase text-xs text-slate-500 border-b">
                            <tr>
                                <th className="px-4 py-2">Date</th>
                                <th className="px-4 py-2">Amount</th>
                                <th className="px-4 py-2">Sync</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">No hall rentals captured.</td>
                                </tr>
                            ) : (
                                records
                                    .slice()
                                    .sort((a, b) => b.date.localeCompare(a.date))
                                    .map(record => (
                                        <tr key={record.id} className="border-b last:border-0">
                                            <td className="px-4 py-2 font-medium text-slate-800">{record.date}</td>
                                            <td className="px-4 py-2">{formatCurrency(record.amount, currency)}</td>
                                            <td className="px-4 py-2 text-sm text-slate-500">{record.spId ? 'Synced' : 'Local only'}</td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default HallManagement;
