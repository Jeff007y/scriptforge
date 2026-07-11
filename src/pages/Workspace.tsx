import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { LayoutDashboard, Type, Users, Download, CopyCheck, Settings, Home, Folder, Presentation, BookOpen, Clapperboard, Edit2, Loader2, Check, X } from 'lucide-react';
import { Editor } from '../components/editor/Editor';
import { ProjectCharacters } from '../components/editor/ProjectCharacters';
import { ProjectStoryboard } from '../components/editor/ProjectStoryboard';
import { ProjectBeatBoard } from '../components/editor/ProjectBeatBoard';
import { ProjectSettings } from '../components/editor/ProjectSettings';
import { AIAssistant } from '../components/AIAssistant';
import { Sidebar } from '../components/Sidebar';
import { cn } from '../lib/utils';

import { MobileMenuButton } from '../components/MobileMenuButton';

export function Workspace() {
  const { projectId, '*' : subpath } = useParams();

  const navigate = useNavigate();
  const [projectTitle, setProjectTitle] = useState('Loading...');
  const [editorContext, setEditorContext] = useState('');
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  let activeTab = 'editor';
  if (subpath === 'characters') activeTab = 'characters';
  else if (subpath === 'storyboard') activeTab = 'storyboard';
  else if (subpath === 'beat-board') activeTab = 'board';
  else if (subpath === 'settings') activeTab = 'settings';



  useEffect(() => {
    if (!projectId) return;
    
    import('firebase/firestore').then(({ onSnapshot }) => {
      const unsubscribe = onSnapshot(doc(db, 'projects', projectId), (docSnap) => {
        if (docSnap.exists()) {
          setProjectTitle(docSnap.data().title);
          // @ts-ignore
          const globalSettings = window.__GLOBAL_SETTINGS__ || {};
          const settings = docSnap.data().settings || {
            theme: globalSettings.theme || 'dark',
            autosaveFrequency: globalSettings.autosaveFrequency || '30',
            aiModel: globalSettings.aiModel || 'gemini-1.5-pro',
            aiTemperature: globalSettings.aiTemperature || '0.7'
          };
          
          if (settings.theme === 'light') {
            document.documentElement.classList.add('light');
            document.documentElement.classList.remove('dark');
          } else {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
          }
          
          // @ts-ignore
          window.__PROJECT_SETTINGS__ = settings;
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `projects/${projectId}`);
      });
      return () => unsubscribe();
    });
  }, [projectId]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditingTitle]);

  const handleSaveTitle = async () => {
    if (!projectId || !tempTitle.trim() || tempTitle.trim() === projectTitle) {
      setIsEditingTitle(false);
      return;
    }
    setIsSavingTitle(true);
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        title: tempTitle.trim(),
        updatedAt: new Date().toISOString()
      });
      setProjectTitle(tempTitle.trim());
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    } finally {
      setIsSavingTitle(false);
      setIsEditingTitle(false);
    }
  };

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Global Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full bg-slate-900 min-w-0 relative">
        <div className="h-14 border-b border-slate-800 bg-slate-950 flex items-center px-4 md:px-6 shrink-0 justify-between">
           <div className="text-white font-medium flex items-center gap-2 group">
             <MobileMenuButton />
             <Clapperboard className="w-4 h-4 text-slate-500 hidden sm:block" />
             {isEditingTitle ? (
               <div className="flex items-center gap-2">
                 <input
                   ref={titleInputRef}
                   type="text"
                   disabled={isSavingTitle}
                   value={tempTitle}
                   onChange={e => setTempTitle(e.target.value)}
                   onKeyDown={handleKeyDown}
                   className="bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-blue-500 w-48"
                 />
                 {isSavingTitle ? (
                   <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                 ) : (
                   <>
                     <button onClick={handleSaveTitle} className="text-slate-400 hover:text-green-400 transition-colors">
                       <Check className="w-4 h-4" />
                     </button>
                     <button onClick={() => setIsEditingTitle(false)} className="text-slate-400 hover:text-red-400 transition-colors">
                       <X className="w-4 h-4" />
                     </button>
                   </>
                 )}
               </div>
             ) : (
               <>
                 <span className="truncate max-w-[200px] sm:max-w-xs">{projectTitle}</span>
                 <button 
                   onClick={() => {
                     setTempTitle(projectTitle);
                     setIsEditingTitle(true);
                   }}
                   className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-300 transition-all rounded hover:bg-slate-800"
                   title="Rename Project"
                 >
                   <Edit2 className="w-3.5 h-3.5" />
                 </button>
                 {activeTab === 'editor' && (
                   <div className="relative ml-1">
                     <button
                       onClick={() => setShowExportMenu(!showExportMenu)}
                       className="p-1 text-slate-500 hover:text-slate-300 transition-all rounded hover:bg-slate-800 flex items-center gap-1"
                       title="Export"
                     >
                       <Download className="w-4 h-4" />
                     </button>
                     {showExportMenu && (
                       <div className="absolute left-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                         <button
                           onClick={() => { setShowExportMenu(false); document.dispatchEvent(new CustomEvent('trigger-export', { detail: { type: 'pdf' } })); }}
                           className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-200 text-sm"
                         >
                           Export as PDF
                         </button>
                         <button
                           onClick={() => { setShowExportMenu(false); document.dispatchEvent(new CustomEvent('trigger-export', { detail: { type: 'docx' } })); }}
                           className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-200 text-sm"
                         >
                           Export as DOCX
                         </button>
                         <button
                           onClick={() => { setShowExportMenu(false); document.dispatchEvent(new CustomEvent('trigger-export', { detail: { type: 'workfile' } })); }}
                           className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-200 text-sm"
                         >
                           Download Work File
                         </button>
                       </div>
                     )}
                   </div>
                 )}
                </>
             )}
           </div>
        </div>
        
        {activeTab === 'editor' && <Editor projectId={projectId!} onContextChange={setEditorContext} />}
        {activeTab === 'board' && <ProjectBeatBoard projectId={projectId!} />}
        {activeTab === 'characters' && <ProjectCharacters projectId={projectId!} />}
        {activeTab === 'storyboard' && <ProjectStoryboard projectId={projectId!} />}
        {activeTab === 'settings' && <ProjectSettings projectId={projectId!} />}
      </div>

      {/* Right Sidebar - AI Assistant */}
      <AIAssistant context={projectTitle + "\n\n" + editorContext} />
    </div>
  );
}
