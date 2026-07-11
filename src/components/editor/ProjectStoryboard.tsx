import React, { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy as firestoreOrderBy, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Plus, Image as ImageIcon, Trash2, Edit2, GripVertical, Loader2, Upload, Sparkles } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Panel {
  id: string;
  title: string;
  prompt?: string;
  imageUrl?: string;
  order?: number;
}

interface SortablePanelCardProps {
  panel: Panel;
  onEdit: (panel: Panel) => void;
  onDelete: (id: string) => void | Promise<void>;
  onImageUpload: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateAI: (panel: Panel) => void;
}

const SortablePanelCard: React.FC<SortablePanelCardProps> = ({ panel, onEdit, onDelete, onImageUpload, onGenerateAI }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: panel.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 ${isDragging ? 'opacity-80 shadow-2xl scale-105' : 'shadow-sm hover:shadow-md'} p-3 relative group transition-all flex flex-col cursor-default rounded-xl overflow-hidden`}
    >
      <div 
        {...attributes} 
        {...listeners}
        className="absolute top-2 left-2 w-8 h-8 cursor-grab active:cursor-grabbing flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-black/50 rounded-lg"
      >
        <GripVertical className="w-4 h-4 text-white" />
      </div>
      
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(panel); }}
          className="p-1.5 text-white hover:text-blue-300 bg-black/50 rounded-lg transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(panel.id); }}
          className="p-1.5 text-white hover:text-red-400 bg-black/50 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="aspect-video w-full bg-slate-100 dark:bg-slate-800 rounded-lg mb-3 overflow-hidden relative flex items-center justify-center group/image">
        {panel.imageUrl ? (
          <img src={panel.imageUrl} alt={panel.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
            <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-1" />
            <div className="flex flex-col gap-2 w-full">
               <button onClick={() => fileInputRef.current?.click()} className="text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 py-1.5 px-3 rounded font-medium flex items-center justify-center gap-1 transition-colors">
                 <Upload className="w-3 h-3" /> Upload
               </button>
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 accept="image/*" 
                 onChange={(e) => onImageUpload(panel.id, e)} 
               />
               <button onClick={() => onGenerateAI(panel)} className="text-xs bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 py-1.5 px-3 rounded font-medium flex items-center justify-center gap-1 transition-colors">
                 <Sparkles className="w-3 h-3" /> Generate AI
               </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="px-1">
        <h3 className={`text-sm font-bold text-slate-800 dark:text-slate-200 mb-1 leading-tight line-clamp-1`}>{panel.title}</h3>
        {panel.prompt && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2" title={panel.prompt}>{panel.prompt}</p>
        )}
      </div>
    </div>
  );
}

export function ProjectStoryboard({ projectId }: { projectId: string }) {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newPanel, setNewPanel] = useState({ title: '', prompt: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [isGeneratingAI, setIsGeneratingAI] = useState<{ id: string, open: boolean, prompt: string, generating: boolean } | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadPanels();
  }, [projectId]);

  async function loadPanels() {
    try {
      const q = query(collection(db, 'projects', projectId, 'storyboard'), firestoreOrderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Panel[];
      
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setPanels(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/storyboard`);
    } finally {
      setLoading(false);
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = panels.findIndex((b) => b.id === active.id);
      const newIndex = panels.findIndex((b) => b.id === over.id);
      const newPanels = arrayMove(panels, oldIndex, newIndex) as Panel[];
      
      const updatedPanels = newPanels.map((panel: Panel, index: number) => ({
        ...panel, order: index
      }));
      setPanels(updatedPanels);
      
      try {
        const batch = writeBatch(db);
        updatedPanels.forEach((panel) => {
          const docRef = doc(db, 'projects', projectId, 'storyboard', panel.id);
          batch.update(docRef, { order: panel.order });
        });
        await batch.commit();
      } catch (error) {
        console.error("Error updating order:", error);
      }
    }
  };

  const handleEdit = (panel: Panel) => {
    setNewPanel({ title: panel.title, prompt: panel.prompt || '' });
    setEditingId(panel.id);
    setIsAdding(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPanel.title.trim()) return;
    
    const panelToSave = {
      title: newPanel.title.trim(),
      prompt: newPanel.prompt.trim(),
      updatedAt: new Date().toISOString(),
    };
    
    try {
      if (editingId) {
        const docRef = doc(db, 'projects', projectId, 'storyboard', editingId);
        await updateDoc(docRef, panelToSave);
        setPanels(panels.map(p => p.id === editingId ? { ...p, ...panelToSave } : p));
        setToastMsg('Panel Updated');
      } else {
        const finalPanel = { 
          ...panelToSave, 
          createdAt: new Date().toISOString(),
          order: panels.length
        };
        const docRef = await addDoc(collection(db, 'projects', projectId, 'storyboard'), finalPanel);
        setPanels([...panels, { id: docRef.id, ...finalPanel }]);
        setToastMsg('Panel Saved');
      }
      
      setNewPanel({ title: '', prompt: '' });
      setIsAdding(false);
      setEditingId(null);
      setErrorMsg(null);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (error: any) {
      setErrorMsg(error.message || 'Unknown error occurred while saving.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this panel?')) return;
    try {
      await deleteDoc(doc(db, 'projects', projectId, 'storyboard', id));
      setPanels(panels.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting panel:', error);
    }
  };

  const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const docRef = doc(db, 'projects', projectId, 'storyboard', id);
        await updateDoc(docRef, { imageUrl: base64String });
        setPanels(panels.map(p => p.id === id ? { ...p, imageUrl: base64String } : p));
        setToastMsg('Image uploaded successfully');
        setTimeout(() => setToastMsg(null), 3000);
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsDataURL(file);
  };

  const submitAIGeneration = async () => {
    if (!isGeneratingAI || !isGeneratingAI.prompt.trim()) return;
    
    setIsGeneratingAI(prev => prev ? { ...prev, generating: true } : null);
    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: isGeneratingAI.prompt }),
      });
      const data = await res.json();
      
      if (data.imageUrl) {
        const docRef = doc(db, 'projects', projectId, 'storyboard', isGeneratingAI.id);
        await updateDoc(docRef, { 
          imageUrl: data.imageUrl,
          prompt: isGeneratingAI.prompt
        });
        setPanels(panels.map(p => p.id === isGeneratingAI.id ? { ...p, imageUrl: data.imageUrl, prompt: isGeneratingAI.prompt } : p));
        setToastMsg('Image generated!');
        setIsGeneratingAI(null);
        setTimeout(() => setToastMsg(null), 3000);
      } else {
        throw new Error(data.error || 'Failed to generate image');
      }
    } catch (err: any) {
      alert(err.message);
      setIsGeneratingAI(prev => prev ? { ...prev, generating: false } : null);
    }
  };

  if (loading) return <div className="p-8 text-slate-400">Loading storyboard...</div>;

  return (
    <div className="flex flex-col w-full h-full bg-slate-50 dark:bg-slate-950/50">
      <div className="p-6 md:p-8 shrink-0 flex justify-between items-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-xl md:text-2xl font-medium text-slate-800 dark:text-white flex items-center gap-2">
          <ImageIcon className="w-5 h-5 md:w-6 md:h-6 text-purple-500" />
          Storyboard
        </h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Panel
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 relative">
        <div className="max-w-7xl mx-auto">
          {toastMsg && (
            <div className="fixed bottom-4 right-4 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg font-medium text-sm transition-all z-50">
              {toastMsg}
            </div>
          )}

          {isGeneratingAI && isGeneratingAI.open && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl relative">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" /> Generate Image with AI
                </h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Image Prompt</label>
                  <textarea 
                    autoFocus
                    value={isGeneratingAI.prompt}
                    onChange={e => setIsGeneratingAI({ ...isGeneratingAI, prompt: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all min-h-[100px] resize-y"
                    placeholder="Describe the scene in detail... e.g., 'A wide shot of a futuristic cyberpunk city at night with neon lights reflected in puddles'"
                    disabled={isGeneratingAI.generating}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsGeneratingAI(null)}
                    disabled={isGeneratingAI.generating}
                    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={submitAIGeneration}
                    disabled={!isGeneratingAI.prompt.trim() || isGeneratingAI.generating}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm hover:shadow"
                  >
                    {isGeneratingAI.generating ? <><Loader2 className="w-4 h-4 animate-spin"/> Generating...</> : 'Generate Image'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isAdding && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <form onSubmit={handleAdd} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl relative">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{editingId ? 'Edit Panel Details' : 'New Panel'}</h3>
                {errorMsg && <p className="text-red-500 mb-4 text-sm">{errorMsg}</p>}
                <div className="grid gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Panel Title / Sequence</label>
                    <input 
                      autoFocus
                      type="text" 
                      value={newPanel.title}
                      onChange={e => setNewPanel({...newPanel, title: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                      placeholder="e.g. EXT. CITY STREET - DAY"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Director's Note / Prompt</label>
                    <textarea 
                      value={newPanel.prompt}
                      onChange={e => setNewPanel({...newPanel, prompt: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all min-h-[100px] resize-y"
                      placeholder="Optional details or visual prompt..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingId(null); setNewPanel({ title: '', prompt: '' }); setErrorMsg(null); }}
                    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={!newPanel.title.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm hover:shadow"
                  >
                    {editingId ? 'Save Changes' : 'Create Panel'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {panels.length === 0 && !isAdding ? (
            <div className="text-center py-24 bg-white/50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-200 dark:border-slate-800 border-dashed backdrop-blur-sm max-w-2xl mx-auto shadow-sm">
              <ImageIcon className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-6" />
              <h3 className="text-xl font-medium text-slate-700 dark:text-slate-300 mb-3">Your Storyboard is empty</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">Create visual panels to map out your screenplay. Upload your own sketches or generate images with AI.</p>
              <button 
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                <Plus className="w-5 h-5" />
                Add First Panel
              </button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={panels.map(p => p.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
                  {panels.map(panel => (
                    <SortablePanelCard 
                      key={panel.id} 
                      panel={panel} 
                      onEdit={handleEdit} 
                      onDelete={handleDelete}
                      onImageUpload={handleImageUpload}
                      onGenerateAI={(p) => setIsGeneratingAI({ id: p.id, open: true, prompt: p.prompt || '', generating: false })}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}
