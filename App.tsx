import React, { useState, useEffect } from 'react';
import type { User, SpeakerData } from './types';
import * as api from './mockApi';
import Header from './components/Header';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import UserPanel from './components/UserPanel';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [speakerDataList, setSpeakerDataList] = useState<SpeakerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  const refetchSpeakerData = async () => {
    if (currentUser && !currentUser.isAdmin) {
      const data = await api.getSpeakerDataByUser(currentUser.email);
      setSpeakerDataList(data);
    }
  };

  const handleLogin = async (email: string, pass: string) => {
    setLoginError(null);
    setIsLoading(true);
    const user = await api.login(email, pass);
    if (user) {
      setCurrentUser(user);
      if (!user.isAdmin) {
        await refetchSpeakerData();
      }
    } else {
      setLoginError('Invalid email or password.');
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSpeakerDataList([]);
  };

  const handleAddSpeaker = async (newSpeakerData: Omit<SpeakerData, 'id' | 'createdBy'>): Promise<SpeakerData | null> => {
    if (currentUser) {
      const dataWithCreator = { ...newSpeakerData, createdBy: currentUser.email };
      const addedSpeaker = await api.addSpeakerData(dataWithCreator);
      if (addedSpeaker) {
        setSpeakerDataList(prev => [...prev, addedSpeaker]);
        return addedSpeaker;
      }
    }
    return null;
  };

  const handleUpdateSpeaker = async (updatedSpeaker: SpeakerData) => {
    await api.updateSpeakerData(updatedSpeaker);
    setSpeakerDataList(prev => prev.map(s => s.id === updatedSpeaker.id ? updatedSpeaker : s));
  };

  const handleDeleteSpeaker = async (speakerId: string) => {
    await api.deleteSpeakerData(speakerId);
    setSpeakerDataList(prev => prev.filter(s => s.id !== speakerId));
  };
  
  const renderContent = () => {
    if (isLoading && !currentUser) {
      return (
        <div className="min-h-screen bg-slate-900 flex justify-center items-center">
            <div className="text-white text-2xl">Loading...</div>
        </div>
      );
    }

    if (!currentUser) {
      return <Login onLogin={handleLogin} error={loginError} />;
    }

    return (
      <div className="min-h-screen bg-slate-900 text-slate-200">
        <Header user={currentUser} onLogout={handleLogout} />
        <main>
          {currentUser.isAdmin ? (
            <AdminPanel currentUser={currentUser} />
          ) : (
            <UserPanel 
              data={speakerDataList} 
              onAddSpeaker={handleAddSpeaker}
              onUpdateSpeaker={handleUpdateSpeaker}
              onDeleteSpeaker={handleDeleteSpeaker}
              currentUserEmail={currentUser.email}
              onDataImported={refetchSpeakerData}
            />
          )}
        </main>
      </div>
    );
  };

  return <>{renderContent()}</>;
};

export default App;
