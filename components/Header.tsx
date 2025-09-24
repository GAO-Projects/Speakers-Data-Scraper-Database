
import React from 'react';
import type { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="bg-slate-800 shadow-md p-4 flex justify-between items-center">
      <div className="flex items-center space-x-3">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a3.002 3.002 0 013.286-1.487M10 13a3 3 0 100-6 3 3 0 000 6zm-7 7a3 3 0 013.286-1.487M3 13a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
        <h1 className="text-2xl font-bold text-white">Scraping Data Speaker</h1>
      </div>
      {user && (
        <div className="flex items-center space-x-4">
          <span className="text-slate-300">Welcome, {user.email}</span>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 transition duration-200"
          >
            Logout
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;
