import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Plus, User, Trash2, Edit2 } from 'lucide-react';
import { v4 as uuid } from 'uuid';

interface Character {
  id: string;
  name: string;
  description: string;
  role: string;
}

export function ProjectCharacters({ projectId }: { projectId: string }) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newChar, setNewChar] = useState({ name: '', description: '', role: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadCharacters();
  }, [projectId]);

  async function loadCharacters() {
    try {
      const q = query(collection(db, 'projects', projectId, 'characters'));
      const snapshot = await getDocs(q);
      const blocks = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Character[];
      setCharacters(blocks);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/characters`);
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = (char: Character) => {
    setNewChar({ name: char.name, description: char.description, role: char.role });
    setEditingId(char.id);
    setIsAdding(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChar.name.trim()) return;
    
    console.log("Save Character Clicked");
    console.log("Current projectId:", projectId);
    
    const characterToSave = {
      name: newChar.name.trim(),
      description: newChar.description.trim(),
      role: newChar.role.trim(),
      updatedAt: new Date().toISOString()
    };
    
    console.log("Character object being saved:", characterToSave);
    console.log(`Firestore path being written to: projects/${projectId}/characters`);
    
    try {
      if (editingId) {
        const docRef = doc(db, 'projects', projectId, 'characters', editingId);
        await updateDoc(docRef, characterToSave);
        console.log("Update success response, docId:", editingId);
        
        setCharacters(characters.map(c => c.id === editingId ? { ...c, ...characterToSave } : c));
        setToastMsg('Character Updated');
      } else {
        const finalChar = { ...characterToSave, createdAt: new Date().toISOString() };
        const docRef = await addDoc(collection(db, 'projects', projectId, 'characters'), finalChar);
        console.log("Save success response, docId:", docRef.id);
        
        setCharacters([...characters, { id: docRef.id, ...finalChar }]);
        setToastMsg('Character Saved');
      }
      
      setNewChar({ name: '', description: '', role: '' });
      setIsAdding(false);
      setEditingId(null);
      setErrorMsg(null);
      
      setTimeout(() => setToastMsg(null), 3000);
      
      // Also fetch characters again just to be safe
      await loadCharacters();
    } catch (error: any) {
      console.error('Full error response if save fails:', error);
      setErrorMsg(error.message || 'Unknown error occurred while saving.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this character?')) return;
    try {
      await deleteDoc(doc(db, 'projects', projectId, 'characters', id));
      setCharacters(characters.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting character:', error);
    }
  };

  if (loading) return <div className="p-8 text-slate-400">Loading characters...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto w-full h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-medium text-white flex items-center gap-2">
          <User className="w-6 h-6 text-blue-500" />
          Characters
        </h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Character
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-6">
          <p className="font-medium text-sm">Error saving character:</p>
          <p className="text-sm font-mono mt-1 opacity-80">{errorMsg}</p>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg font-medium text-sm transition-all z-50">
          {toastMsg}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 -mx-px">
          <div className="grid gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
              <input 
                autoFocus
                type="text" 
                value={newChar.name}
                onChange={e => setNewChar({...newChar, name: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                placeholder="CHARACTER NAME"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Role</label>
              <input 
                type="text" 
                value={newChar.role}
                onChange={e => setNewChar({...newChar, role: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                placeholder="e.g. Protagonist, Antagonist, Supporting..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
              <textarea 
                value={newChar.description}
                onChange={e => setNewChar({...newChar, description: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all min-h-[100px]"
                placeholder="Brief description, physical appearance, personality traits..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button 
              type="button"
              onClick={() => { setIsAdding(false); setEditingId(null); setNewChar({ name: '', description: '', role: '' }); setErrorMsg(null); }}
              className="px-4 py-2 hover:bg-slate-800 text-slate-300 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={!newChar.name.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Save Character
            </button>
          </div>
        </form>
      )}

      {characters.length === 0 && !isAdding ? (
        <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
          <User className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No characters yet</h3>
          <p className="text-slate-500 mb-6">Add characters to your project.</p>
          <button 
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Character
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map(char => (
            <div key={char.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative group hover:border-slate-700 transition-all">
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleEdit(char)}
                  className="text-slate-600 hover:text-blue-400"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(char.id)}
                  className="text-slate-600 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-lg font-bold text-white mb-1 uppercase tracking-wide">{char.name}</h3>
              {char.role && <p className="text-sm font-medium text-blue-400 mb-4">{char.role}</p>}
              <p className="text-slate-400 text-sm whitespace-pre-wrap">{char.description || 'No description provided.'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
