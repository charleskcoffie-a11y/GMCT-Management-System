 codex/restore-missing-imports-for-app.tsx
import React, { useEffect, useMemo, useState } from 'react';
import type { Entry, EntryType, Settings } from '../types';
import { formatCurrency } from '../utils';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend,
    PieChart,
    Pie,
    Cell,
} from 'recharts';

type FilterMode = 'day' | 'month' | 'range';

const ENTRY_TYPES: EntryType[] = ['tithe', 'offering', 'thanksgiving-offering', 'first-fruit', 'pledge', 'harvest-levy', 'other'];
const PIE_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9', '#f97316'];

function formatDayLabel(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMonthLabel(monthKey: string): string {
    const [year, month] = monthKey.split('-').map(Number);
    if (!year || !month) return monthKey;
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

import React, { useMemo } from 'react';
import type { Entry, Settings } from '../types';
import { formatCurrency } from '../utils';
 main

interface InsightsProps {
    entries: Entry[];
    settings: Settings;
}

const Insights: React.FC<InsightsProps> = ({ entries, settings }) => {
 codex/restore-missing-imports-for-app.tsx
    const [filterMode, setFilterMode] = useState<FilterMode>('month');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');

    const availableDates = useMemo<string[]>(() => {
        return Array.from(new Set(entries.map(entry => entry.date))).sort();
    }, [entries]);

    const availableMonths = useMemo<string[]>(() => {
    const availableDates = useMemo(() => {
        return Array.from(new Set(entries.map(entry => entry.date))).sort();
    }, [entries]);

    const availableMonths = useMemo(() => {
        return Array.from(new Set(entries.map(entry => entry.date.slice(0, 7)))).sort();
    }, [entries]);

    useEffect(() => {
        if (filterMode === 'day' && !selectedDate && availableDates.length > 0) {
            setSelectedDate(availableDates[availableDates.length - 1]);
        }
    }, [filterMode, selectedDate, availableDates]);

    useEffect(() => {
        if (filterMode === 'month' && !selectedMonth && availableMonths.length > 0) {
            setSelectedMonth(availableMonths[availableMonths.length - 1]);
        }
    }, [filterMode, selectedMonth, availableMonths]);

    useEffect(() => {
        if (filterMode === 'range' && availableMonths.length > 0) {
            setRangeStart(prev => (prev ? prev : availableMonths[0]));
            setRangeEnd(prev => (prev ? prev : availableMonths[availableMonths.length - 1]));
        }
    }, [filterMode, availableMonths]);

    const filteredEntries = useMemo<Entry[]>(() => {
    const filteredEntries = useMemo(() => {
        if (entries.length === 0) return [];

        switch (filterMode) {
            case 'day':
                return selectedDate ? entries.filter(entry => entry.date === selectedDate) : [];
            case 'month':
                return selectedMonth ? entries.filter(entry => entry.date.startsWith(selectedMonth)) : [];
            case 'range':
                if (!rangeStart || !rangeEnd) return [];
                if (rangeStart > rangeEnd) return [];
                return entries.filter(entry => {
                    const monthKey = entry.date.slice(0, 7);
                    return monthKey >= rangeStart && monthKey <= rangeEnd;
                });
            default:
                return entries;
        }
    }, [entries, filterMode, rangeStart, rangeEnd, selectedDate, selectedMonth]);

    const hasResults = filteredEntries.length > 0;

    const stats = useMemo(() => {
        if (filteredEntries.length === 0) {
            return {
                total: 0,

    const stats = useMemo(() => {
        if (entries.length === 0) {
            return {
 main
                average: 0,
                largest: null as Entry | null,
                latest: null as Entry | null,
            };
        }

 codex/restore-missing-imports-for-app.tsx
        const sortedByAmount = [...filteredEntries].sort((a, b) => b.amount - a.amount);
        const sortedByDate = [...filteredEntries].sort((a, b) => b.date.localeCompare(a.date));
        const total = filteredEntries.reduce((acc, entry) => acc + entry.amount, 0);
        return {
            total,
            average: total / filteredEntries.length,
            largest: sortedByAmount[0] ?? null,
            latest: sortedByDate[0] ?? null,
        };
    }, [filteredEntries]);

    const barData = useMemo<Array<{ period: string; label: string; total: number }>>(() => {
    const barData = useMemo(() => {
        if (filteredEntries.length === 0) return [];

        const totals = new Map<string, number>();
        filteredEntries.forEach(entry => {
            const key = filterMode === 'day' ? entry.date : entry.date.slice(0, 7);
            totals.set(key, (totals.get(key) ?? 0) + entry.amount);
        });

        return Array.from(totals.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, value]) => ({
                period: key,
                label: filterMode === 'day' ? formatDayLabel(key) : formatMonthLabel(key),
                total: value,
            }));
    }, [filteredEntries, filterMode]);

    const pieData = useMemo<Array<{ type: EntryType; label: string; value: number; color: string }>>(() => {
    const pieData = useMemo(() => {
        if (filteredEntries.length === 0) return [];

        const totals: Record<EntryType, number> = {
            'tithe': 0,
            'offering': 0,
            'thanksgiving-offering': 0,
            'first-fruit': 0,
            'pledge': 0,
            'harvest-levy': 0,
            'other': 0,
        };

        filteredEntries.forEach(entry => {
            totals[entry.type] = (totals[entry.type] ?? 0) + entry.amount;
        });

        return ENTRY_TYPES.filter(type => totals[type] > 0).map((type, index) => ({
            type,
            label: type.replace('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
            value: totals[type],
            color: PIE_COLORS[index % PIE_COLORS.length],
        }));
    }, [filteredEntries]);

    const classTotals = useMemo<Array<{ classNumber: string; total: number }>>(() => {
        if (filteredEntries.length === 0) return [];

        const totals = new Map<string, number>();
        filteredEntries.forEach(entry => {
            const classNumber = entry.memberID.split('-')[0] ?? 'Unknown';
            totals.set(classNumber, (totals.get(classNumber) ?? 0) + entry.amount);
        });

        const aggregated: Array<{ classNumber: string; total: number }> = [];
        totals.forEach((total, classNumber) => {
            aggregated.push({ classNumber, total });
        });

        return aggregated.sort((a, b) => b.total - a.total);
    const classTotals = useMemo(() => {
        if (filteredEntries.length === 0) return [];
        const totals = filteredEntries.reduce<Record<string, number>>((acc, entry) => {

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
 main
            const classNumber = entry.memberID.split('-')[0] ?? 'Unknown';
            acc[classNumber] = (acc[classNumber] ?? 0) + entry.amount;
            return acc;
        }, {});
 codex/restore-missing-imports-for-app.tsx
        return Object.entries(totals)
            .map(([classNumber, total]) => ({ classNumber, total }))
            .sort((a, b) => b.total - a.total);
    }, [filteredEntries]);

    return (
        <div className="space-y-6">
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-purple-100/70 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">Filter Insights</h2>
                <p className="text-sm text-slate-500">Choose how you want to explore the records below.</p>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap gap-3">
                        <label className={`px-4 py-2 rounded-full border ${filterMode === 'day' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white/70 text-slate-600 border-slate-200'} cursor-pointer text-sm font-medium`}> 
                            <input type="radio" name="insight-filter" value="day" className="hidden" checked={filterMode === 'day'} onChange={() => setFilterMode('day')} />
                            Single date
                        </label>
                        <label className={`px-4 py-2 rounded-full border ${filterMode === 'month' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white/70 text-slate-600 border-slate-200'} cursor-pointer text-sm font-medium`}>
                            <input type="radio" name="insight-filter" value="month" className="hidden" checked={filterMode === 'month'} onChange={() => setFilterMode('month')} />
                            Single month
                        </label>
                        <label className={`px-4 py-2 rounded-full border ${filterMode === 'range' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white/70 text-slate-600 border-slate-200'} cursor-pointer text-sm font-medium`}>
                            <input type="radio" name="insight-filter" value="range" className="hidden" checked={filterMode === 'range'} onChange={() => setFilterMode('range')} />
                            Month range
                        </label>
                    </div>

                    {filterMode === 'day' && (
                        <div className="flex flex-col sm:flex-row gap-3">
                            <label className="flex flex-col text-sm text-slate-600">
                                <span className="font-semibold mb-1">Date</span>
                                <input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} className="border border-slate-300 rounded-lg px-3 py-2" />
                            </label>
                        </div>
                    )}

                    {filterMode === 'month' && (
                        <div className="flex flex-col sm:flex-row gap-3">
                            <label className="flex flex-col text-sm text-slate-600">
                                <span className="font-semibold mb-1">Month</span>
                                <input type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="border border-slate-300 rounded-lg px-3 py-2" />
                            </label>
                        </div>
                    )}

                    {filterMode === 'range' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="flex flex-col text-sm text-slate-600">
                                <span className="font-semibold mb-1">Start month</span>
                                <input type="month" value={rangeStart} max={rangeEnd || undefined} onChange={event => setRangeStart(event.target.value)} className="border border-slate-300 rounded-lg px-3 py-2" />
                            </label>
                            <label className="flex flex-col text-sm text-slate-600">
                                <span className="font-semibold mb-1">End month</span>
                                <input type="month" value={rangeEnd} min={rangeStart || undefined} onChange={event => setRangeEnd(event.target.value)} className="border border-slate-300 rounded-lg px-3 py-2" />
                            </label>
                        </div>
                    )}
                </div>
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-rose-50 to-pink-100/70 p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Key Metrics</h2>
                {!hasResults ? (
                    <p className="text-slate-500">No records found for the selected filter.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="rounded-2xl p-4 shadow-sm border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-indigo-100/60">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase">Total</h3>
                            <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.total, settings.currency)}</p>
                        </div>
                        <div className="rounded-2xl p-4 shadow-sm border border-white/60 bg-gradient-to-br from-white via-amber-50 to-orange-100/60">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase">Average Gift</h3>
                            <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.average, settings.currency)}</p>
                        </div>
                        <div className="rounded-2xl p-4 shadow-sm border border-white/60 bg-gradient-to-br from-white via-sky-50 to-cyan-100/60">

        return Object.entries(totals).sort((a, b) => b[1] - a[1]);
    }, [entries]);

    return (
        <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Key Metrics</h2>
                {entries.length === 0 ? (
                    <p className="text-slate-500">Add financial records to unlock insights.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="border border-slate-200 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase">Average Gift</h3>
                            <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.average, settings.currency)}</p>
                        </div>
                        <div className="border border-slate-200 rounded-xl p-4">
 main
                            <h3 className="text-sm font-semibold text-slate-500 uppercase">Largest Gift</h3>
                            <p className="text-2xl font-bold text-slate-800">{stats.largest ? formatCurrency(stats.largest.amount, settings.currency) : '—'}</p>
                            {stats.largest && <p className="text-sm text-slate-500">{stats.largest.memberName}</p>}
                        </div>
                        <div className="rounded-2xl p-4 shadow-sm border border-white/60 bg-gradient-to-br from-white via-emerald-50 to-teal-100/60">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase">Latest Entry</h3>
                            <p className="text-2xl font-bold text-slate-800">{stats.latest ? formatDayLabel(stats.latest.date) : '—'}</p>
 codex/restore-missing-imports-for-app.tsx
                        <div className="rounded-2xl p-4 shadow-sm border border-white/60 bg-gradient-to-br from-white via-emerald-50 to-teal-100/60">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase">Latest Entry</h3>
                            <p className="text-2xl font-bold text-slate-800">{stats.latest ? formatDayLabel(stats.latest.date) : '—'}</p>

                        <div className="border border-slate-200 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase">Latest Entry</h3>
                            <p className="text-2xl font-bold text-slate-800">{stats.latest ? stats.latest.date : '—'}</p>
 main
                            {stats.latest && <p className="text-sm text-slate-500">{stats.latest.memberName}</p>}
                        </div>
                    </div>
                )}
            </section>

 codex/restore-missing-imports-for-app.tsx
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-sky-50 to-cyan-100/70 p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Giving Trend</h2>
                {!hasResults ? (
                    <p className="text-slate-500">No records found for the selected filter.</p>
                ) : (
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="label" tick={{ fill: '#475569' }} />
                                <YAxis tick={{ fill: '#475569' }} tickFormatter={value => formatCurrency(value, settings.currency)} width={120} />
                                <Tooltip formatter={value => formatCurrency(Number(value), settings.currency)} labelStyle={{ color: '#1f2937' }} />
                                <Legend />
                                <Bar dataKey="total" name="Total" fill="#6366f1" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-violet-50 to-purple-100/70 p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Contribution Breakdown</h2>
                {!hasResults ? (
                    <p className="text-slate-500">No records found for the selected filter.</p>
                ) : pieData.length === 0 ? (
                    <p className="text-slate-500">No category data available.</p>
                ) : (
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} dataKey="value" nameKey="label" innerRadius={60} outerRadius={100} paddingAngle={4}>
                                    {pieData.map((entry, index) => (
                                        <Cell key={entry.type} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={value => formatCurrency(Number(value), settings.currency)} labelStyle={{ color: '#1f2937' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Class Contribution Leaderboard</h2>
                {!hasResults ? (
                    <p className="text-slate-500">No records found for the selected filter.</p>
                ) : classTotals.length === 0 ? (

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Class Contribution Leaderboard</h2>
                {classTotals.length === 0 ? (
 main
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
 codex/restore-missing-imports-for-app.tsx
                            {classTotals.map(row => (
                                <tr key={row.classNumber} className="border-b last:border-0">
                                    <td className="px-4 py-2 font-medium text-slate-800">{row.classNumber}</td>
                                    <td className="px-4 py-2">{formatCurrency(row.total, settings.currency)}</td>

                            {classTotals.map(([classNumber, amount]) => (
                                <tr key={classNumber} className="border-b last:border-0">
                                    <td className="px-4 py-2 font-medium text-slate-800">{classNumber}</td>
                                    <td className="px-4 py-2">{formatCurrency(amount, settings.currency)}</td>
 main
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
