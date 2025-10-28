import React, { useState } from 'react';

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
                    <span className="inline-flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                        <svg
                            aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 64 64"
                            className="h-9 w-9"
                        >
                            <rect x="6" y="20" width="52" height="24" rx="4" className="fill-current opacity-30" />
                            <rect x="10" y="24" width="44" height="16" rx="2" className="fill-current" />
                            <path
                                className="fill-current opacity-70"
                                d="M20 48h24l4 6H16l4-6zm20-18-6 6-6-6h4v-4h4v4h4z"
                            />
                        </svg>
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
