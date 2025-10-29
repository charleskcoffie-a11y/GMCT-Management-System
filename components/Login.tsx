import React, { useState } from 'react';
import gmctLogo from '../assets/gmct-logo.svg';

interface LoginProps {
    onLogin: (username: string, password: string) => void;
    error: string | null;
}

const Login: React.FC<LoginProps> = ({ onLogin, error }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        onLogin(username, password);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-md rounded-3xl shadow-2xl border border-white/20 bg-white/90 backdrop-blur p-8">
                <div className="flex items-start gap-4 mb-6">
                    <span className="inline-flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 shadow-sm">
                        <img src={gmctLogo} alt="GMCT crest" className="h-12 w-12 object-contain" />
                    </span>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800">GMCT Management System</h1>
                        <p className="mt-1 text-sm text-slate-600">Enter your credentials and press <span className="font-semibold text-slate-800">Enter</span> to log in.</p>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1">Username</label>
                        <input value={username} onChange={e => setUsername(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 w-full" autoComplete="username" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 w-full" autoComplete="current-password" />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg">Sign in</button>
                </form>
            </div>
        </div>
    );
};

export default Login;
