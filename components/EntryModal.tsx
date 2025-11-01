import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Entry, EntryType, Member, Method, Settings } from '../types';
import { generateId, sanitizeEntryType, sanitizeMethod, ENTRY_TYPE_VALUES, entryTypeLabel } from '../utils';

type EntryModalProps = {
    entry: Entry | null;
    members: Member[];
    settings: Settings;
    onSave: (entry: Entry) => void;
    onSaveAndNew: (entry: Entry) => void;
    onClose: () => void;
    onDelete: (id: string) => void;
};

const methods: Method[] = ['cash', 'check', 'card', 'e-transfer', 'mobile', 'other'];

const MEMBER_PAGE_SIZE = 60;

const createEmptyEntry = (): Entry => ({
    id: generateId('entry'),
    date: new Date().toISOString().slice(0, 10),
    memberID: '',
    memberName: '',
    type: 'tithe',
    fund: 'General',
    method: 'cash',
    amount: 0,
    note: '',
});

const EntryModal: React.FC<EntryModalProps> = ({ entry, members, settings, onSave, onSaveAndNew, onClose, onDelete }) => {
    const [form, setForm] = useState<Entry>(() => entry ?? createEmptyEntry());
    const [memberQuery, setMemberQuery] = useState('');
    const [amountInput, setAmountInput] = useState(() => (entry ? String(entry.amount ?? '') : ''));
    const [isMemberListOpen, setIsMemberListOpen] = useState(false);
    const [visibleMemberCount, setVisibleMemberCount] = useState(MEMBER_PAGE_SIZE);
    const blurTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (entry) {
            setForm(entry);
            setMemberQuery(entry.memberName || '');
            setAmountInput(entry.amount ? String(entry.amount) : entry.amount === 0 ? '0' : '');
            setVisibleMemberCount(MEMBER_PAGE_SIZE);
        } else {
            setForm(createEmptyEntry());
            setMemberQuery('');
            setAmountInput('');
            setVisibleMemberCount(MEMBER_PAGE_SIZE);
        }
    }, [entry]);

    useEffect(() => {
        return () => {
            if (blurTimeoutRef.current) {
                window.clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    const memberOptions = useMemo(
        () =>
            members.map(member => ({
                value: member.id,
                label: member.name,
                display: `${member.name}${member.classNumber ? ` – Class ${member.classNumber}` : ''}`,
            })),
        [members],
    );

    const filteredMemberOptions = useMemo(() => {
        const query = memberQuery.trim().toLowerCase();
        if (!query) return memberOptions;
        return memberOptions.filter(option => {
            const valueMatch = option.value.toLowerCase().includes(query);
            const labelMatch = option.label.toLowerCase().includes(query);
            const displayMatch = option.display.toLowerCase().includes(query);
            return valueMatch || labelMatch || displayMatch;
        });
    }, [memberOptions, memberQuery]);

    useEffect(() => {
        setVisibleMemberCount(MEMBER_PAGE_SIZE);
    }, [memberQuery, memberOptions.length]);

    const displayedMemberOptions = useMemo(
        () => filteredMemberOptions.slice(0, visibleMemberCount),
        [filteredMemberOptions, visibleMemberCount],
    );

    const updateField = <K extends keyof Entry>(key: K, value: Entry[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const resetForNewEntry = () => {
        const emptyEntry = createEmptyEntry();
        setForm(emptyEntry);
        setMemberQuery('');
        setAmountInput('');
        setVisibleMemberCount(MEMBER_PAGE_SIZE);
        setIsMemberListOpen(false);
    };

    const handleAmountChange = (value: string) => {
        setAmountInput(value);
        const parsed = value === '' ? 0 : Number.parseFloat(value);
        updateField('amount', Number.isFinite(parsed) ? parsed : 0);
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (settings.enforceDirectory && !form.memberID) {
            alert('Please select a member from the directory before saving.');
            return;
        }
        const payload = {
            ...form,
            memberName: form.memberName || memberQuery,
            type: sanitizeEntryType(form.type),
            method: sanitizeMethod(form.method),
        };
        onSave(payload);
        if (!entry) {
            resetForNewEntry();
        }
    };

    const handleSaveAndNew = () => {
        if (settings.enforceDirectory && !form.memberID) {
            alert('Please select a member from the directory before saving.');
            return;
        }
        const payload = {
            ...form,
            id: form.id || generateId('entry'),
            memberName: form.memberName || memberQuery,
            type: sanitizeEntryType(form.type),
            method: sanitizeMethod(form.method),
        };
        onSaveAndNew(payload);
        resetForNewEntry();
    };

    const handleMemberMatch = (value: string) => {
        if (blurTimeoutRef.current) {
            window.clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        setIsMemberListOpen(true);
        if (!value) {
            updateField('memberID', '');
            updateField('memberName', '');
            setMemberQuery('');
            setVisibleMemberCount(MEMBER_PAGE_SIZE);
            return;
        }

        const directId = members.find(m => m.id.toLowerCase() === value.toLowerCase());
        if (directId) {
            updateField('memberID', directId.id);
            updateField('memberName', directId.name);
            setMemberQuery(directId.name);
            return;
        }

        const byName = members.find(m => m.name.toLowerCase() === value.toLowerCase());
        if (byName) {
            updateField('memberID', byName.id);
            updateField('memberName', byName.name);
            setMemberQuery(byName.name);
            return;
        }

        const trimmed = value.split(' – ')[0]?.trim() ?? value.trim();
        const byDisplay = members.find(m => m.name.toLowerCase() === trimmed.toLowerCase());
        if (byDisplay) {
            updateField('memberID', byDisplay.id);
            updateField('memberName', byDisplay.name);
            setMemberQuery(byDisplay.name);
            return;
        }

        updateField('memberID', '');
        updateField('memberName', settings.enforceDirectory ? '' : value);
        setMemberQuery(value);
    };

    const handleMemberScroll = (event: React.UIEvent<HTMLDivElement>) => {
        const container = event.currentTarget;
        if (filteredMemberOptions.length <= visibleMemberCount) return;
        const threshold = 24;
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - threshold) {
            setVisibleMemberCount(prev => Math.min(prev + MEMBER_PAGE_SIZE, filteredMemberOptions.length));
        }
    };

    const handleSelectMember = (value: string, label: string) => {
        updateField('memberID', value);
        updateField('memberName', label);
        setMemberQuery(label);
        setIsMemberListOpen(false);
    };

    const handleInputFocus = () => {
        if (blurTimeoutRef.current) {
            window.clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        setIsMemberListOpen(true);
    };

    const handleInputBlur = () => {
        if (blurTimeoutRef.current) {
            window.clearTimeout(blurTimeoutRef.current);
        }
        blurTimeoutRef.current = window.setTimeout(() => {
            setIsMemberListOpen(false);
        }, 120);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-3xl rounded-3xl shadow-2xl border border-white/60 bg-gradient-to-br from-white via-sky-50 to-indigo-100/80">
                <header className="border-b border-white/60 bg-white/60 backdrop-blur p-6 flex items-center justify-between rounded-t-3xl">
                    <h2 className="text-2xl font-bold text-slate-800">{entry ? 'Edit Entry' : 'New Entry'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">Close</button>
                </header>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">Date</span>
                            <input type="date" value={form.date} onChange={e => updateField('date', e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2" required />
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">Fund</span>
                            <input value={form.fund} onChange={e => updateField('fund', e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2" />
                        </label>
                        <label className="flex flex-col gap-2 md:col-span-2">
                            <span className="text-sm font-semibold text-slate-600">Member</span>
                            <div className="relative">
                                <input
                                    value={memberQuery}
                                    onChange={e => handleMemberMatch(e.target.value)}
                                    onFocus={handleInputFocus}
                                    onBlur={handleInputBlur}
                                    placeholder={settings.enforceDirectory ? 'Start typing a name or ID…' : 'Type a name'}
                                    className="border border-slate-300 rounded-lg px-3 py-2 w-full"
                                    required={settings.enforceDirectory}
                                    autoComplete="off"
                                />
                                {isMemberListOpen && (
                                    <div
                                        onScroll={handleMemberScroll}
                                        className="absolute left-0 right-0 z-20 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
                                    >
                                        {displayedMemberOptions.map(option => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onMouseDown={event => event.preventDefault()}
                                                onClick={() => handleSelectMember(option.value, option.label)}
                                                className="flex w-full flex-col items-start gap-0.5 px-4 py-2 text-left hover:bg-indigo-50"
                                            >
                                                <span className="text-sm font-semibold text-slate-700">{option.display}</span>
                                                <span className="text-xs text-slate-500">ID: {option.value}</span>
                                            </button>
                                        ))}
                                        {displayedMemberOptions.length === 0 && (
                                            <div className="px-4 py-3 text-sm text-slate-500">No matching members found.</div>
                                        )}
                                        {visibleMemberCount < filteredMemberOptions.length && displayedMemberOptions.length > 0 && (
                                            <div className="px-4 py-2 text-xs text-slate-500">Scroll to load more members…</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {!settings.enforceDirectory && (
                                <p className="text-xs text-slate-500">Unlisted member? Type their name exactly as you want it saved.</p>
                            )}
                            {form.memberID && (
                                <p className="text-xs text-slate-500">Selected member ID: {form.memberID}</p>
                            )}
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">Type</span>
                            <select value={form.type} onChange={e => updateField('type', e.target.value as EntryType)} className="border border-slate-300 rounded-lg px-3 py-2">
                                {ENTRY_TYPE_VALUES.map(type => (
                                    <option key={type} value={type}>{entryTypeLabel(type)}</option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">Method</span>
                            <select value={form.method} onChange={e => updateField('method', e.target.value as Method)} className="border border-slate-300 rounded-lg px-3 py-2">
                                {methods.map(method => (
                                    <option key={method} value={method}>{method}</option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">Amount</span>
                            <input
                                type="number"
                                step="0.01"
                                inputMode="decimal"
                                value={amountInput}
                                onChange={e => handleAmountChange(e.target.value)}
                                className="border border-slate-300 rounded-lg px-3 py-2"
                                placeholder="0.00"
                            />
                        </label>
                        <label className="flex flex-col gap-2 md:col-span-2">
                            <span className="text-sm font-semibold text-slate-600">Notes</span>
                            <textarea value={form.note ?? ''} onChange={e => updateField('note', e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2" rows={3} />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-3 justify-between">
                        <div className="flex gap-3">
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg">Save</button>
                            <button type="button" onClick={handleSaveAndNew} className="bg-white/80 border border-indigo-200 text-indigo-700 font-semibold px-4 py-2 rounded-lg hover:bg-white">Save &amp; New</button>
                        </div>
                        {entry && (
                            <button type="button" onClick={() => onDelete(entry.id)} className="text-red-500 hover:text-red-600 font-semibold">Delete</button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EntryModal;
