import React, { useMemo, useState } from 'react';
import type { User } from '../types';

interface UsersTabProps {
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const UsersTab: React.FC<UsersTabProps> = ({ users, setUsers }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<User['role']>('finance');
    const [classLed, setClassLed] = useState('');
    const [search, setSearch] = useState('');

    const filteredUsers = useMemo(() => {
        return users.filter(user => user.username.toLowerCase().includes(search.toLowerCase()));
    }, [users, search]);

    const handleAdd = (event: React.FormEvent) => {
        event.preventDefault();
        if (!username.trim()) return;
        setUsers(prev => [...prev, { username: username.trim(), password: password || undefined, role, classLed: classLed || undefined }]);
        setUsername('');
        setPassword('');
        setClassLed('');
    };

    const handleRemove = (usernameToRemove: string) => {
        if (!window.confirm('Remove this user?')) return;
        setUsers(prev => prev.filter(user => user.username !== usernameToRemove));
    };

    return (
        <div className="space-y-6">
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-sky-100/70 p-6">
 codex/restore-missing-imports-for-app.tsx
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-sky-100/70 p-6">

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
 main
                <h2 className="text-xl font-bold text-slate-800 mb-4">Add User</h2>
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="border border-slate-300 rounded-lg px-3 py-2" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="border border-slate-300 rounded-lg px-3 py-2" />
                    <select value={role} onChange={e => setRole(e.target.value as User['role'])} className="border border-slate-300 rounded-lg px-3 py-2">
                        <option value="admin">Admin</option>
                        <option value="finance">Finance</option>
                        <option value="class-leader">Class Leader</option>
                        <option value="statistician">Statistician</option>
                    </select>
                    <input value={classLed} onChange={e => setClassLed(e.target.value)} placeholder="Class (optional)" className="border border-slate-300 rounded-lg px-3 py-2" />
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-3 py-2 md:col-span-4">Add User</button>
                </form>
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-rose-50 to-pink-100/70 p-6">
 codex/restore-missing-imports-for-app.tsx
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-rose-50 to-pink-100/70 p-6">

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
 main
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Existing Users</h2>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users" className="border border-slate-300 rounded-lg px-3 py-2 w-full md:w-64" />
                </div>
                <table className="w-full text-left text-slate-600">
                    <thead className="uppercase text-sm text-slate-500 border-b">
                        <tr>
                            <th className="px-4 py-2">Username</th>
                            <th className="px-4 py-2">Role</th>
                            <th className="px-4 py-2">Class</th>
                            <th className="px-4 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(user => (
                            <tr key={user.username} className="border-b last:border-0">
                                <td className="px-4 py-2 font-medium text-slate-800">{user.username}</td>
                                <td className="px-4 py-2 capitalize">{user.role}</td>
                                <td className="px-4 py-2">{user.classLed ?? '—'}</td>
                                <td className="px-4 py-2">
                                    <button onClick={() => handleRemove(user.username)} className="text-red-500 hover:text-red-600 font-semibold">Remove</button>
                                </td>
                            </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">No users found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
};

export default UsersTab;
