import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { Settings, Save, Moon, Sun, Clock, Bot, SlidersHorizontal } from 'lucide-react';
import { MobileMenuButton } from './../MobileMenuButton';

export function ProjectSettings({ projectId }: { projectId?: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [settings, setSettings] = useState({
    theme: 'dark',
    autosaveFrequency: '30',
    aiModel: 'gemini-3.1-flash-lite',
    aiTemperature: '0.7'
  });

  useEffect(() => {
    loadSettings();
  }, [projectId]);

  async function loadSettings() {
    try {
      if (!auth.currentUser) return;
      const docRef = projectId 
        ? doc(db, 'projects', projectId)
        : doc(db, 'users', auth.currentUser.uid);
        
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!auth.currentUser) return;
      const docRef = projectId 
        ? doc(db, 'projects', projectId)
        : doc(db, 'users', auth.currentUser.uid);
        
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) {
        if (!projectId) {
          await setDoc(docRef, { 
            settings,
            email: auth.currentUser.email || '',
            createdAt: new Date().toISOString(),
            displayName: auth.currentUser.displayName || '',
            photoURL: auth.currentUser.photoURL || ''
          }, { merge: true });
        } else {
          await setDoc(docRef, { settings }, { merge: true });
        }
      } else {
        await updateDoc(docRef, { settings });
      }
      
      // Update global/project settings objects
      if (projectId) {
        // @ts-ignore
        window.__PROJECT_SETTINGS__ = settings;
      } else {
        // @ts-ignore
        window.__GLOBAL_SETTINGS__ = settings;
      }
      
      // Apply theme to document if needed
      if (settings.theme === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }

      setToastMsg('Settings saved successfully');
      setTimeout(() => setToastMsg(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setToastMsg('Error saving settings');
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading settings...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto w-full h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-medium text-white flex items-center gap-2">
          <MobileMenuButton />
          <Settings className="w-5 h-5 text-blue-500" />
          {projectId ? 'Project Settings' : 'Global Settings'}
        </h2>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {toastMsg && (
        <div className={`fixed bottom-4 right-4 ${toastMsg.includes('Error') ? 'bg-red-600' : 'bg-green-600'} text-white px-4 py-2 rounded-lg shadow-lg font-medium text-xs transition-all z-50`}>
          {toastMsg}
        </div>
      )}

      <div className="space-y-6">
        {/* Theme Preferences */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            {settings.theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-yellow-400" />}
            Theme Preferences
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setSettings({ ...settings, theme: 'dark' });
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
              }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${settings.theme === 'dark' ? 'bg-blue-900/20 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}
            >
              <Moon className="w-6 h-6" />
              <span className="text-xs font-medium">Dark Mode</span>
            </button>
            <button
              onClick={() => {
                setSettings({ ...settings, theme: 'light' });
                document.documentElement.classList.add('light');
                document.documentElement.classList.remove('dark');
              }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${settings.theme === 'light' ? 'bg-blue-900/20 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}
            >
              <Sun className="w-6 h-6" />
              <span className="text-xs font-medium">Light Mode</span>
            </button>
          </div>
        </div>

        {/* Editor Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-400" />
            Editor Configuration
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Autosave Frequency</label>
              <select
                value={settings.autosaveFrequency}
                onChange={(e) => setSettings({ ...settings, autosaveFrequency: e.target.value })}
                className="w-full md:w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all appearance-none"
              >
                <option value="5">Every 5 seconds</option>
                <option value="15">Every 15 seconds</option>
                <option value="30">Every 30 seconds</option>
                <option value="60">Every 1 minute</option>
                <option value="300">Every 5 minutes</option>
                <option value="off">Off (Manual save only)</option>
              </select>
            </div>
          </div>
        </div>

        {/* AI Assistant Configuration */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Bot className="w-4 h-4 text-purple-400" />
            AI Assistant Configuration
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Default AI Model</label>
              <select
                value={settings.aiModel}
                onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
                className="w-full md:w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all appearance-none"
              >
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Recommended)</option>
                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Requires Paid API Key)</option>
                <option value="gemini-3.5-flash">Gemini 3.5 Flash (May experience high demand)</option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1.5">Select the underlying model for generating story ideas and character bios.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                <SlidersHorizontal className="w-3 h-3" />
                Creativity / Temperature ({settings.aiTemperature})
              </label>
              <div className="flex items-center gap-3 md:w-1/2">
                <span className="text-[10px] text-slate-500">Focused</span>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={settings.aiTemperature}
                  onChange={(e) => setSettings({ ...settings, aiTemperature: e.target.value })}
                  className="flex-1 accent-blue-500 h-1.5"
                />
                <span className="text-[10px] text-slate-500">Creative</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

