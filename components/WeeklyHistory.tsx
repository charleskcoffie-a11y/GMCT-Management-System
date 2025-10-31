import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ServiceType, WeeklyHistoryRecord } from '../types';
import { generateId, serviceTypeLabel, fromCsv, toCsv, sanitizeWeeklyHistoryRecord } from '../utils';

interface WeeklyHistoryProps {
    history: WeeklyHistoryRecord[];
    setHistory: React.Dispatch<React.SetStateAction<WeeklyHistoryRecord[]>>;
    canEdit?: boolean;
}

const SERVICE_TYPES: Array<{ value: ServiceType; label: string }> = [
    { value: 'communion', label: 'Communion' },
    { value: 'harvest', label: 'Harvest' },
    { value: 'divine-service', label: 'Divine Service' },
    { value: 'teaching-service', label: 'Teaching Service' },
    { value: 'other', label: 'Other' },
];

const WEEKLY_HISTORY_HEADERS = [
    'Record ID',
    'Date Of Service',
    'Society Name',
    'Preacher',
    'Guest Preacher',
    'Preacher Society',
    'Liturgist',
    'Service Type',
    'Service Type Other',
    'Sermon Topic',
    'Memory Text',
    'Sermon Summary',
    'Worship Highlights',
    'Announcements By',
    'Announcements Key Points',
    'Attendance Adults Male',
    'Attendance Adults Female',
    'Attendance Children',
    'Attendance Adherents',
    'Attendance Catechumens',
    'Attendance Visitors Total',
    'Visitor Names',
    'Special Visitor Name',
    'Special Visitor Position',
    'Special Visitor Summary',
    'New Members Details',
    'New Members Contact',
    'Donations Description',
    'Donations Quantity',
    'Donations Donated By',
    'Events',
    'Observations',
    'Prepared By',
];

const emptyRecord = (): WeeklyHistoryRecord => ({
    id: generateId('history'),
    dateOfService: new Date().toISOString().slice(0, 10),
    societyName: '',
    preacher: '',
    guestPreacher: false,
    preacherSociety: '',
    liturgist: '',
    serviceType: 'divine-service',
    serviceTypeOther: '',
    sermonTopic: '',
    memoryText: '',
    sermonSummary: '',
    worshipHighlights: '',
    announcementsBy: '',
    announcementsKeyPoints: '',
    attendance: {
        adultsMale: 0,
        adultsFemale: 0,
        children: 0,
        adherents: 0,
        catechumens: 0,
        visitors: {
            total: 0,
            names: '',
            specialVisitorName: '',
            specialVisitorPosition: '',
            specialVisitorSummary: '',
        },
    },
    newMembersDetails: '',
    newMembersContact: '',
    donations: {
        description: '',
        quantity: '',
        donatedBy: '',
    },
    events: '',
    observations: '',
    preparedBy: '',
});

const weeklyHistoryToCsvRow = (record: WeeklyHistoryRecord): Record<string, string | number> => {
    const row: Record<string, string | number> = {};
    row['Record ID'] = record.id;
    row['Date Of Service'] = record.dateOfService;
    row['Society Name'] = record.societyName;
    row['Preacher'] = record.preacher;
    row['Guest Preacher'] = record.guestPreacher ? 'true' : 'false';
    row['Preacher Society'] = record.preacherSociety ?? '';
    row['Liturgist'] = record.liturgist ?? '';
    row['Service Type'] = record.serviceType;
    row['Service Type Other'] = record.serviceTypeOther ?? '';
    row['Sermon Topic'] = record.sermonTopic ?? '';
    row['Memory Text'] = record.memoryText ?? '';
    row['Sermon Summary'] = record.sermonSummary ?? '';
    row['Worship Highlights'] = record.worshipHighlights ?? '';
    row['Announcements By'] = record.announcementsBy ?? '';
    row['Announcements Key Points'] = record.announcementsKeyPoints ?? '';
    row['Attendance Adults Male'] = record.attendance.adultsMale;
    row['Attendance Adults Female'] = record.attendance.adultsFemale;
    row['Attendance Children'] = record.attendance.children;
    row['Attendance Adherents'] = record.attendance.adherents;
    row['Attendance Catechumens'] = record.attendance.catechumens;
    row['Attendance Visitors Total'] = record.attendance.visitors.total;
    row['Visitor Names'] = record.attendance.visitors.names ?? '';
    row['Special Visitor Name'] = record.attendance.visitors.specialVisitorName ?? '';
    row['Special Visitor Position'] = record.attendance.visitors.specialVisitorPosition ?? '';
    row['Special Visitor Summary'] = record.attendance.visitors.specialVisitorSummary ?? '';
    row['New Members Details'] = record.newMembersDetails ?? '';
    row['New Members Contact'] = record.newMembersContact ?? '';
    row['Donations Description'] = record.donations.description ?? '';
    row['Donations Quantity'] = record.donations.quantity ?? '';
    row['Donations Donated By'] = record.donations.donatedBy ?? '';
    row['Events'] = record.events ?? '';
    row['Observations'] = record.observations ?? '';
    row['Prepared By'] = record.preparedBy ?? '';
    return row;
};

const weeklyHistoryFromCsvRow = (row: Record<string, string>): WeeklyHistoryRecord => {
    const value = (key: string) => (row[key] ?? '').toString();
    const shaped = {
        id: value('Record ID'),
        dateOfService: value('Date Of Service'),
        societyName: value('Society Name'),
        preacher: value('Preacher'),
        guestPreacher: value('Guest Preacher'),
        preacherSociety: value('Preacher Society'),
        liturgist: value('Liturgist'),
        serviceType: value('Service Type'),
        serviceTypeOther: value('Service Type Other'),
        sermonTopic: value('Sermon Topic'),
        memoryText: value('Memory Text'),
        sermonSummary: value('Sermon Summary'),
        worshipHighlights: value('Worship Highlights'),
        announcementsBy: value('Announcements By'),
        announcementsKeyPoints: value('Announcements Key Points'),
        attendance: {
            adultsMale: value('Attendance Adults Male'),
            adultsFemale: value('Attendance Adults Female'),
            children: value('Attendance Children'),
            adherents: value('Attendance Adherents'),
            catechumens: value('Attendance Catechumens'),
            visitors: {
                total: value('Attendance Visitors Total'),
                names: value('Visitor Names'),
                specialVisitorName: value('Special Visitor Name'),
                specialVisitorPosition: value('Special Visitor Position'),
                specialVisitorSummary: value('Special Visitor Summary'),
            },
        },
        newMembersDetails: value('New Members Details'),
        newMembersContact: value('New Members Contact'),
        donations: {
            description: value('Donations Description'),
            quantity: value('Donations Quantity'),
            donatedBy: value('Donations Donated By'),
        },
        events: value('Events'),
        observations: value('Observations'),
        preparedBy: value('Prepared By'),
    };
    return sanitizeWeeklyHistoryRecord(shaped);
};

const WeeklyHistory: React.FC<WeeklyHistoryProps> = ({ history, setHistory, canEdit = true }) => {
    const [form, setForm] = useState<WeeklyHistoryRecord>(() => emptyRecord());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
    const readOnly = !canEdit;
    const inputClass = 'border border-slate-300 rounded-lg px-3 py-2 disabled:bg-slate-100 disabled:cursor-not-allowed';
    const textareaClass = 'border border-slate-300 rounded-lg px-3 py-2 disabled:bg-slate-100 disabled:cursor-not-allowed';
    const csvInputRef = useRef<HTMLInputElement | null>(null);

    const handleExportCsv = () => {
        if (history.length === 0) {
            setFlash({ tone: 'error', message: 'No weekly history records available to export yet.' });
            return;
        }
        const rows = history.map(record => weeklyHistoryToCsvRow(record));
        const csv = toCsv(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `weekly-history-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        setFlash({ tone: 'success', message: `Exported ${rows.length} weekly history record${rows.length === 1 ? '' : 's'}.` });
    };

    const handleImportCsvChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = typeof reader.result === 'string' ? reader.result : '';
                const parsedRows = fromCsv(text);
                if (!parsedRows || parsedRows.length === 0) {
                    setFlash({ tone: 'error', message: 'The selected CSV file did not contain any records to import.' });
                    return;
                }

                const firstRow = parsedRows[0] as Record<string, string>;
                const missingHeaders = WEEKLY_HISTORY_HEADERS.filter(header => !(header in firstRow));
                if (missingHeaders.length > 0) {
                    setFlash({ tone: 'error', message: `CSV is missing columns: ${missingHeaders.join(', ')}.` });
                    return;
                }

                const sanitizedRecords: WeeklyHistoryRecord[] = [];
                let skipped = 0;
                for (const raw of parsedRows) {
                    const row = raw as Record<string, string>;
                    const hasValues = WEEKLY_HISTORY_HEADERS.some(header => (row[header] ?? '').toString().trim().length > 0);
                    if (!hasValues) {
                        continue;
                    }
                    try {
                        const record = weeklyHistoryFromCsvRow(row);
                        sanitizedRecords.push(record);
                    } catch (error) {
                        console.warn('Skipping invalid weekly history row', error);
                        skipped += 1;
                    }
                }

                if (sanitizedRecords.length === 0) {
                    setFlash({
                        tone: 'error',
                        message: skipped > 0
                            ? 'No weekly history records were imported because each row failed validation.'
                            : 'No weekly history rows were found in the CSV.',
                    });
                    return;
                }

                let added = 0;
                let updatedCount = 0;
                setHistory(prev => {
                    const next = [...prev];
                    sanitizedRecords.forEach(record => {
                        const existingIndex = next.findIndex(item => item.id === record.id);
                        if (existingIndex >= 0) {
                            next[existingIndex] = record;
                            updatedCount += 1;
                        } else {
                            next.push(record);
                            added += 1;
                        }
                    });
                    return next;
                });

                const summaryParts = [`${sanitizedRecords.length} processed`, `${added} added`, `${updatedCount} updated`];
                if (skipped > 0) {
                    summaryParts.push(`${skipped} skipped`);
                }
                setFlash({ tone: 'success', message: `Import complete: ${summaryParts.join(', ')}.` });
            } catch (error) {
                console.error('Failed to import weekly history CSV', error);
                setFlash({ tone: 'error', message: 'Unable to import weekly history. Confirm the CSV matches the exported format.' });
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleDateChange = (value: string) => {
        const existing = history.find(record => record.dateOfService === value);
        if (existing && existing.id !== editingId) {
            setForm({
                ...existing,
                attendance: {
                    ...existing.attendance,
                    visitors: { ...existing.attendance.visitors },
                },
                donations: { ...existing.donations },
            });
            setEditingId(existing.id);
            setExpandedId(existing.id);
        } else {
            setForm(prev => ({ ...prev, dateOfService: value }));
        }
    };

    const resetForm = () => {
        setForm(emptyRecord());
        setEditingId(null);
        setError(null);
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (readOnly) return;
        const requiredMissing: string[] = [];
        if (!form.preacher.trim()) requiredMissing.push('Preacher');
        if (!form.memoryText.trim()) requiredMissing.push('Memory text');
        if (!form.sermonTopic.trim()) requiredMissing.push('Theme');
        const totalAttendance = form.attendance.adultsMale
            + form.attendance.adultsFemale
            + form.attendance.children
            + form.attendance.adherents
            + form.attendance.catechumens
            + form.attendance.visitors.total;
        if (totalAttendance <= 0) requiredMissing.push('Attendance');

        if (requiredMissing.length > 0) {
            setError(`${requiredMissing.join(', ')} must be provided before saving.`);
            return;
        }

        const payload: WeeklyHistoryRecord = {
            ...form,
            attendance: {
                ...form.attendance,
                visitors: { ...form.attendance.visitors },
            },
            donations: { ...form.donations },
        };
        if (editingId) {
            setHistory(prev => prev.map(record => record.id === editingId ? payload : record));
        } else {
            setHistory(prev => [...prev, payload]);
        }
        resetForm();
    };

    const handleEdit = (record: WeeklyHistoryRecord) => {
        setForm({
            ...record,
            attendance: {
                ...record.attendance,
                visitors: { ...record.attendance.visitors },
            },
            donations: { ...record.donations },
        });
        setEditingId(record.id);
        setExpandedId(record.id);
        setError(null);
    };

    const handleDelete = (id: string) => {
        if (readOnly) return;
        if (!window.confirm('Delete this weekly history record?')) return;
        setHistory(prev => prev.filter(record => record.id !== id));
        if (editingId === id) {
            resetForm();
        }
        if (expandedId === id) {
            setExpandedId(null);
        }
        setError(null);
    };

    const totals = useMemo(() => (
        form.attendance.adultsMale
        + form.attendance.adultsFemale
        + form.attendance.children
        + form.attendance.adherents
        + form.attendance.catechumens
        + form.attendance.visitors.total
    ), [form.attendance]);

    const orderedHistory = useMemo(
        () => [...history].sort((a, b) => b.dateOfService.localeCompare(a.dateOfService)),
        [history],
    );

    useEffect(() => {
        if (!flash) return;
        if (typeof window === 'undefined') return;
        const timeout = window.setTimeout(() => setFlash(null), 4000);
        return () => window.clearTimeout(timeout);
    }, [flash]);

    return (
        <div className="space-y-6">
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800">Weekly Attendance CSV</h2>
                    <p className="text-sm text-slate-500">Export or import weekly attendance summaries for archival or reporting.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={handleExportCsv}
                        className="bg-white/80 border border-indigo-200 text-indigo-700 font-semibold px-4 py-2 rounded-lg hover:bg-white"
                    >
                        Export CSV
                    </button>
                    <button
                        type="button"
                        onClick={() => csvInputRef.current?.click()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg"
                    >
                        Import CSV
                    </button>
                </div>
            </section>
            <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCsvChange} />
            {flash && (
                <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${flash.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                    {flash.message}
                </div>
            )}
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-amber-50 to-orange-100/70 p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Record Weekly History</h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {!canEdit && (
                        <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 px-4 py-3 text-sm">
                            Only administrators and statisticians can update weekly history entries.
                        </div>
                    )}
                    {error && (
                        <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
                            {error}
                        </div>
                    )}
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Date of Service</span>
                        <input
                            type="date"
                            value={form.dateOfService}
                            onChange={e => handleDateChange(e.target.value)}
                            className={inputClass}
                            disabled={readOnly}
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Society</span>
                        <input
                            value={form.societyName}
                            onChange={e => setForm(prev => ({ ...prev, societyName: e.target.value }))}
                            className={inputClass}
                            disabled={readOnly}
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Preacher *</span>
                        <input
                            value={form.preacher}
                            onChange={e => setForm(prev => ({ ...prev, preacher: e.target.value }))}
                            className={inputClass}
                            disabled={readOnly}
                            placeholder="Full name of the preacher"
                        />
                    </label>
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Guest Preacher</span>
                        <label className={`flex items-center gap-2 text-sm text-slate-600 bg-white/70 border border-slate-300 rounded-lg px-3 py-2 ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}>
                            <input
                                type="checkbox"
                                checked={form.guestPreacher}
                                onChange={e => setForm(prev => ({ ...prev, guestPreacher: e.target.checked }))}
                                disabled={readOnly}
                            />
                            <span>Check if the preacher is visiting</span>
                        </label>
                    </div>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Preacher's Society</span>
                        <input
                            value={form.preacherSociety}
                            onChange={e => setForm(prev => ({ ...prev, preacherSociety: e.target.value }))}
                            className={inputClass}
                            disabled={readOnly}
                            placeholder="Enter the preacher's home society"
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Liturgist</span>
                        <input
                            value={form.liturgist}
                            onChange={e => setForm(prev => ({ ...prev, liturgist: e.target.value }))}
                            className={inputClass}
                            disabled={readOnly}
                            placeholder="Who led the liturgy"
                        />
                    </label>
                    <div className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-600">Service Type</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {SERVICE_TYPES.map(option => (
                                <label
                                    key={option.value}
                                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${form.serviceType === option.value ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white/80 text-slate-600'} ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name="serviceType"
                                        value={option.value}
                                        checked={form.serviceType === option.value}
                                        onChange={e => setForm(prev => ({ ...prev, serviceType: e.target.value as ServiceType }))}
                                        disabled={readOnly}
                                    />
                                    <span>{option.label}</span>
                                </label>
                            ))}
                        </div>
                        {form.serviceType === 'other' && (
                            <input
                                value={form.serviceTypeOther}
                                onChange={e => setForm(prev => ({ ...prev, serviceTypeOther: e.target.value }))}
                                placeholder="Describe other service type"
                                className={inputClass}
                                disabled={readOnly}
                            />
                        )}
                    </div>
                    <label className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-600">Theme / Sermon Topic *</span>
                        <input
                            value={form.sermonTopic}
                            onChange={e => setForm(prev => ({ ...prev, sermonTopic: e.target.value }))}
                            className={inputClass}
                            disabled={readOnly}
                            placeholder="e.g. Living Faith in Action"
                        />
                    </label>
                    <label className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-600">Memory Text of the Day *</span>
                        <input
                            value={form.memoryText}
                            onChange={e => setForm(prev => ({ ...prev, memoryText: e.target.value }))}
                            className={inputClass}
                            disabled={readOnly}
                            placeholder="Scripture reference or text"
                        />
                    </label>
                    <label className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-600">Sermon Summary</span>
                        <textarea
                            value={form.sermonSummary}
                            onChange={e => setForm(prev => ({ ...prev, sermonSummary: e.target.value }))}
                            className={textareaClass}
                            rows={3}
                            disabled={readOnly}
                            placeholder="Summarize the sermon"
                        />
                    </label>
                    <label className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-600">Highlights</span>
                        <textarea
                            value={form.worshipHighlights}
                            onChange={e => setForm(prev => ({ ...prev, worshipHighlights: e.target.value }))}
                            className={textareaClass}
                            rows={3}
                            disabled={readOnly}
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Announcements Presented By</span>
                        <input
                            value={form.announcementsBy}
                            onChange={e => setForm(prev => ({ ...prev, announcementsBy: e.target.value }))}
                            className={inputClass}
                            disabled={readOnly}
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Prepared By</span>
                        <input
                            value={form.preparedBy}
                            onChange={e => setForm(prev => ({ ...prev, preparedBy: e.target.value }))}
                            className={inputClass}
                            disabled={readOnly}
                        />
                    </label>
                    <label className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-600">Announcement Key Points</span>
                        <textarea
                            value={form.announcementsKeyPoints}
                            onChange={e => setForm(prev => ({ ...prev, announcementsKeyPoints: e.target.value }))}
                            className={textareaClass}
                            rows={3}
                            disabled={readOnly}
                            placeholder="Summarize the major announcements for the day"
                        />
                    </label>
                    <div className="md:col-span-2 rounded-2xl border border-white/70 bg-white/80 p-4 space-y-4">
                        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                            <h3 className="text-base font-semibold text-slate-700">Attendance *</h3>
                            <span className="text-sm text-slate-500">Total recorded: {totals}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-600">Adults - Male</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.attendance.adultsMale}
                                    onChange={e => setForm(prev => ({
                                        ...prev,
                                        attendance: { ...prev.attendance, adultsMale: Math.max(0, Number(e.target.value) || 0) },
                                    }))}
                                    className={inputClass}
                                    disabled={readOnly}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-600">Adults - Female</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.attendance.adultsFemale}
                                    onChange={e => setForm(prev => ({
                                        ...prev,
                                        attendance: { ...prev.attendance, adultsFemale: Math.max(0, Number(e.target.value) || 0) },
                                    }))}
                                    className={inputClass}
                                    disabled={readOnly}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-600">Children</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.attendance.children}
                                    onChange={e => setForm(prev => ({
                                        ...prev,
                                        attendance: { ...prev.attendance, children: Math.max(0, Number(e.target.value) || 0) },
                                    }))}
                                    className={inputClass}
                                    disabled={readOnly}
                                />
                            </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-600">Adherents</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.attendance.adherents}
                                    onChange={e => setForm(prev => ({
                                        ...prev,
                                        attendance: { ...prev.attendance, adherents: Math.max(0, Number(e.target.value) || 0) },
                                    }))}
                                    className={inputClass}
                                    disabled={readOnly}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-600">Catechumen</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.attendance.catechumens}
                                    onChange={e => setForm(prev => ({
                                        ...prev,
                                        attendance: { ...prev.attendance, catechumens: Math.max(0, Number(e.target.value) || 0) },
                                    }))}
                                    className={inputClass}
                                    disabled={readOnly}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-600">Visitors (How many)</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.attendance.visitors.total}
                                    onChange={e => setForm(prev => ({
                                        ...prev,
                                        attendance: {
                                            ...prev.attendance,
                                            visitors: { ...prev.attendance.visitors, total: Math.max(0, Number(e.target.value) || 0) },
                                        },
                                    }))}
                                    className={inputClass}
                                    disabled={readOnly}
                                />
                            </label>
                        </div>
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">Visitor Names</span>
                            <textarea
                                value={form.attendance.visitors.names}
                                onChange={e => setForm(prev => ({
                                    ...prev,
                                    attendance: {
                                        ...prev.attendance,
                                        visitors: { ...prev.attendance.visitors, names: e.target.value },
                                    },
                                }))}
                                className={textareaClass}
                                rows={2}
                                disabled={readOnly}
                                placeholder="List the names of visitors"
                            />
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-600">Special Visitor Name</span>
                                <input
                                    value={form.attendance.visitors.specialVisitorName}
                                    onChange={e => setForm(prev => ({
                                        ...prev,
                                        attendance: {
                                            ...prev.attendance,
                                            visitors: { ...prev.attendance.visitors, specialVisitorName: e.target.value },
                                        },
                                    }))}
                                    className={inputClass}
                                    disabled={readOnly}
                                    placeholder="If applicable"
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-600">Special Visitor Position</span>
                                <input
                                    value={form.attendance.visitors.specialVisitorPosition}
                                    onChange={e => setForm(prev => ({
                                        ...prev,
                                        attendance: {
                                            ...prev.attendance,
                                            visitors: { ...prev.attendance.visitors, specialVisitorPosition: e.target.value },
                                        },
                                    }))}
                                    className={inputClass}
                                    disabled={readOnly}
                                />
                            </label>
                            <label className="flex flex-col gap-2 md:col-span-1">
                                <span className="text-sm font-semibold text-slate-600">Special Visitor Summary</span>
                                <textarea
                                    value={form.attendance.visitors.specialVisitorSummary}
                                    onChange={e => setForm(prev => ({
                                        ...prev,
                                        attendance: {
                                            ...prev.attendance,
                                            visitors: { ...prev.attendance.visitors, specialVisitorSummary: e.target.value },
                                        },
                                    }))}
                                    className={textareaClass}
                                    rows={2}
                                    disabled={readOnly}
                                />
                            </label>
                        </div>
                    </div>
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">Donation Description</span>
                            <input
                                value={form.donations.description}
                                onChange={e => setForm(prev => ({
                                    ...prev,
                                    donations: { ...prev.donations, description: e.target.value },
                                }))}
                                className={inputClass}
                                disabled={readOnly}
                                placeholder="Item donated"
                            />
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">Quantity</span>
                            <input
                                value={form.donations.quantity}
                                onChange={e => setForm(prev => ({
                                    ...prev,
                                    donations: { ...prev.donations, quantity: e.target.value },
                                }))}
                                className={inputClass}
                                disabled={readOnly}
                                placeholder="Qty or amount"
                            />
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">Donated By</span>
                            <input
                                value={form.donations.donatedBy}
                                onChange={e => setForm(prev => ({
                                    ...prev,
                                    donations: { ...prev.donations, donatedBy: e.target.value },
                                }))}
                                className={inputClass}
                                disabled={readOnly}
                                placeholder="Name of donor"
                            />
                        </label>
                    </div>
                    <label className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-600">Events &amp; Observations</span>
                        <textarea
                            value={form.events}
                            onChange={e => setForm(prev => ({ ...prev, events: e.target.value }))}
                            className={textareaClass}
                            rows={2}
                            disabled={readOnly}
                        />
                        <textarea
                            value={form.observations}
                            onChange={e => setForm(prev => ({ ...prev, observations: e.target.value }))}
                            className={textareaClass}
                            rows={2}
                            disabled={readOnly}
                            placeholder="Additional observations"
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">New Members Details</span>
                        <textarea
                            value={form.newMembersDetails}
                            onChange={e => setForm(prev => ({ ...prev, newMembersDetails: e.target.value }))}
                            className={textareaClass}
                            rows={2}
                            disabled={readOnly}
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">New Members Contact</span>
                        <textarea
                            value={form.newMembersContact}
                            onChange={e => setForm(prev => ({ ...prev, newMembersContact: e.target.value }))}
                            className={textareaClass}
                            rows={2}
                            disabled={readOnly}
                        />
                    </label>
                    <div className="md:col-span-2 flex flex-wrap gap-3 items-center">
                        <button
                            type="submit"
                            className={`bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-4 py-2 transition ${readOnly ? 'opacity-60 cursor-not-allowed hover:bg-indigo-600' : ''}`}
                            disabled={readOnly}
                        >
                            {editingId ? 'Update Weekly Record' : 'Save Weekly Record'}
                        </button>
                        {editingId && !readOnly && (
                            <button type="button" onClick={resetForm} className="text-slate-600 hover:text-slate-800 font-semibold">
                                Cancel edit
                            </button>
                        )}
                        <span className="text-sm text-slate-500">Total attendance recorded: {totals}</span>
                    </div>
                </form>
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-sky-50 to-cyan-100/70 p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Submitted Reports</h2>
                <div className="space-y-4">
                    {orderedHistory.map(record => {
                        const total =
                            record.attendance.adultsMale +
                            record.attendance.adultsFemale +
                            record.attendance.children +
                            record.attendance.adherents +
                            record.attendance.catechumens +
                            record.attendance.visitors.total;
                        const isExpanded = expandedId === record.id;
                        return (
                            <div key={record.id} className="rounded-2xl p-4 shadow-sm border border-white/60 bg-gradient-to-br from-white via-emerald-50 to-teal-100/60">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-800">{record.dateOfService} — {record.societyName || 'Untitled service'}</h3>
                                        <p className="text-sm text-slate-500">
                                            Preacher: {record.preacher || 'N/A'} {record.guestPreacher ? '(Guest)' : ''}
                                            {record.preacherSociety && ` — ${record.preacherSociety}`}
                                        </p>
                                        <p className="text-sm text-slate-500">Liturgist: {record.liturgist || 'N/A'}</p>
                                        <p className="text-sm text-slate-500">Total attendance: {total}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedId(prev => prev === record.id ? null : record.id)}
                                            className="text-indigo-600 hover:text-indigo-700 font-semibold"
                                        >
                                            {isExpanded ? 'Hide details' : 'View details'}
                                        </button>
                                        {!readOnly && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => handleEdit(record)}
                                                    className="text-emerald-600 hover:text-emerald-700 font-semibold"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(record.id)}
                                                    className="text-red-500 hover:text-red-600 font-semibold"
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <h4 className="font-semibold text-slate-700">Service Details</h4>
                                                <p>Prepared by: {record.preparedBy || 'N/A'}</p>
                                                <p>Announcements by: {record.announcementsBy || 'N/A'}</p>
                                                {record.announcementsKeyPoints && (
                                                    <p className="mt-1">Announcement highlights: {record.announcementsKeyPoints}</p>
                                                )}
                                                <p>Preacher status: {record.guestPreacher ? 'Guest preacher' : 'Resident preacher'}</p>
                                                {record.preacherSociety && <p>Preacher society: {record.preacherSociety}</p>}
                                                <p>Service type: {serviceTypeLabel(record.serviceType)}</p>
                                                {record.serviceType === 'other' && record.serviceTypeOther && <p>Other: {record.serviceTypeOther}</p>}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-700">Attendance Breakdown</h4>
                                                <ul className="grid grid-cols-2 gap-2 mt-2">
                                                    <li>Adults - Male: <strong>{record.attendance.adultsMale}</strong></li>
                                                    <li>Adults - Female: <strong>{record.attendance.adultsFemale}</strong></li>
                                                    <li>Children: <strong>{record.attendance.children}</strong></li>
                                                    <li>Adherents: <strong>{record.attendance.adherents}</strong></li>
                                                    <li>Catechumen: <strong>{record.attendance.catechumens}</strong></li>
                                                    <li>Visitors: <strong>{record.attendance.visitors.total}</strong></li>
                                                </ul>
                                                {record.attendance.visitors.names && (
                                                    <p className="mt-2">Visitor names: {record.attendance.visitors.names}</p>
                                                )}
                                                {record.attendance.visitors.specialVisitorName && (
                                                    <div className="mt-2 space-y-1">
                                                        <p className="font-semibold text-slate-700">Special Visitor</p>
                                                        <p>Name: {record.attendance.visitors.specialVisitorName}</p>
                                                        {record.attendance.visitors.specialVisitorPosition && (
                                                            <p>Position: {record.attendance.visitors.specialVisitorPosition}</p>
                                                        )}
                                                        {record.attendance.visitors.specialVisitorSummary && (
                                                            <p>Summary: {record.attendance.visitors.specialVisitorSummary}</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {(record.sermonTopic || record.memoryText || record.sermonSummary) && (
                                            <div>
                                                <h4 className="font-semibold text-slate-700">Sermon</h4>
                                                {record.sermonTopic && <p className="mt-1">Topic: {record.sermonTopic}</p>}
                                                {record.memoryText && <p className="mt-1">Memory Text: {record.memoryText}</p>}
                                                {record.sermonSummary && <p className="mt-1">Summary: {record.sermonSummary}</p>}
                                                {record.worshipHighlights && <p className="mt-1">Highlights: {record.worshipHighlights}</p>}
                                            </div>
                                        )}
                                        {(record.donations.description || record.donations.quantity || record.donations.donatedBy) && (
                                            <div>
                                                <h4 className="font-semibold text-slate-700">Donations</h4>
                                                {record.donations.description && <p className="mt-1">Item: {record.donations.description}</p>}
                                                {record.donations.quantity && <p className="mt-1">Quantity: {record.donations.quantity}</p>}
                                                {record.donations.donatedBy && <p className="mt-1">Donated by: {record.donations.donatedBy}</p>}
                                            </div>
                                        )}
                                        {(record.events || record.observations) && (
                                            <div>
                                                <h4 className="font-semibold text-slate-700">Events &amp; Observations</h4>
                                                {record.events && <p className="mt-1">Events: {record.events}</p>}
                                                {record.observations && <p className="mt-1">Observations: {record.observations}</p>}
                                            </div>
                                        )}
                                        {(record.newMembersDetails || record.newMembersContact) && (
                                            <div>
                                                <h4 className="font-semibold text-slate-700">New Members</h4>
                                                {record.newMembersDetails && <p className="mt-1">Details: {record.newMembersDetails}</p>}
                                                {record.newMembersContact && <p className="mt-1">Contact: {record.newMembersContact}</p>}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {orderedHistory.length === 0 && <p className="text-slate-500">No reports submitted yet.</p>}
                </div>
            </section>
        </div>
    );
};

export default WeeklyHistory;
