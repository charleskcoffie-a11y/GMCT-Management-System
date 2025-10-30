import React, { useEffect, useMemo, useState } from 'react';
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
    const [editingUsername, setEditingUsername] = useState<string | null>(null);
    const [editUsername, setEditUsername] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editRole, setEditRole] = useState<User['role']>('finance');
    const [editClassLed, setEditClassLed] = useState('');

    const filteredUsers = useMemo(() => {
        return users.filter(user => user.username.toLowerCase().includes(search.toLowerCase()));
    }, [users, search]);

    const handleAdd = (event: React.FormEvent) => {
        event.preventDefault();
        if (!username.trim()) return;
        if (users.some(user => user.username.toLowerCase() === username.trim().toLowerCase())) {
            alert('A user with that username already exists. Please choose a different username.');
            return;
        }
        setUsers(prev => [...prev, { username: username.trim(), password: password || undefined, role, classLed: classLed || undefined }]);
        setUsername('');
        setPassword('');
        setClassLed('');
    };

    const handleRemove = (usernameToRemove: string) => {
        if (!window.confirm('Remove this user?')) return;
        setUsers(prev => prev.filter(user => user.username !== usernameToRemove));
    };

    const handleStartEdit = (user: User) => {
        setEditingUsername(user.username);
        setEditUsername(user.username);
        setEditPassword(user.password ?? '');
        setEditRole(user.role);
        setEditClassLed(user.classLed ?? '');
    };

    const handleCancelEdit = () => {
        setEditingUsername(null);
        setEditUsername('');
        setEditPassword('');
        setEditClassLed('');
    };

    const handleSaveEdit = () => {
        if (!editingUsername) return;
        const trimmedUsername = editUsername.trim();
        if (!trimmedUsername) {
            alert('Username cannot be empty.');
            return;
        }
        const duplicate = users.some(user => user.username.toLowerCase() === trimmedUsername.toLowerCase() && user.username !== editingUsername);
        if (duplicate) {
            alert('A different user already uses that username.');
            return;
        }
        setUsers(prev => prev.map(user => {
            if (user.username !== editingUsername) return user;
            return {
                ...user,
                username: trimmedUsername,
                password: editPassword || undefined,
                role: editRole,
                classLed: editRole === 'class-leader' ? (editClassLed || undefined) : undefined,
            };
        }));
        handleCancelEdit();
    };

    useEffect(() => {
        if (role !== 'class-leader' && classLed) {
            setClassLed('');
        }
    }, [role, classLed]);

    useEffect(() => {
        if (editRole !== 'class-leader' && editClassLed) {
            setEditClassLed('');
        }
    }, [editRole, editClassLed]);

    return (
        <div className="space-y-6">
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-sky-100/70 p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Add User</h2>
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="border border-slate-300 rounded-lg px-3 py-2" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="border border-slate-300 rounded-lg px-3 py-2" />
                    <select value={role} onChange={e => setRole(e.target.value as User['role'])} className="border border-slate-300 rounded-lg px-3 py-2">
                        <option value="admin">Admin</option>
                        <option value="finance">Finance</option>
                        <option value="class-leader">Class Leader</option>
                        <option value="statistician">Statistician</option>
                    </select>
                    <input value={classLed} onChange={e => setClassLed(e.target.value)} placeholder="Class (optional)" className="border border-slate-300 rounded-lg px-3 py-2" disabled={role !== 'class-leader'} />
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-3 py-2 md:col-span-5">Add User</button>
                </form>
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-rose-50 to-pink-100/70 p-6">
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
                            <th className="px-4 py-2">Password</th>
                            <th className="px-4 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(user => {
                            const isEditing = editingUsername === user.username;
                            return (
                                <tr key={user.username} className="border-b last:border-0">
                                    <td className="px-4 py-2 font-medium text-slate-800">
                                        {isEditing ? (
                                            <input value={editUsername} onChange={e => setEditUsername(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 w-full" />
                                        ) : (
                                            user.username
                                        )}
                                    </td>
                                    <td className="px-4 py-2 capitalize">
                                        {isEditing ? (
                                            <select value={editRole} onChange={e => setEditRole(e.target.value as User['role'])} className="border border-slate-300 rounded-lg px-2 py-1 w-full">
                                                <option value="admin">Admin</option>
                                                <option value="finance">Finance</option>
                                                <option value="class-leader">Class Leader</option>
                                                <option value="statistician">Statistician</option>
                                            </select>
                                        ) : (
                                            user.role
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {isEditing ? (
                                            <input value={editClassLed} onChange={e => setEditClassLed(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 w-full" disabled={editRole !== 'class-leader'} placeholder="Class (optional)" />
                                        ) : (
                                            user.classLed ?? '—'
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {isEditing ? (
                                            <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 w-full" placeholder="Password (optional)" />
                                        ) : (
                                            user.password ? '••••••' : '—'
                                        )}
                                    </td>
                                    <td className="px-4 py-2 space-x-3">
                                        {isEditing ? (
                                            <>
                                                <button type="button" onClick={handleSaveEdit} className="text-emerald-600 hover:text-emerald-700 font-semibold">Save</button>
                                                <button type="button" onClick={handleCancelEdit} className="text-slate-500 hover:text-slate-600 font-semibold">Cancel</button>
                                            </>
                                        ) : (
                                            <div className="flex flex-wrap gap-3">
                                                <button type="button" onClick={() => handleStartEdit(user)} className="text-indigo-600 hover:text-indigo-700 font-semibold">Edit</button>
                                                <button type="button" onClick={() => handleRemove(user.username)} className="text-red-500 hover:text-red-600 font-semibold">Remove</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredUsers.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No users found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
};

export default UsersTab;
