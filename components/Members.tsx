import React, { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Member, Settings } from '../types';

interface MembersProps {
    members: Member[];
    setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
    settings: Settings;
}

const Members: React.FC<MembersProps> = ({ members, setMembers, settings }) => {
    const [name, setName] = useState('');
    const [classNumber, setClassNumber] = useState('');
    const [search, setSearch] = useState('');

    const filteredMembers = useMemo(() => {
        return members.filter(member => member.name.toLowerCase().includes(search.toLowerCase()));
    }, [members, search]);

    const handleAdd = (event: React.FormEvent) => {
        event.preventDefault();
        if (!name.trim()) return;
        setMembers(prev => [...prev, { id: uuidv4(), name: name.trim(), classNumber: classNumber || undefined }]);
        setName('');
        setClassNumber('');
    };

    const handleRemove = (id: string) => {
        if (!window.confirm('Remove this member from the directory?')) return;
        setMembers(prev => prev.filter(member => member.id !== id));
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
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-sky-50 to-indigo-100/70 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Member Directory</h2>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members" className="border border-slate-300 rounded-lg px-3 py-2 w-full md:w-64" />
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
                                    <td className="px-4 py-2 font-medium text-slate-800">{member.name}</td>
                                    <td className="px-4 py-2">{member.classNumber ? `Class ${member.classNumber}` : '—'}</td>
                                    <td className="px-4 py-2">
                                        <button onClick={() => handleRemove(member.id)} className="text-red-500 hover:text-red-600 font-semibold">Remove</button>
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
