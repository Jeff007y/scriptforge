import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db, auth, signOut, handleFirestoreError, OperationType } from '../lib/firebase';
import { Plus, Folder, LogOut, Clapperboard, Film, FileVideo, Tv, Megaphone, Settings, LayoutDashboard, Search, Clock, FileText, Users, Type, Trash2, FolderOpen } from 'lucide-react';
import { useStore } from '../store';
import { Sidebar } from '../components/Sidebar';
import { MobileMenuButton } from '../components/MobileMenuButton';

export function Dashboard() {
  const navigate = useNavigate();
  const { projects, setProjects } = useStore();
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  async function loadProjects() {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, 'projects'),
        where('ownerId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const projData = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title,
        logline: doc.data().logline,
        updatedAt: doc.data().updatedAt,
      }));
      
      // Sort explicitly by updatedAt descending since we don't have an index yet
      projData.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      setProjects(projData);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, [setProjects]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const deleteProjectSingle = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      // Find and delete all blocks in this project
      const blocksQuery = query(collection(db, 'projects', projectId, 'blocks'));
      const blocksSnapshot = await getDocs(blocksQuery);
      
      const batch = writeBatch(db);
      blocksSnapshot.docs.forEach(blockDoc => {
        batch.delete(blockDoc.ref);
      });
      
      // Find and delete all characters in this project
      const charsQuery = query(collection(db, 'projects', projectId, 'characters'));
      const charsSnapshot = await getDocs(charsQuery);
      charsSnapshot.docs.forEach(charDoc => {
        batch.delete(charDoc.ref);
      });
      
      await batch.commit();

      // Delete project doc
      await deleteDoc(doc(db, 'projects', projectId));
      
      setActiveMenu(null);
      await loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const blocks = JSON.parse(text);
        if (Array.isArray(blocks)) {
          // Create new project
          const title = file.name.replace('.json', '') || 'Imported Script';
          const docRef = await addDoc(collection(db, 'projects'), {
            ownerId: auth.currentUser!.uid,
            title,
            logline: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          // Upload blocks
          const batch = writeBatch(db);
          blocks.forEach(block => {
            const ref = doc(db, 'projects', docRef.id, 'blocks', block.id);
            batch.set(ref, {
              projectId: docRef.id,
              type: block.type,
              text: block.text,
              order: block.order
            });
          });
          
          await batch.commit();
          navigate(`/editor/${docRef.id}`);
        }
      } catch (err) {
        console.error("Error parsing workfile", err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const createProject = async (templateName?: string) => {
    console.log('createProject called with template:', templateName);
    if (!auth.currentUser) {
      console.error('Cannot create project: auth.currentUser is null');
      alert('Authentication error: Please sign in again.');
      return;
    }
    try {
      const title = templateName ? `Untitled ${templateName}` : 'Untitled Screenplay';
      console.log('Adding doc to projects collection for user:', auth.currentUser.uid);
      const docRef = await addDoc(collection(db, 'projects'), {
        ownerId: auth.currentUser.uid,
        title,
        logline: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log('Project created! ID:', docRef.id);
      navigate(`/editor/${docRef.id}`);
    } catch (error) {
       console.error('Error creating project:', error);
       handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  };

  const templates = [
    { id: 'feature', name: 'Feature Film', icon: <Clapperboard className="w-5 h-5" /> },
    { id: 'short', name: 'Short Film', icon: <Film className="w-5 h-5" /> },
    { id: 'tv', name: 'TV Episode', icon: <Tv className="w-5 h-5" /> },
    { id: 'commercial', name: 'Commercial', icon: <Megaphone className="w-5 h-5" /> },
    { id: 'documentary', name: 'Documentary', icon: <FileVideo className="w-5 h-5" /> },
  ];

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Never';
    const d = new Date(isoString);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    ).replace('0 days ago', 'Today');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Global Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-slate-900">
        <div className="p-10 max-w-5xl mx-auto space-y-12">
          
          {/* Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
            <h1 className="text-2xl font-sans tracking-tight font-medium text-white flex items-center gap-2">
              <MobileMenuButton />
              Welcome back, {auth.currentUser?.displayName?.split(' ')[0]}
            </h1>
            <div className="relative w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search scripts..." 
                className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600 transition-all z-10 relative"
              />
            </div>
          </div>

          {/* New Script & Templates */}
          <section>
            <h2 className="text-sm font-medium text-slate-400 tracking-wider uppercase mb-4">Create New</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
              <button 
                onClick={() => createProject()}
                className="flex-shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl transition-colors font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Blank Script
              </button>

              <button 
                onClick={() => document.getElementById('dashboard-workfile-upload')?.click()}
                className="flex-shrink-0 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl transition-colors font-medium text-sm"
              >
                <FolderOpen className="w-4 h-4" />
                Open File
              </button>
              <input 
                type="file" 
                id="dashboard-workfile-upload" 
                accept=".json" 
                className="hidden" 
                onChange={handleFileUpload} 
              />
              
              <div className="w-px bg-slate-800 my-1 mx-2" />
              
              {templates.map(tmpl => (
                <button
                  key={tmpl.id}
                  onClick={() => createProject(tmpl.name)}
                  className="flex-shrink-0 flex items-center gap-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-5 py-3 rounded-xl transition-all border border-slate-700/50 hover:border-slate-600 font-medium text-sm"
                >
                  <span className="text-blue-400">{tmpl.icon}</span>
                  {tmpl.name}
                </button>
              ))}
            </div>
          </section>

          {/* Recent Scripts */}
          <section>
            <h2 className="text-sm font-medium text-slate-400 tracking-wider uppercase mb-4">Recent Scripts</h2>
            
            {loading ? (
              <div className="text-slate-500 font-mono text-sm py-8">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="text-slate-500 font-mono py-8 bg-slate-950/50 rounded-2xl border border-slate-800 border-dashed flex flex-col items-center justify-center">
                 <Clapperboard className="w-8 h-8 text-slate-700 mb-3" />
                 <p>No scripts found. Create your first project above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {projects.map((project) => (
                  <div 
                    key={project.id}
                    onClick={(e) => { e.stopPropagation(); setActiveMenu(project.id); }}
                    className="relative bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 cursor-pointer transition-all flex flex-col group h-44 shadow-sm overflow-hidden"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-blue-500 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(project.updatedAt)}
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-slate-200 group-hover:text-blue-400 transition-colors text-lg truncate w-full mb-1">{project.title}</h3>
                    <p className="text-slate-500 text-xs mt-auto line-clamp-2">{project.logline || 'Add a logline to describe your story...'}</p>
                    
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-800/50">
                       <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Clapperboard className="w-3.5 h-3.5" />
                          <span>~12 Scenes</span>
                       </div>
                       <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Users className="w-3.5 h-3.5" />
                          <span>~4 Characters</span>
                       </div>
                    </div>

                    {activeMenu === project.id && (
                      <div 
                        className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center gap-3 z-10"
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(null); }}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/editor/${project.id}`); }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                        >
                          Open
                        </button>
                        <button
                          onClick={(e) => deleteProjectSingle(project.id, e)}
                          className="bg-red-950/80 hover:bg-red-900 border border-red-900/50 text-red-400 hover:text-red-300 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
