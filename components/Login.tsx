import React, { useState } from 'react';

interface LoginProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  error: string | null;
}

const Login: React.FC<LoginProps> = ({ onLogin, error }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await onLogin(email, password);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 mb-4">
          <div className="flex justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-400" fill="none" viewBox="0 0 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a3.002 3.002 0 013.286-1.487M10 13a3 3 0 100-6 3 3 0 000 6zm-7 7a3 3 0 013.286-1.487M3 13a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-center text-white mb-2">Scraping Data Speaker</h1>
          <p className="text-center text-slate-400 mb-8">Please sign in to continue</p>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-slate-300 text-sm font-bold mb-2" htmlFor="email">
                Email Address
              </label>
              <input
                className="w-full px-3 py-2 text-slate-200 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200"
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="mb-6">
              <label className="block text-slate-300 text-sm font-bold mb-2" htmlFor="password">
                Password
              </label>
              <input
                className="w-full px-3 py-2 text-slate-200 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200"
                id="password"
                type="password"
                placeholder="******************"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {error && <p className="bg-red-900 border border-red-700 text-red-300 text-xs italic p-3 rounded-md mb-4">{error}</p>}
            <div className="flex items-center justify-between">
              <button
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
        <p className="text-center text-slate-500 text-xs">
          &copy;2025 Scraping Data For Speaker. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
