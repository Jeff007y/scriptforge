import { Sidebar } from '../components/Sidebar';
import { Users, Presentation, BookOpen, Settings } from 'lucide-react';
import { MobileMenuButton } from '../components/MobileMenuButton';
import { ProjectSettings } from '../components/editor/ProjectSettings';

export function GlobalCharacters() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar />
      <div className="flex-1 overflow-y-auto bg-slate-900 p-6 md:p-10">
        <div className="max-w-5xl mx-auto space-y-8">
           <h1 className="text-2xl font-sans text-white font-medium flex items-center gap-3">
              <MobileMenuButton />
              <Users className="w-6 h-6 text-blue-500 hidden sm:block" />
              All Characters
           </h1>
           <div className="bg-slate-950/50 rounded-2xl border border-slate-800 p-8 flex flex-col items-center justify-center text-slate-500 text-center">
             <Users className="w-12 h-12 mb-4 text-slate-700" />
             <p>Select a project from the Dashboard or Projects view to edit its characters.</p>
           </div>
        </div>
      </div>
    </div>
  );
}

export function GlobalBeatBoard() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar />
      <div className="flex-1 overflow-y-auto bg-slate-900 p-6 md:p-10">
        <div className="max-w-5xl mx-auto space-y-8">
           <h1 className="text-2xl font-sans text-white font-medium flex items-center gap-3">
              <MobileMenuButton />
              <Presentation className="w-6 h-6 text-blue-500 hidden sm:block" />
              Beat Boards
           </h1>
           <div className="bg-slate-950/50 rounded-2xl border border-slate-800 p-8 flex flex-col items-center justify-center text-slate-500 text-center">
             <Presentation className="w-12 h-12 mb-4 text-slate-700" />
             <p>Select a project to access its beat board and story cards.</p>
           </div>
        </div>
      </div>
    </div>
  );
}

export function GlobalSettings() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar />
      <div className="flex-1 overflow-y-auto bg-slate-900">
        <ProjectSettings />
      </div>
    </div>
  );
}
