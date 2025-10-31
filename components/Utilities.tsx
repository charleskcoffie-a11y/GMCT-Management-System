import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CloudState, Entry, EntryType, Member, Settings } from '../types';
import { formatCurrency, fromCsv, sanitizeEntry, sanitizeMember, toCsv, ENTRY_TYPE_VALUES, entryTypeLabel } from '../utils';
import { testSharePointConnection } from '../services/sharepoint';
import {
    SHAREPOINT_ENTRIES_LIST_NAME,
    SHAREPOINT_MEMBERS_LIST_NAME,
} from '../constants';

type UtilitiesProps = {
    entries: Entry[];
    members: Member[];
    settings: Settings;
    cloud: CloudState;
    onImportEntries: (entries: Entry[]) => void;
    onImportMembers: (members: Member[]) => void;
    onResetData: () => void;
    onSaveTotalClasses: (total: number) => void;
};

const Utilities: React.FC<UtilitiesProps> = ({
    entries,
    members,
    settings,
    cloud,
    onImportEntries,
    onImportMembers,
    onResetData,
    onSaveTotalClasses,
}) => {
    const entryFileRef = useRef<HTMLInputElement | null>(null);
    const memberFileRef = useRef<HTMLInputElement | null>(null);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<EntryType[]>(ENTRY_TYPE_VALUES);
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [showReport, setShowReport] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [connectionMessage, setConnectionMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [totalClassesInput, setTotalClassesInput] = useState<string>(String(settings.maxClasses));
    const [totalClassesStatus, setTotalClassesStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

    const buildSharePointListUrl = useCallback((siteUrl: string, listName: string) => {
        if (!siteUrl || !listName) {
            return null;
        }
        try {
            const url = new URL(siteUrl);
            const trimmedPath = url.pathname.replace(/\/$/, '');
            url.pathname = `${trimmedPath}/_layouts/15/start.aspx`;
            url.hash = `#/Lists/${encodeURIComponent(listName)}/AllItems.aspx`;
            return url.toString();
        } catch (error) {
            console.error('Invalid SharePoint configuration for list shortcuts', error);
            return null;
        }
    }, []);

    const sharePointEntriesUrl = useMemo(
        () => buildSharePointListUrl(settings.sharePointSiteUrl, settings.sharePointEntriesListName ?? SHAREPOINT_ENTRIES_LIST_NAME),
        [buildSharePointListUrl, settings.sharePointEntriesListName, settings.sharePointSiteUrl],
    );

    const sharePointMembersUrl = useMemo(
        () => buildSharePointListUrl(settings.sharePointSiteUrl, settings.sharePointMembersListName ?? SHAREPOINT_MEMBERS_LIST_NAME),
        [buildSharePointListUrl, settings.sharePointMembersListName, settings.sharePointSiteUrl],
    );

    const openSharePointList = useCallback(
        async (targetUrl: string | null, listLabel: 'finance' | 'members') => {
            if (!targetUrl) {
                setConnectionMessage({
                    tone: 'error',
                    text: `SharePoint ${listLabel} list URL is not configured. Update the settings and try again.`,
                });
                return;
            }

            if (!cloud.signedIn) {
                setConnectionMessage({ tone: 'info', text: 'Sign in with Microsoft to open SharePoint lists.' });
                return;
            }

            try {
                const response = await fetch(targetUrl, {
                    method: 'HEAD',
                    mode: 'cors',
                    credentials: 'include',
                    headers: cloud.accessToken ? { Authorization: `Bearer ${cloud.accessToken}` } : undefined,
                });
                if (!response.ok) {
                    setConnectionMessage({
                        tone: 'error',
                        text:
                            response.status === 403
                                ? 'Access denied opening the SharePoint list. Confirm that your account has permission.'
                                : 'The SharePoint list returned an unexpected response. Check the list name or your permissions.',
                    });
                    return;
                }
            } catch (error) {
                console.warn('Unable to verify SharePoint list access', error);
                setConnectionMessage({
                    tone: 'info',
                    text: 'Opening SharePoint in a new tab. If the page reports a 404, confirm the site URL and list name.',
                });
            }

            const opened = window.open(targetUrl, '_blank', 'noopener');
            if (!opened) {
                setConnectionMessage({ tone: 'info', text: 'Please allow pop-ups to open the SharePoint list.' });
            }
        },
        [cloud.accessToken, cloud.signedIn],
    );

    const membersMap = useMemo(() => new Map(members.map(member => [member.id, member])), [members]);

    const classOptions = useMemo(
        () => Array.from({ length: settings.maxClasses }, (_, index) => String(index + 1)),
        [settings.maxClasses],
    );

    useEffect(() => {
        setTotalClassesInput(String(settings.maxClasses));
    }, [settings.maxClasses]);

    const filteredEntries = useMemo(() => {
        return entries.filter(entry => {
            if (startDate && entry.date < startDate) return false;
            if (endDate && entry.date > endDate) return false;
            if (!selectedTypes.includes(entry.type)) return false;

            if (selectedClasses.length > 0) {
                const member = membersMap.get(entry.memberID);
                const classNumber = member?.classNumber;
                if (!classNumber || !selectedClasses.includes(classNumber)) {
                    return false;
                }
            }

            return true;
        });
    }, [entries, endDate, membersMap, selectedClasses, selectedTypes, startDate]);

    const reportRows = useMemo(
        () =>
            filteredEntries.map(entry => {
                const member = membersMap.get(entry.memberID);
                return {
                    id: entry.id,
                    date: entry.date,
                    memberName: entry.memberName,
                    memberId: entry.memberID,
                    classNumber: member?.classNumber ?? '—',
                    type: entry.type,
                    method: entry.method,
                    amount: entry.amount,
                    note: entry.note ?? '',
                };
            }),
        [filteredEntries, membersMap],
    );

    const totalAmount = useMemo(() => filteredEntries.reduce((acc, entry) => acc + entry.amount, 0), [filteredEntries]);
    const averagePerEntry = filteredEntries.length > 0 ? totalAmount / filteredEntries.length : 0;
    const averagePerMember = members.length > 0 ? entries.reduce((acc, entry) => acc + entry.amount, 0) / members.length : 0;

    const toggleType = (type: EntryType) => {
        setSelectedTypes(prev => (prev.includes(type) ? prev.filter(item => item !== type) : [...prev, type]));
    };

    const toggleClass = (classNumber: string) => {
        setSelectedClasses(prev => (prev.includes(classNumber) ? prev.filter(item => item !== classNumber) : [...prev, classNumber]));
    };

    const handleGenerateReport = (event: React.FormEvent) => {
        event.preventDefault();
        setShowReport(true);
    };

    const exportReport = (format: 'csv' | 'json') => {
        if (reportRows.length === 0) {
            alert('No rows match the selected filters.');
            return;
        }
        if (format === 'csv') {
            const csv = toCsv(reportRows);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `gmct-report-${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
        } else {
            const json = JSON.stringify(reportRows, null, 2);
            const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `gmct-report-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
        }
    };

    const handleEntryFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (
            sharePointEntriesUrl &&
            !window.confirm('Manual imports bypass SharePoint safeguards. Continue with a local file import?')
        ) {
            event.target.value = '';
            window.open(sharePointEntriesUrl, '_blank', 'noopener');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = reader.result as string;
                if (file.name.endsWith('.csv')) {
                    const rows = fromCsv(text);
                    const sanitized = rows.map(row => sanitizeEntry(row));
                    onImportEntries(sanitized);
                    alert(`Imported ${sanitized.length} financial records.`);
                } else {
                    const raw = JSON.parse(text) as unknown;
                    const array = Array.isArray(raw) ? raw : [];
                    const sanitized = array.map(item => sanitizeEntry(item));
                    onImportEntries(sanitized);
                    alert(`Imported ${sanitized.length} financial records.`);
                }
            } catch (error) {
                console.error('Failed to import entries', error);
                alert('Import failed. Please provide a valid CSV or JSON export.');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleMemberFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (
            sharePointMembersUrl &&
            !window.confirm('Manual imports bypass SharePoint safeguards. Continue with a local file import?')
        ) {
            event.target.value = '';
            window.open(sharePointMembersUrl, '_blank', 'noopener');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = reader.result as string;
                const rows = fromCsv(text);
                const sanitized = rows.map(row => sanitizeMember(row));
                onImportMembers(sanitized);
                alert(`Imported ${sanitized.length} members.`);
            } catch (error) {
                console.error('Failed to import members', error);
                alert('Member import failed. Ensure the CSV includes headers like "name" and "classNumber".');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    return (
        <div className="space-y-6">
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-emerald-50 to-teal-100/70 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">SharePoint Tools</h2>
                <p className="text-sm text-slate-500">Verify your Microsoft 365 connection and keep your class configuration in sync.</p>
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 bg-white/80 border border-emerald-200 rounded-2xl p-4 space-y-3">
                        <h3 className="text-lg font-semibold text-slate-700">Test connection</h3>
                        <p className="text-sm text-slate-500">Make sure the app can reach your SharePoint lists with the current sign-in.</p>
                        <button
                            onClick={async () => {
                                setConnectionMessage({ tone: 'info', text: 'Checking connection…' });
                                setIsTestingConnection(true);
                                try {
                                    const result = await testSharePointConnection(cloud.accessToken);
                                    setConnectionMessage({ tone: result.success ? 'success' : 'error', text: result.message });
                                } catch (error) {
                                    console.error('Unexpected error while testing SharePoint connection', error);
                                    setConnectionMessage({ tone: 'error', text: 'Unable to confirm the SharePoint connection right now.' });
                                } finally {
                                    setIsTestingConnection(false);
                                }
                            }}
                            disabled={isTestingConnection}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg w-full sm:w-auto"
                        >
                            {isTestingConnection ? 'Testing…' : 'Test SharePoint Connection'}
                        </button>
                        {connectionMessage && (
                            <p
                                className={`text-sm font-medium ${
                                    connectionMessage.tone === 'success'
                                        ? 'text-emerald-600'
                                        : connectionMessage.tone === 'error'
                                        ? 'text-rose-600'
                                        : 'text-slate-500'
                                }`}
                            >
                                {connectionMessage.text}
                            </p>
                        )}
                    </div>
                    <div className="flex-1 bg-white/80 border border-indigo-200 rounded-2xl p-4 space-y-3">
                        <h3 className="text-lg font-semibold text-slate-700">Total number of classes</h3>
                        <p className="text-sm text-slate-500">Update the class count so reports and filters stay accurate.</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="number"
                                min={1}
                                value={totalClassesInput}
                                onChange={event => {
                                    setTotalClassesInput(event.target.value);
                                    setTotalClassesStatus(null);
                                }}
                                className="flex-1 border border-indigo-200 rounded-lg px-3 py-2"
                            />
                            <button
                                onClick={() => {
                                    const parsed = Number(totalClassesInput);
                                    if (!Number.isFinite(parsed) || parsed < 1) {
                                        setTotalClassesStatus({ tone: 'error', text: 'Enter a number greater than zero.' });
                                        return;
                                    }
                                    const sanitized = Math.max(1, Math.round(parsed));
                                    setTotalClassesInput(String(sanitized));
                                    onSaveTotalClasses(sanitized);
                                    setTotalClassesStatus({ tone: 'success', text: 'Saved. This will be ready next time.' });
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg"
                            >
                                Save
                            </button>
                        </div>
                        {totalClassesStatus && (
                            <p className={`text-sm font-medium ${totalClassesStatus.tone === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {totalClassesStatus.text}
                            </p>
                        )}
                    </div>
                </div>
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-purple-100/70 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">Data Import &amp; Snapshot</h2>
                <p className="text-slate-500 text-sm">Bulk load data from CSV exports or grab a quick snapshot of your offline database.</p>
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => entryFileRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg">Import Financial Records</button>
                    <button onClick={() => memberFileRef.current?.click()} className="bg-white/80 border border-indigo-200 text-indigo-700 font-semibold px-4 py-2 rounded-lg hover:bg-white">Import Members</button>
                    {sharePointEntriesUrl && (
                        <button
                            type="button"
                            onClick={() => void openSharePointList(sharePointEntriesUrl, 'finance')}
                            className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold px-4 py-2 rounded-lg hover:bg-white"
                        >
                            Open SharePoint Finance List
                        </button>
                    )}
                    {sharePointMembersUrl && (
                        <button
                            type="button"
                            onClick={() => void openSharePointList(sharePointMembersUrl, 'members')}
                            className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold px-4 py-2 rounded-lg hover:bg-white"
                        >
                            Open SharePoint Members List
                        </button>
                    )}
                    <button
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(JSON.stringify({ entries, members }, null, 2));
                                alert('Copied current data snapshot to clipboard.');
                            } catch (error) {
                                console.error('Snapshot copy failed', error);
                                alert('Unable to copy snapshot to the clipboard.');
                            }
                        }}
                        className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-4 py-2 rounded-lg"
                    >
                        Copy Data Snapshot
                    </button>
                </div>
                <p className="text-xs text-slate-500">CSV headers supported for entries: date, memberID, memberName, type, method, amount, note.</p>
                {(sharePointEntriesUrl || sharePointMembersUrl) && (
                    <p className="text-xs text-emerald-700 font-medium">
                        Tip: Use the SharePoint shortcuts above to jump straight to the official lists before importing so the correct export is always selected.
                    </p>
                )}
                <input ref={entryFileRef} type="file" accept=".csv,.json" className="hidden" onChange={handleEntryFile} />
                <input ref={memberFileRef} type="file" accept=".csv" className="hidden" onChange={handleMemberFile} />
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-sky-50 to-cyan-100/70 p-6">
                <h3 className="text-xl font-semibold text-slate-800">Custom Financial Report</h3>
                <p className="text-sm text-slate-500">Filter by contribution type, class assignment, and date range, then export the results.</p>
                <form onSubmit={handleGenerateReport} className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Start date</span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2" />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">End date</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2" />
                    </label>
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Contribution types</span>
                        <div className="flex flex-wrap gap-2">
                            {ENTRY_TYPE_VALUES.map(type => (
                                <label key={type} className="inline-flex items-center gap-2 bg-white/70 border border-slate-200 rounded-full px-3 py-1 text-xs uppercase tracking-wide">
                                    <input type="checkbox" checked={selectedTypes.includes(type)} onChange={() => toggleType(type)} />
                                    <span>{entryTypeLabel(type)}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="lg:col-span-3 flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Member classes</span>
                        <div className="flex flex-wrap gap-2">
                            {classOptions.map(classNumber => (
                                <label key={classNumber} className="inline-flex items-center gap-2 bg-white/70 border border-slate-200 rounded-full px-3 py-1 text-xs uppercase tracking-wide">
                                    <input type="checkbox" checked={selectedClasses.includes(classNumber)} onChange={() => toggleClass(classNumber)} />
                                    <span>Class {classNumber}</span>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500">Leave all classes unchecked to include every member.</p>
                    </div>
                    <div className="lg:col-span-3 flex flex-wrap gap-3">
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg">Generate report</button>
                        <button type="button" onClick={() => { setStartDate(''); setEndDate(''); setSelectedTypes(ENTRY_TYPE_VALUES); setSelectedClasses([]); setShowReport(false); }} className="bg-white/80 border border-indigo-200 text-indigo-700 font-semibold px-4 py-2 rounded-lg hover:bg-white">Reset filters</button>
                        {showReport && (
                            <>
                                <button type="button" onClick={() => exportReport('csv')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg">Export CSV</button>
                                <button type="button" onClick={() => exportReport('json')} className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold px-4 py-2 rounded-lg hover:bg-white">Export JSON</button>
                            </>
                        )}
                    </div>
                </form>

                {showReport && (
                    <div className="mt-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-600">
                            <div className="rounded-2xl bg-white/80 border border-white/60 px-4 py-3">
                                <p className="uppercase text-xs text-slate-500 font-semibold">Matching entries</p>
                                <p className="text-2xl font-bold text-slate-800">{filteredEntries.length}</p>
                            </div>
                            <div className="rounded-2xl bg-white/80 border border-white/60 px-4 py-3">
                                <p className="uppercase text-xs text-slate-500 font-semibold">Total amount</p>
                                <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalAmount, settings.currency)}</p>
                            </div>
                            <div className="rounded-2xl bg-white/80 border border-white/60 px-4 py-3">
                                <p className="uppercase text-xs text-slate-500 font-semibold">Avg per entry</p>
                                <p className="text-2xl font-bold text-slate-800">{formatCurrency(averagePerEntry, settings.currency)}</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/80">
                            <table className="w-full text-left text-slate-600">
                                <thead className="uppercase text-sm text-slate-500 border-b bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-2">Date</th>
                                        <th className="px-4 py-2">Member</th>
                                        <th className="px-4 py-2">Class</th>
                                        <th className="px-4 py-2">Type</th>
                                        <th className="px-4 py-2">Method</th>
                                        <th className="px-4 py-2">Amount</th>
                                        <th className="px-4 py-2">Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportRows.map(row => (
                                        <tr key={row.id} className="border-b last:border-0">
                                            <td className="px-4 py-2">{row.date}</td>
                                            <td className="px-4 py-2 font-medium text-slate-800">{row.memberName || 'Unassigned'}</td>
                                            <td className="px-4 py-2 text-center">{row.classNumber}</td>
                                            <td className="px-4 py-2">{entryTypeLabel(row.type)}</td>
                                            <td className="px-4 py-2 capitalize">{row.method}</td>
                                            <td className="px-4 py-2">{formatCurrency(row.amount, settings.currency)}</td>
                                            <td className="px-4 py-2">{row.note}</td>
                                        </tr>
                                    ))}
                                    {reportRows.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-6 text-center text-slate-500">No entries match the current filters.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 p-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Data Health Snapshot</h3>
                <ul className="space-y-2 text-slate-600">
                    <li>Total financial entries: <strong>{entries.length}</strong></li>
                    <li>Total members on record: <strong>{members.length}</strong></li>
                    <li>Average gift per member: <strong>{formatCurrency(averagePerMember, settings.currency)}</strong></li>
                </ul>
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-rose-50 to-rose-100/80 p-6">
                <h3 className="text-xl font-semibold text-rose-700">Danger Zone</h3>
                <p className="text-sm text-rose-500 mt-2">Clearing local storage wipes every entry, member, attendance record, and weekly report on this device. Be sure you have a backup before continuing.</p>
                <button onClick={onResetData} className="mt-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold px-4 py-2 rounded-lg">Delete all local data</button>
            </section>
        </div>
    );
};

export default Utilities;
