import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy as firestoreOrderBy, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Plus, Presentation, Trash2, Edit2, GripVertical, Check } from 'lucide-react';
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

interface Beat {
  id: string;
  title: string;
  content: string;
  color?: string;
  order?: number;
}

const COLORS = [
  { id: 'yellow', bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-300 dark:border-yellow-700/50', text: 'text-yellow-900 dark:text-yellow-100' },
  { id: 'blue', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-300 dark:border-blue-700/50', text: 'text-blue-900 dark:text-blue-100' },
  { id: 'green', bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-300 dark:border-green-700/50', text: 'text-green-900 dark:text-green-100' },
  { id: 'pink', bg: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-300 dark:border-pink-700/50', text: 'text-pink-900 dark:text-pink-100' },
  { id: 'white', bg: 'bg-white dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-800 dark:text-slate-200' },
];

interface SortableBeatCardProps {
  beat: Beat;
  onEdit: (beat: Beat) => void;
  onDelete: (id: string) => void | Promise<void>;
}

const SortableBeatCard: React.FC<SortableBeatCardProps> = ({ beat, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: beat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  const colorConfig = COLORS.find(c => c.id === beat.color) || COLORS[0];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${colorConfig.bg} ${colorConfig.border} ${isDragging ? 'opacity-80 shadow-2xl scale-105 rotate-2' : 'shadow-md hover:shadow-lg'} border p-2.5 sm:p-4 relative group transition-all flex flex-col min-h-[100px] sm:min-h-[140px] cursor-default rounded-sm`}
    >
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 sm:w-10 h-4 sm:h-5 bg-red-500/20 dark:bg-red-500/40 rotate-[-4deg] shadow-sm z-10 backdrop-blur-sm" />
      
      <div 
        {...attributes} 
        {...listeners}
        className="absolute top-0 left-0 w-full h-6 sm:h-8 cursor-grab active:cursor-grabbing flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
      >
        <GripVertical className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 opacity-50" />
      </div>
      
      <div className="absolute top-1 sm:top-2 right-1 sm:right-2 flex gap-0.5 sm:gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(beat); }}
          className="p-1 sm:p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 bg-white/50 dark:bg-slate-900/50 rounded transition-colors"
        >
          <Edit2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(beat.id); }}
          className="p-1 sm:p-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 bg-white/50 dark:bg-slate-900/50 rounded transition-colors"
        >
          <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
      </div>
      
      <h3 className={`text-xs sm:text-sm font-bold ${colorConfig.text} mt-2 sm:mt-3 mb-1 sm:mb-2 pr-10 sm:pr-14 leading-tight font-serif line-clamp-2`}>{beat.title}</h3>
      <div className={`w-full h-px bg-black/5 dark:bg-white/10 mb-1.5 sm:mb-2`} />
      <p className={`${colorConfig.text} opacity-90 text-[10px] sm:text-xs whitespace-pre-wrap flex-1 leading-relaxed line-clamp-4 sm:line-clamp-none`}>{beat.content || 'No content provided.'}</p>
    </div>
  );
}

export function ProjectBeatBoard({ projectId }: { projectId: string }) {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newBeat, setNewBeat] = useState({ title: '', content: '', color: 'yellow' });
  const [editingId, setEditingId] = useState<string | null>(null);
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
    loadBeats();
  }, [projectId]);

  async function loadBeats() {
    try {
      const q = query(collection(db, 'projects', projectId, 'beats'), firestoreOrderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Beat[];
      
      // Fallback sorting if 'order' isn't properly set on old items
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      setBeats(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/beats`);
    } finally {
      setLoading(false);
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = beats.findIndex((b) => b.id === active.id);
      const newIndex = beats.findIndex((b) => b.id === over.id);
      
      const newBeats = arrayMove(beats, oldIndex, newIndex) as Beat[];
      
      // Update local state immediately for snappy UI
      const updatedBeats = newBeats.map((beat: Beat, index: number) => ({
        ...beat,
        order: index
      }));
      setBeats(updatedBeats);
      
      // Batch update in Firestore
      try {
        const batch = writeBatch(db);
        updatedBeats.forEach((beat) => {
          const docRef = doc(db, 'projects', projectId, 'beats', beat.id);
          batch.update(docRef, { order: beat.order });
        });
        await batch.commit();
      } catch (error) {
        console.error("Error updating order:", error);
        setToastMsg('Failed to save new order');
        setTimeout(() => setToastMsg(null), 3000);
      }
    }
  };

  const handleEdit = (beat: Beat) => {
    setNewBeat({ title: beat.title, content: beat.content, color: beat.color || 'yellow' });
    setEditingId(beat.id);
    setIsAdding(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBeat.title.trim()) return;
    
    const beatToSave = {
      title: newBeat.title.trim(),
      content: newBeat.content.trim(),
      color: newBeat.color,
      updatedAt: new Date().toISOString(),
    };
    
    try {
      if (editingId) {
        const docRef = doc(db, 'projects', projectId, 'beats', editingId);
        await updateDoc(docRef, beatToSave);
        setBeats(beats.map(b => b.id === editingId ? { ...b, ...beatToSave } : b));
        setToastMsg('Beat Updated');
      } else {
        const finalBeat = { 
          ...beatToSave, 
          createdAt: new Date().toISOString(),
          order: beats.length
        };
        const docRef = await addDoc(collection(db, 'projects', projectId, 'beats'), finalBeat);
        setBeats([...beats, { id: docRef.id, ...finalBeat }]);
        setToastMsg('Beat Saved');
      }
      
      setNewBeat({ title: '', content: '', color: 'yellow' });
      setIsAdding(false);
      setEditingId(null);
      setErrorMsg(null);
      
      setTimeout(() => setToastMsg(null), 3000);
    } catch (error: any) {
      console.error('Error saving beat:', error);
      setErrorMsg(error.message || 'Unknown error occurred while saving.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this beat?')) return;
    try {
      await deleteDoc(doc(db, 'projects', projectId, 'beats', id));
      setBeats(beats.filter(b => b.id !== id));
    } catch (error) {
      console.error('Error deleting beat:', error);
    }
  };

  if (loading) return <div className="p-8 text-slate-400">Loading beats...</div>;

  return (
    <div className="flex flex-col w-full h-full bg-slate-100 dark:bg-slate-950/50">
      {/* Header */}
      <div className="p-6 md:p-8 shrink-0 flex justify-between items-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-xl md:text-2xl font-medium text-slate-800 dark:text-white flex items-center gap-2">
          <Presentation className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
          Beat Board
        </h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Beat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[url('https://www.transparenttextures.com/patterns/cork-board.png')] dark:bg-none relative">
        <div className="max-w-7xl mx-auto">
          {errorMsg && (
            <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-6 max-w-2xl mx-auto shadow-lg">
              <p className="font-medium text-sm">Error saving beat:</p>
              <p className="text-sm font-mono mt-1 opacity-80">{errorMsg}</p>
            </div>
          )}

          {toastMsg && (
            <div className="fixed bottom-4 right-4 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg font-medium text-sm transition-all z-50">
              {toastMsg}
            </div>
          )}

          {isAdding && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <form onSubmit={handleAdd} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl relative">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{editingId ? 'Edit Beat' : 'New Beat'}</h3>
                <div className="grid gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Color</label>
                    <div className="flex gap-2">
                      {COLORS.map(color => (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() => setNewBeat({...newBeat, color: color.id})}
                          className={`w-8 h-8 rounded-full ${color.bg} ${color.border} border-2 flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900`}
                        >
                          {newBeat.color === color.id && <Check className={`w-4 h-4 ${color.text}`} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Title</label>
                    <input 
                      autoFocus
                      type="text" 
                      value={newBeat.title}
                      onChange={e => setNewBeat({...newBeat, title: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      placeholder="e.g. Inciting Incident"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Content</label>
                    <textarea 
                      value={newBeat.content}
                      onChange={e => setNewBeat({...newBeat, content: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all min-h-[120px] resize-y"
                      placeholder="Describe what happens in this beat..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingId(null); setNewBeat({ title: '', content: '', color: 'yellow' }); setErrorMsg(null); }}
                    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={!newBeat.title.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm hover:shadow"
                  >
                    {editingId ? 'Save Changes' : 'Create Beat'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {beats.length === 0 && !isAdding ? (
            <div className="text-center py-24 bg-white/50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-300 dark:border-slate-800 border-dashed backdrop-blur-sm max-w-2xl mx-auto shadow-sm">
              <Presentation className="w-16 h-16 text-slate-400 dark:text-slate-600 mx-auto mb-6" />
              <h3 className="text-xl font-medium text-slate-700 dark:text-slate-300 mb-3">Your Beat Board is empty</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">Start outlining your story by adding beats like index cards on a corkboard. Drag and drop to rearrange them.</p>
              <button 
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center gap-2 bg-slate-800 dark:bg-slate-800 hover:bg-slate-700 dark:hover:bg-slate-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                <Plus className="w-5 h-5" />
                Add First Beat
              </button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={beats.map(b => b.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-4 pb-20">
                  {beats.map(beat => (
                    <SortableBeatCard 
                      key={beat.id} 
                      beat={beat} 
                      onEdit={handleEdit} 
                      onDelete={handleDelete} 
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
