import React, { useMemo, useRef, useState } from 'react';
import type { Member, Settings } from '../types';
import { fromCsv, generateId, sanitizeMember } from '../utils';

interface MembersProps {
    members: Member[];
    setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
    settings: Settings;
    canViewContributionReport: boolean;
    onViewContributionReport: (memberId: string) => void;
}

const Members: React.FC<MembersProps> = ({ members, setMembers, settings, canViewContributionReport, onViewContributionReport }) => {
    const [name, setName] = useState('');
    const [classNumber, setClassNumber] = useState('');
    const [search, setSearch] = useState('');
    const [classFilter, setClassFilter] = useState<'all' | string>('all');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editClassNumber, setEditClassNumber] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const filteredMembers = useMemo(() => {
        const query = search.trim().toLowerCase();
        return members
            .filter(member => {
                if (!query) return true;
                const nameMatch = member.name.toLowerCase().includes(query);
                const idMatch = member.id.toLowerCase().includes(query);
                return nameMatch || idMatch;
            })
            .filter(member => (classFilter === 'all' ? true : (member.classNumber ?? '') === classFilter));
    }, [members, search, classFilter]);

    const handleAdd = (event: React.FormEvent) => {
        event.preventDefault();
        if (!name.trim()) return;
        setMembers(prev => [...prev, { id: generateId('member'), name: name.trim(), classNumber: classNumber || undefined }]);
        setName('');
        setClassNumber('');
    };

    const handleRemove = (id: string) => {
        if (!window.confirm('Remove this member from the directory?')) return;
        setMembers(prev => prev.filter(member => member.id !== id));
    };

    const handleEdit = (member: Member) => {
        setEditingId(member.id);
        setEditName(member.name);
        setEditClassNumber(member.classNumber ?? '');
    };

    const handleUpdate = () => {
        if (!editingId) return;
        if (!editName.trim()) {
            alert('Member name cannot be empty.');
            return;
        }
        setMembers(prev => prev.map(member => member.id === editingId ? {
            ...member,
            name: editName.trim(),
            classNumber: editClassNumber || undefined,
        } : member));
        setEditingId(null);
        setEditName('');
        setEditClassNumber('');
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditClassNumber('');
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = reader.result as string;
                const rows = fromCsv(text);
                const sanitized = rows.map(row => sanitizeMember(row));
                setMembers(prev => {
                    const existingIds = new Set(prev.map(member => member.id));
                    const next = [...prev];
                    sanitized.forEach(member => {
                        if (!existingIds.has(member.id)) {
                            next.push(member);
                        }
                    });
                    return next;
                });
                alert(`Imported ${sanitized.length} members from CSV.`);
            } catch (error) {
                console.error('Unable to import members CSV', error);
                alert('Import failed. Ensure the CSV has headers like "name" and "classNumber".');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    return (
        <div className="space-y-6">
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-emerald-50 to-teal-100/70 p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Add Member</h2>
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="border border-slate-300 rounded-lg px-3 py-2" />
                    <select value={classNumber} onChange={e => setClassNumber(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2">
                        <option value="">No class assigned</option>
                        {Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1)).map(num => (
                            <option key={num} value={num}>Class {num}</option>
                        ))}
                    </select>
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-3 py-2">Add Member</button>
                </form>
                <div className="flex flex-wrap gap-3 mt-4">
                    <button type="button" onClick={handleImportClick} className="bg-white/80 border border-emerald-200 text-emerald-700 font-semibold rounded-lg px-3 py-2 hover:bg-white">
                        Import Members (CSV)
                    </button>
                    <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                    <p className="text-sm text-slate-500">CSV headers supported: <code>name</code>, <code>classNumber</code>, <code>spId</code>, <code>id</code>.</p>
                </div>
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-sky-50 to-indigo-100/70 p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Member Directory</h2>
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID" className="border border-slate-300 rounded-lg px-3 py-2 w-full sm:w-64" />
                        <select value={classFilter} onChange={e => setClassFilter(e.target.value as typeof classFilter)} className="border border-slate-300 rounded-lg px-3 py-2 w-full sm:w-40">
                            <option value="all">All classes</option>
                            {Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1)).map(num => (
                                <option key={num} value={num}>Class {num}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-slate-600">
                        <thead className="uppercase text-sm text-slate-500 border-b">
                            <tr>
                                <th className="px-4 py-2">Name</th>
                                <th className="px-4 py-2">Class</th>
                                <th className="px-4 py-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMembers.map(member => (
                                <tr key={member.id} className="border-b last:border-0">
                                    <td className="px-4 py-2 font-medium text-slate-800">
                                        {editingId === member.id ? (
                                            <input value={editName} onChange={e => setEditName(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 w-full" />
                                        ) : (
                                            member.name
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {editingId === member.id ? (
                                            <select value={editClassNumber} onChange={e => setEditClassNumber(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1">
                                                <option value="">No class</option>
                                                {Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1)).map(num => (
                                                    <option key={num} value={num}>Class {num}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            member.classNumber ? `Class ${member.classNumber}` : '—'
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {editingId === member.id ? (
                                            <div className="flex flex-wrap gap-3">
                                                <button onClick={handleUpdate} className="text-emerald-600 hover:text-emerald-700 font-semibold">Save</button>
                                                <button onClick={handleCancelEdit} className="text-slate-500 hover:text-slate-600 font-semibold">Cancel</button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-3">
                                                <button onClick={() => handleEdit(member)} className="text-indigo-600 hover:text-indigo-700 font-semibold">Edit</button>
                                                <button onClick={() => handleRemove(member.id)} className="text-red-500 hover:text-red-600 font-semibold">Remove</button>
                                                {canViewContributionReport && (
                                                    <button
                                                        onClick={() => onViewContributionReport(member.id)}
                                                        className="text-emerald-600 hover:text-emerald-700 font-semibold"
                                                    >
                                                        View Contribution Report
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredMembers.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">No members found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default Members;
