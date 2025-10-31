import React, { useEffect, useMemo, useState } from 'react';
import type { Entry, Member, Settings, User } from '../types';
import { formatCurrency, toCsv } from '../utils';

const PAGE_SIZE = 20;

const monthOptions = [
    { value: 'all', label: 'All Months' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
];

type ContributionReportProps = {
    isOpen: boolean;
    entries: Entry[];
    members: Member[];
    settings: Settings;
    onClose: () => void;
    initialMemberId?: string;
    currentUser: User;
};

type ContributionRow = Entry & { formattedDate: string };

type FilterState = {
    memberId: string;
    memberQuery: string;
    year: string;
    month: string;
    from: string;
    to: string;
};

function formatDate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

function describeFilters(filters: FilterState): string {
    const { year, month, from, to } = filters;
    const parts: string[] = [];

    if (from || to) {
        const rangeStart = from ? `from ${from}` : '';
        const rangeEnd = to ? `to ${to}` : '';
        parts.push(`${rangeStart}${rangeStart && rangeEnd ? ' ' : ''}${rangeEnd}`.trim());
    } else if (year !== 'all' && month !== 'all') {
        const monthLabel = monthOptions.find(option => option.value === month)?.label ?? `Month ${month}`;
        parts.push(`${monthLabel} ${year}`);
    } else if (year !== 'all') {
        parts.push(`Year ${year}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'All contributions';
}

const MemberContributionReport: React.FC<ContributionReportProps> = ({
    isOpen,
    entries,
    members,
    settings,
    onClose,
    initialMemberId,
    currentUser,
}) => {
    const [filters, setFilters] = useState<FilterState>({
        memberId: '',
        memberQuery: '',
        year: 'all',
        month: 'all',
        from: '',
        to: '',
    });
    const [rows, setRows] = useState<ContributionRow[]>([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [page, setPage] = useState(1);
    const [lastFiltersDescription, setLastFiltersDescription] = useState('All contributions');
    const [validationError, setValidationError] = useState<string | null>(null);

    const memberMap = useMemo(() => new Map(members.map(member => [member.id, member])), [members]);

    useEffect(() => {
        if (!isOpen) {
            setFilters({ memberId: '', memberQuery: '', year: 'all', month: 'all', from: '', to: '' });
            setRows([]);
            setTotalAmount(0);
            setPage(1);
            setLastFiltersDescription('All contributions');
            setValidationError(null);
            return;
        }

        if (initialMemberId) {
            const member = memberMap.get(initialMemberId);
            setFilters(prev => ({
                ...prev,
                memberId: initialMemberId,
                memberQuery: member?.name ?? initialMemberId,
            }));
        }
    }, [isOpen, initialMemberId, memberMap]);

    const availableYears = useMemo(() => {
        const relevantEntries = filters.memberId
            ? entries.filter(entry => entry.memberID === filters.memberId)
            : entries;
        const yearSet = new Set<number>();
        for (const entry of relevantEntries) {
            const parsed = new Date(entry.date);
            if (!Number.isNaN(parsed.getTime())) {
                yearSet.add(parsed.getUTCFullYear());
            }
        }
        return Array.from(yearSet).sort((a, b) => b - a);
    }, [entries, filters.memberId]);

    const matchedMember = filters.memberId ? memberMap.get(filters.memberId) : null;

    const handleMemberQueryChange = (value: string) => {
        setFilters(prev => ({ ...prev, memberQuery: value }));
        if (!value) {
            setFilters(prev => ({ ...prev, memberId: '' }));
            return;
        }

        const directId = members.find(member => member.id.toLowerCase() === value.toLowerCase());
        if (directId) {
            setFilters(prev => ({ ...prev, memberId: directId.id, memberQuery: directId.name }));
            return;
        }

        const byName = members.find(member => member.name.toLowerCase() === value.toLowerCase());
        if (byName) {
            setFilters(prev => ({ ...prev, memberId: byName.id, memberQuery: byName.name }));
            return;
        }

        const trimmed = value.split(' – ')[0]?.trim() ?? value.trim();
        const byDisplay = members.find(member => member.name.toLowerCase() === trimmed.toLowerCase());
        if (byDisplay) {
            setFilters(prev => ({ ...prev, memberId: byDisplay.id, memberQuery: byDisplay.name }));
            return;
        }

        setFilters(prev => ({ ...prev, memberId: '' }));
    };

    const handleGenerate = (event: React.FormEvent) => {
        event.preventDefault();
        if (!filters.memberId) {
            setValidationError('Please select a member before generating the report.');
            setRows([]);
            setTotalAmount(0);
            return;
        }

        if (filters.from && filters.to && filters.from > filters.to) {
            setValidationError('Start date must be before or the same as the end date.');
            setRows([]);
            setTotalAmount(0);
            return;
        }

        setValidationError(null);

        const relevantEntries = entries.filter(entry => entry.memberID === filters.memberId);

        let startDate: string | null = null;
        let endDate: string | null = null;

        if (filters.from || filters.to) {
            startDate = filters.from || null;
            endDate = filters.to || null;
        } else if (filters.year !== 'all' && filters.month !== 'all') {
            const year = Number(filters.year);
            const month = Number(filters.month);
            const lastDay = new Date(year, month, 0).getDate();
            startDate = formatDate(year, month, 1);
            endDate = formatDate(year, month, lastDay);
        } else if (filters.year !== 'all') {
            const year = Number(filters.year);
            startDate = formatDate(year, 1, 1);
            endDate = formatDate(year, 12, 31);
        }

        const nextRows: ContributionRow[] = relevantEntries
            .filter(entry => {
                const entryDate = entry.date.slice(0, 10);
                if (startDate && entryDate < startDate) {
                    return false;
                }
                if (endDate && entryDate > endDate) {
                    return false;
                }
                return true;
            })
            .map(entry => ({
                ...entry,
                formattedDate: entry.date.slice(0, 10),
            }))
            .sort((a, b) => a.formattedDate.localeCompare(b.formattedDate));

        const total = nextRows.reduce((acc, entry) => acc + (entry.amount || 0), 0);

        setRows(nextRows);
        setTotalAmount(total);
        setPage(1);

        const filtersDescription = describeFilters(filters);
        setLastFiltersDescription(filtersDescription);

        console.info('[Audit] Contribution report generated', {
            by: currentUser.username,
            role: currentUser.role,
            memberId: filters.memberId,
            memberName: matchedMember?.name ?? 'Unknown member',
            generatedAt: new Date().toISOString(),
            filters: {
                year: filters.year,
                month: filters.month,
                from: filters.from,
                to: filters.to,
            },
            resultCount: nextRows.length,
            totalAmount: total,
        });
    };

    const handleDownloadCsv = () => {
        if (!filters.memberId || rows.length === 0) {
            return;
        }

        const memberName = matchedMember?.name ?? filters.memberId;
        const csvRows = rows.map(row => ({
            MemberID: row.memberID,
            MemberName: memberName,
            Date: row.formattedDate,
            Amount: String(row.amount ?? 0),
            Type: row.type,
            Notes: row.note ?? '',
        }));

        const csv = toCsv(csvRows);
        if (!csv) {
            return;
        }

        const today = new Date().toISOString().slice(0, 10);
        const suffix = slugify(lastFiltersDescription);
        const filename = `member_${filters.memberId}_contributions_${today}${suffix ? `_${suffix}` : ''}.csv`;

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const paginatedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-5xl rounded-3xl shadow-2xl border border-white/60 bg-gradient-to-br from-white via-emerald-50 to-indigo-100/80 max-h-[90vh] overflow-hidden">
                <header className="flex items-center justify-between gap-4 border-b border-white/60 bg-white/70 px-6 py-4 rounded-t-3xl">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Member Contribution Report</h2>
                        {matchedMember && (
                            <p className="text-sm text-slate-600">{matchedMember.name} • ID: {matchedMember.id}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-semibold">Close</button>
                </header>
                <form onSubmit={handleGenerate} className="space-y-4 px-6 py-5 overflow-y-auto max-h-[calc(90vh-4rem)]">
                    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <label className="flex flex-col gap-2 lg:col-span-2">
                            <span className="text-sm font-semibold text-slate-600">Member</span>
                            <input
                                list="member-report-options"
                                value={filters.memberQuery}
                                onChange={event => handleMemberQueryChange(event.target.value)}
                                placeholder="Search by name or ID"
                                className="border border-slate-300 rounded-lg px-3 py-2"
                                required
                            />
                            <datalist id="member-report-options">
                                {members.map(member => (
                                    <React.Fragment key={member.id}>
                                        <option value={member.name} label={`${member.name} – ${member.id}`} />
                                        <option value={member.id} label={`${member.name}`} />
                                    </React.Fragment>
                                ))}
                            </datalist>
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">Year</span>
                            <select
                                value={filters.year}
                                onChange={event => setFilters(prev => ({ ...prev, year: event.target.value }))}
                                className="border border-slate-300 rounded-lg px-3 py-2"
                            >
                                <option value="all">All Years</option>
                                {availableYears.map(year => (
                                    <option key={year} value={String(year)}>{year}</option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">Month</span>
                            <select
                                value={filters.month}
                                onChange={event => setFilters(prev => ({ ...prev, month: event.target.value }))}
                                className="border border-slate-300 rounded-lg px-3 py-2"
                                disabled={filters.year === 'all'}
                            >
                                {monthOptions.map(month => (
                                    <option key={month.value} value={month.value}>{month.label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">From</span>
                            <input
                                type="date"
                                value={filters.from}
                                onChange={event => setFilters(prev => ({ ...prev, from: event.target.value }))}
                                className="border border-slate-300 rounded-lg px-3 py-2"
                            />
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">To</span>
                            <input
                                type="date"
                                value={filters.to}
                                onChange={event => setFilters(prev => ({ ...prev, to: event.target.value }))}
                                className="border border-slate-300 rounded-lg px-3 py-2"
                            />
                        </label>
                    </section>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-4 py-2"
                        >
                            Generate Report
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadCsv}
                            disabled={rows.length === 0}
                            className={`px-4 py-2 rounded-lg font-semibold border transition-colors ${
                                rows.length === 0
                                    ? 'border-slate-200 bg-white text-slate-400 cursor-not-allowed'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                        >
                            Download CSV
                        </button>
                        <span className="text-sm text-slate-500">{lastFiltersDescription}</span>
                    </div>
                    {validationError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {validationError}
                        </div>
                    )}
                    <section className="rounded-2xl border border-white/60 bg-white/70 shadow-inner overflow-hidden">
                        {rows.length === 0 ? (
                            <div className="px-6 py-10 text-center text-slate-500">
                                No contributions found for the selected filters.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3">Date Entered</th>
                                            <th className="px-4 py-3">Amount</th>
                                            <th className="px-4 py-3">Type</th>
                                            <th className="px-4 py-3">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedRows.map(row => (
                                            <tr key={row.id} className="border-b last:border-b-0 border-slate-100">
                                                <td className="px-4 py-3 font-medium text-slate-700">{row.formattedDate}</td>
                                                <td className="px-4 py-3 text-slate-800 font-semibold">{formatCurrency(row.amount, settings.currency)}</td>
                                                <td className="px-4 py-3 capitalize">{row.type.replace(/-/g, ' ')}</td>
                                                <td className="px-4 py-3 text-slate-500">{row.note || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-100 font-semibold text-slate-700">
                                        <tr>
                                            <td className="px-4 py-3">Total</td>
                                            <td className="px-4 py-3">{formatCurrency(totalAmount, settings.currency)}</td>
                                            <td className="px-4 py-3" colSpan={2}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </section>
                    {rows.length > PAGE_SIZE && (
                        <div className="flex items-center justify-between text-sm text-slate-500">
                            <span>
                                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                    disabled={page === 1}
                                    className={`px-3 py-1 rounded-lg border ${
                                        page === 1 ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    Previous
                                </button>
                                <span>Page {page} of {totalPages}</span>
                                <button
                                    type="button"
                                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={page === totalPages}
                                    className={`px-3 py-1 rounded-lg border ${
                                        page === totalPages
                                            ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                                            : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    ) : null;
};

export default MemberContributionReport;
