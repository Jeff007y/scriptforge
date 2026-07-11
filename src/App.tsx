/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle, signOut } from './lib/firebase';
import { useStore } from './store';
import { Loader2, Clapperboard, LogOut, LayoutDashboard, Type, Users, Layout } from 'lucide-react';
import { cn } from './lib/utils';
import { Dashboard } from './pages/Dashboard';
import { Workspace } from './pages/Workspace';
import { Projects } from './pages/Projects';
import { GlobalCharacters, GlobalBeatBoard, GlobalSettings } from './pages/GlobalPages';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u) {
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('./lib/firebase');
          const docSnap = await getDoc(doc(db, 'users', u.uid));
          if (docSnap.exists() && docSnap.data().settings) {
            const settings = docSnap.data().settings;
            // @ts-ignore
            window.__GLOBAL_SETTINGS__ = settings;
            
            if (settings.theme === 'light') {
              document.documentElement.classList.add('light');
              document.documentElement.classList.remove('dark');
            } else {
              document.documentElement.classList.add('dark');
              document.documentElement.classList.remove('light');
            }
          }
        } catch (e) {
          console.error("Failed to load global settings", e);
        }
      } else {
        // Reset to dark if logged out
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
      
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginScreen />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/projects" element={user ? <Projects /> : <Navigate to="/login" />} />
        <Route path="/editor/:projectId/*" element={user ? <Workspace /> : <Navigate to="/login" />} />
        
        <Route path="/characters" element={user ? <GlobalCharacters /> : <Navigate to="/login" />} />
        <Route path="/beat-board" element={user ? <GlobalBeatBoard /> : <Navigate to="/login" />} />
        <Route path="/settings" element={user ? <GlobalSettings /> : <Navigate to="/login" />} />
        
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </div>
  );
}

function LoginScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex justify-center flex-col items-center gap-4">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Clapperboard className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-sans tracking-tight font-medium text-white">ScriptForge</h1>
          <p className="text-slate-400 font-mono text-sm">Professional Screenplay Platform</p>
        </div>
        
        <div className="mt-12">
          <button 
            onClick={() => signInWithGoogle()}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 px-6 py-4 rounded-xl font-medium tracking-wide hover:bg-slate-100 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.79 15.72 17.57V20.34H19.28C21.36 18.42 22.56 15.6 22.56 12.25Z" fill="#4285F4"/>
              <path d="M12 23C14.97 23 17.46 22.02 19.28 20.34L15.72 17.57C14.74 18.23 13.48 18.63 12 18.63C9.14 18.63 6.71 16.7 5.84 14.12H2.18V16.96C3.99 20.53 7.7 23 12 23Z" fill="#34A853"/>
              <path d="M5.84 14.12C5.62 13.46 5.5 12.75 5.5 12C5.5 11.25 5.62 10.54 5.84 9.88V7.04H2.18C1.43 8.55 1 10.22 1 12C1 13.78 1.43 15.45 2.18 16.96L5.84 14.12Z" fill="#FBBC05"/>
              <path d="M12 5.38C13.62 5.38 15.06 5.93 16.2 7.02L19.38 3.84C17.46 2.05 14.97 1 12 1C7.7 1 3.99 3.47 2.18 7.04L5.84 9.88C6.71 7.3 9.14 5.38 12 5.38Z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
