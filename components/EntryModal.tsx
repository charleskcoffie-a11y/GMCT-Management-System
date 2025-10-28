import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Entry, EntryType, Member, Method, Settings } from '../types';
import { sanitizeEntryType, sanitizeMethod } from '../utils';

type EntryModalProps = {
    entry: Entry | null;
    members: Member[];
    settings: Settings;
    onSave: (entry: Entry) => void;
    onSaveAndNew: (entry: Entry) => void;
    onClose: () => void;
    onDelete: (id: string) => void;
};

const entryTypes: EntryType[] = ['tithe', 'offering', 'first-fruit', 'pledge', 'harvest-levy', 'other'];
const methods: Method[] = ['cash', 'check', 'card', 'e-transfer', 'mobile', 'other'];

const EntryModal: React.FC<EntryModalProps> = ({ entry, members, settings, onSave, onSaveAndNew, onClose, onDelete }) => {
    const [form, setForm] = useState<Entry>(() => entry ?? {
        id: uuidv4(),
        date: new Date().toISOString().slice(0, 10),
        memberID: '',
        memberName: '',
        type: 'tithe',
        fund: 'General',
        method: 'cash',
        amount: 0,
        note: '',
    });

    useEffect(() => {
        if (entry) {
            setForm(entry);
        } else {
            setForm({
                id: uuidv4(),
                date: new Date().toISOString().slice(0, 10),
                memberID: '',
                memberName: '',
                type: 'tithe',
                fund: 'General',
                method: 'cash',
                amount: 0,
                note: '',
            });
        }
    }, [entry]);

    const memberOptions = useMemo(() => members.map(member => ({ value: member.id, label: member.name })), [members]);

    const updateField = <K extends keyof Entry>(key: K, value: Entry[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        onSave({ ...form, type: sanitizeEntryType(form.type), method: sanitizeMethod(form.method) });
    };

    const handleSaveAndNew = () => {
        const payload = { ...form, id: form.id || uuidv4(), type: sanitizeEntryType(form.type), method: sanitizeMethod(form.method) };
        onSaveAndNew(payload);
        setForm({
            id: uuidv4(),
            date: new Date().toISOString().slice(0, 10),
            memberID: '',
            memberName: '',
            type: 'tithe',
            fund: 'General',
            method: 'cash',
            amount: 0,
            note: '',
        });
    };

    const handleMemberChange = (memberId: string) => {
        const member = members.find(m => m.id === memberId);
        updateField('memberID', memberId);
        if (member) {
            updateField('memberName', member.name);
        } else {
            updateField('memberName', '');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
                <header className="border-b border-slate-200 p-6 flex items-center justify-between">
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
                            <select value={form.memberID} onChange={e => handleMemberChange(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2" required={settings.enforceDirectory}>
                                <option value="">Select member</option>
                                {memberOptions.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            {!settings.enforceDirectory && (
                                <input value={form.memberName} onChange={e => updateField('memberName', e.target.value)} placeholder="Member name" className="border border-slate-300 rounded-lg px-3 py-2" />
                            )}
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">Type</span>
                            <select value={form.type} onChange={e => updateField('type', e.target.value as EntryType)} className="border border-slate-300 rounded-lg px-3 py-2">
                                {entryTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
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
                            <input type="number" step="0.01" value={form.amount} onChange={e => updateField('amount', Number(e.target.value))} className="border border-slate-300 rounded-lg px-3 py-2" />
                        </label>
                        <label className="flex flex-col gap-2 md:col-span-2">
                            <span className="text-sm font-semibold text-slate-600">Notes</span>
                            <textarea value={form.note ?? ''} onChange={e => updateField('note', e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2" rows={3} />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-3 justify-between">
                        <div className="flex gap-3">
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg">Save</button>
                            <button type="button" onClick={handleSaveAndNew} className="bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-lg hover:bg-slate-100">Save &amp; New</button>
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
