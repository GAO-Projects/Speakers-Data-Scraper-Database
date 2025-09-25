// This file is now a real API client, not a mock.
import type { User, SpeakerData } from './types';

const API_BASE_URL = '/api';

// Helper function for all API requests
async function apiFetch(endpoint: string, options: RequestInit = {}, returnsBlob = false) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Try to parse error message from backend, otherwise use default
      const errorData = await response.json().catch(() => ({ message: `Request failed with status ${response.status}` }));
      throw new Error(errorData.message || `Request failed`);
    }

    if (returnsBlob) {
        return response.blob();
    }

    // For DELETE or other methods that might not return a body (e.g., 204 No Content)
    if (response.status === 204) {
      return null;
    }
    
    return response.json();
  } catch (error) {
    // Re-throw the error so component-level error handlers can catch it
    console.error(`API call to ${endpoint} failed:`, error);
    throw error;
  }
}

// --- User Management ---

export const login = async (email: string, pass: string): Promise<User | null> => {
  try {
    const user = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    return user as User | null;
  } catch (error) {
    // Login is a special case where we want to return null on failure, not crash
    return null;
  }
};

export const getAllUsers = (): Promise<User[]> => {
    const cacheBuster = `?_=${Date.now()}`;
    return apiFetch(`/users${cacheBuster}`) as Promise<User[]>;
};

export const addUser = (email: string, password?: string, isAdmin?: boolean): Promise<User & { password?: string }> => {
  // Password is now optional. Backend will generate if it's not provided.
  return apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, isAdmin }),
  }) as Promise<User & { password?: string }>;
};

export const updateUser = (originalEmail: string, updatedUser: User): Promise<User> => {
  const { password } = updatedUser;
  // Only include password in payload if it's being changed
  const payload: { email: string; password?: string } = { email: updatedUser.email };
  if (password) {
    payload.password = password;
  }
  return apiFetch(`/users/${encodeURIComponent(originalEmail)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }) as Promise<User>;
};

export const changePassword = (email: string, currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    return apiFetch('/users/change-password', {
        method: 'PUT',
        body: JSON.stringify({ email, currentPassword, newPassword }),
    }) as Promise<{ message: string }>;
};

export const deleteUser = (email: string): Promise<void> => {
  return apiFetch(`/users/${encodeURIComponent(email)}`, { method: 'DELETE' }) as Promise<void>;
};

export const exportInterns = (): Promise<Blob> => {
    const cacheBuster = `?_=${Date.now()}`;
    return apiFetch(`/users/export/interns${cacheBuster}`, { method: 'GET' }, true) as Promise<Blob>;
};

// --- Speaker Data Management ---

export const getSpeakerDataByUser = (email: string): Promise<SpeakerData[]> => {
  const cacheBuster = `?_=${Date.now()}`;
  return apiFetch(`/speakers/user/${encodeURIComponent(email)}${cacheBuster}`) as Promise<SpeakerData[]>;
};

export const getAllSpeakerData = (): Promise<SpeakerData[]> => {
    const cacheBuster = `?_=${Date.now()}`;
    return apiFetch(`/speakers${cacheBuster}`) as Promise<SpeakerData[]>;
};

export const addSpeakerData = (data: Omit<SpeakerData, 'id'>): Promise<SpeakerData> => {
  return apiFetch('/speakers', {
    method: 'POST',
    body: JSON.stringify(data),
  }) as Promise<SpeakerData>;
};

export const updateSpeakerData = (data: SpeakerData): Promise<SpeakerData> => {
  return apiFetch(`/speakers/${data.id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }) as Promise<SpeakerData>;
};

export const deleteSpeakerData = (id: string): Promise<void> => {
  return apiFetch(`/speakers/${id}`, { method: 'DELETE' }) as Promise<void>;
};

export const isBusinessEmailInUse = async (businessEmail: string, speakerIdToExclude?: string): Promise<boolean> => {
  const params = new URLSearchParams({
    '_': Date.now().toString()
  });
  if (speakerIdToExclude) {
    params.set('exclude', speakerIdToExclude);
  }
  const result: {inUse: boolean} = await apiFetch(`/speakers/email-check/${encodeURIComponent(businessEmail)}?${params.toString()}`) as {inUse: boolean};
  return result.inUse;
};

export const bulkAddSpeakerData = (data: Omit<SpeakerData, 'id'>[]): Promise<{ importedCount: number; skippedCount: number; }> => {
  return apiFetch('/speakers/bulk', {
    method: 'POST',
    body: JSON.stringify(data),
  }) as Promise<{ importedCount: number; skippedCount: number; }>;
};

export const exportAllSpeakers = (): Promise<Blob> => {
    const cacheBuster = `?_=${Date.now()}`;
    return apiFetch(`/speakers/export${cacheBuster}`, { method: 'GET' }, true) as Promise<Blob>;
};

export const exportUserSpeakers = (email: string): Promise<Blob> => {
    const cacheBuster = `?_=${Date.now()}`;
    return apiFetch(`/speakers/export/user/${encodeURIComponent(email)}${cacheBuster}`, { method: 'GET' }, true) as Promise<Blob>;
};
