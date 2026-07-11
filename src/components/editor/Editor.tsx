import React, { useEffect, useState, useRef, KeyboardEvent } from 'react';
import { collection, query, orderBy, onSnapshot, writeBatch, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import { v4 as uuid } from 'uuid';
import { Loader2, Download, Sun, Moon } from 'lucide-react';

export type BlockType = 'scene' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition' | 'shot';

export interface ScriptBlock {
  id: string;
  type: BlockType;
  text: string;
  order: number;
}

export interface Character {
  id: string;
  name: string;
  description?: string;
  role?: string;
}

interface EditorProps {
  projectId: string;
  onContextChange?: (context: string) => void;
}

export function Editor({ projectId, onContextChange }: EditorProps) {
  const [blocks, setBlocks] = useState<ScriptBlock[]>([]);
  const [projectCharacters, setProjectCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportModal, setExportModal] = useState<{ open: boolean, type: 'pdf' | 'docx', startRaw: string, endRaw: string } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const blocksRef = useRef(blocks);
  const hasUnsavedChanges = useRef(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    setIsDarkMode(!document.documentElement.classList.contains('light'));
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDarkMode(!document.documentElement.classList.contains('light'));
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleExportEvent = (e: any) => {
      const type = e.detail?.type;
      if (type === 'pdf') setExportModal({ open: true, type: 'pdf', startRaw: '1', endRaw: '' });
      if (type === 'docx') setExportModal({ open: true, type: 'docx', startRaw: '1', endRaw: '' });
      if (type === 'workfile') executeExportWorkfile();
    };
    
    document.addEventListener('trigger-export', handleExportEvent);
    return () => document.removeEventListener('trigger-export', handleExportEvent);
  }, [blocks]);

  useEffect(() => {
    blocksRef.current = blocks;
    // Debounce context updates slightly to avoid thrashing
    const contextText = blocks.map(b => b.text).join('\n');
    if (onContextChange) onContextChange(contextText);
  }, [blocks, onContextChange]);

  useEffect(() => {
    const qBlocks = query(
      collection(db, 'projects', projectId, 'blocks'),
      orderBy('order', 'asc')
    );
    
    const unsubscribeBlocks = onSnapshot(qBlocks, (snapshot) => {
      // If we already loaded and have local unsaved changes, we should be careful.
      // But for this simple implementation, we adopt remote if it differs and we're not actively typing?
      // To avoid cursor jumping, we'll only load once for now. Real CRDT is needed for multiplayer.
      if (initialLoadDone.current) return; 

      const fbBlocks = snapshot.docs.map(d => {
        const data = d.data();
        let type = data.type;
        // Migration from old schema if needed:
        if (type === 'scene_heading') type = 'scene';
        
        return {
          id: d.id,
          type: type || 'action',
          text: data.text !== undefined ? data.text : (data.content || ''),
          order: data.order || 0
        };
      }) as ScriptBlock[];
      
      if (fbBlocks.length === 0) {
        // Create only one scene heading when a project is created.
        const initId = uuid();
        const initBlock: ScriptBlock = { id: initId, type: 'scene', text: 'INT. SCENE - DAY', order: 0 };
        setBlocks([initBlock]);
        hasUnsavedChanges.current = true; // Trigger save
      } else {
        setBlocks(fbBlocks);
      }
      setLoading(false);
      initialLoadDone.current = true;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/blocks`);
    });

    const qChars = query(collection(db, 'projects', projectId, 'characters'));
    const unsubscribeChars = onSnapshot(qChars, (snapshot) => {
      const chars = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Character[];
      setProjectCharacters(chars);
    });

    return () => {
      unsubscribeBlocks();
      unsubscribeChars();
    };
  }, [projectId]);

  const lastSavedTime = useRef<number>(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      // @ts-ignore
      const settings = window.__PROJECT_SETTINGS__ || window.__GLOBAL_SETTINGS__ || {};
      const frequencyStr = settings.autosaveFrequency || '30';
      if (frequencyStr === 'off') return;
      
      const freqMs = parseInt(frequencyStr, 10) * 1000;
      
      if (hasUnsavedChanges.current && !loading && (Date.now() - lastSavedTime.current) >= freqMs) {
        saveToCloud(blocksRef.current, true);
        lastSavedTime.current = Date.now();
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [projectId, loading]);

  const handleBlockChange = (index: number, newText: string) => {
    const newBlocks = [...blocks];
    newBlocks[index].text = newText;
    setBlocks(newBlocks);
    hasUnsavedChanges.current = true;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newBlocks = [...blocks];
      let newType: BlockType = 'action';
      
      if (blocks[index].type === 'character' || blocks[index].type === 'parenthetical') {
        newType = 'dialogue';
      } else if (blocks[index].type === 'dialogue') {
        newType = 'character';
      } else if (blocks[index].type === 'scene' || blocks[index].type === 'transition' || blocks[index].type === 'shot') {
        newType = 'action';
      }
      
      newBlocks.splice(index + 1, 0, {
        id: uuid(),
        type: newType,
        text: '',
        order: (blocks[index].order + (blocks[index+1]?.order || blocks[index].order + 100)) / 2
      });
      setBlocks(newBlocks);
      hasUnsavedChanges.current = true;
      setFocusedIndex(index + 1);
      
      setTimeout(() => {
        document.getElementById(`block-${index + 1}`)?.focus();
      }, 10);
    } else if (e.key === 'Backspace' && blocks[index].text === '' && blocks.length > 1) {
      e.preventDefault();
      const newBlocks = [...blocks];
      newBlocks.splice(index, 1);
      setBlocks(newBlocks);
      hasUnsavedChanges.current = true;
      
      const prevIndex = Math.max(0, index - 1);
      setFocusedIndex(prevIndex);
      setTimeout(() => {
        const el = document.getElementById(`block-${prevIndex}`) as HTMLTextAreaElement;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }, 10);
    } else if (e.key === 'Tab') {
      // Optional: Tab to change types similar to Arc Studio / Final Draft
      e.preventDefault();
      const typeFlow: BlockType[] = ['action', 'character', 'dialogue', 'parenthetical', 'scene', 'transition', 'shot'];
      const currIdx = typeFlow.indexOf(blocks[index].type);
      const nextType = typeFlow[(currIdx + 1) % typeFlow.length];
      setFocusedIndex(index);
      setBlockType(nextType);
    }
  };

  const saveToCloud = async (currentBlocks: ScriptBlock[], isAutoSave = false) => {
    setIsSaving(true);
    hasUnsavedChanges.current = false;
    const batch = writeBatch(db);
    currentBlocks.forEach((block, idx) => {
      // Re-normalize order to stay strictly sequential across saves
      const order = idx * 10;
      block.order = order;
      const ref = doc(db, 'projects', projectId, 'blocks', block.id);
      batch.set(ref, {
        projectId,
        type: block.type,
        text: block.text,
        order: block.order
      });
    });
    try {
      await batch.commit();
    } catch (error) {
      hasUnsavedChanges.current = true;
      handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}/blocks`);
    } finally {
      setIsSaving(false);
    }
  };

  const setBlockType = (type: BlockType) => {
    const newBlocks = [...blocks];
    if (focusedIndex !== null && focusedIndex >= 0 && focusedIndex < newBlocks.length) {
      const prevType = newBlocks[focusedIndex].type;
      newBlocks[focusedIndex].type = type;
      
      let currentText = newBlocks[focusedIndex].text;

      // Clean up parentheses if changing FROM parenthetical to something else
      if (prevType === 'parenthetical' && type !== 'parenthetical') {
        currentText = currentText.replace(/^\(+/, '').replace(/\)+$/, '').trim();
      }

      if (['scene', 'character', 'transition', 'shot'].includes(type)) {
        currentText = currentText.toUpperCase();
      } else if (type === 'parenthetical') {
        currentText = currentText.trim();
        if (currentText && !currentText.startsWith('(')) currentText = '(' + currentText;
        if (currentText && !currentText.endsWith(')')) currentText = currentText + ')';
      }
      
      newBlocks[focusedIndex].text = currentText;
      
      setBlocks(newBlocks);
      hasUnsavedChanges.current = true;
      setTimeout(() => {
        document.getElementById(`block-${focusedIndex}`)?.focus();
      }, 10);
    } else {
      const insertIndex = newBlocks.length;
      let order = 0;
      if (newBlocks.length > 0) {
        order = newBlocks[newBlocks.length - 1].order + 100;
      }
      newBlocks.push({ id: uuid(), type, text: '', order });
      setBlocks(newBlocks);
      hasUnsavedChanges.current = true;
      setFocusedIndex(insertIndex);
      setTimeout(() => {
        document.getElementById(`block-${insertIndex}`)?.focus();
      }, 10);
    }
  };

  const executeExportPDF = async (start: number, end: number) => {
    setExporting(true);
    try {
      // AI Studio iframe doesn't allow window.fetch overriding which html2pdf.js does
      // We'll use window.print() with our print CSS
      setTimeout(() => {
        window.print();
        setExporting(false);
      }, 500);
    } catch (e) {
      console.error(e);
      setExporting(false);
    }
  };

  const executeExportWorkfile = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(blocks, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `scriptforge_workfile.json`);
    dlAnchorElem.click();
  };

  const executeExportDOCX = async (start: number, end: number) => {
    setExporting(true);
    try {
      const { Document, Paragraph, TextRun, Packer, AlignmentType } = await import('docx');
      const { saveAs } = await import('file-saver');

      // Approximate pagination for DOCX filtering
      let currentLine = 0;
      const blocksToExport = [];
      for (const b of blocks) {
         let lines = 1 + Math.floor(b.text.length / 60);
         currentLine += lines + 1; // plus spacing
         let page = Math.floor(currentLine / 50) + 1;
         if (page >= start && page <= end) {
            blocksToExport.push(b);
         }
      }

      if (blocksToExport.length === 0) {
        setExporting(false);
        return; // nothing to export
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: blocksToExport.map(b => {
             let indent = 0;
             let rightIndent = 0;
             let alignment: typeof AlignmentType.LEFT | typeof AlignmentType.RIGHT = AlignmentType.LEFT;
             let uppercase = false;
             let bold = false;
             let italics = false;

             switch(b.type) {
               case 'scene': 
                 bold = true; uppercase = true; break;
               case 'character': 
                 indent = 2.5 * 72 * 20; 
                 uppercase = true; bold = true; break;
               case 'dialogue': 
                 indent = 1.5 * 72 * 20; 
                 rightIndent = 1.5 * 72 * 20;
                 break;
               case 'parenthetical': 
                 indent = 2.0 * 72 * 20; 
                 rightIndent = 2.0 * 72 * 20;
                 italics = true;
                 break;
               case 'transition': 
                 alignment = AlignmentType.LEFT; 
                 bold = true; uppercase = true; break;
               case 'shot': 
                 alignment = AlignmentType.RIGHT;
                 bold = true; uppercase = true; break;
             }

             return new Paragraph({
               alignment,
               indent: { left: indent, right: rightIndent },
               spacing: { before: 120, after: 120 },
               children: [
                 new TextRun({
                   text: uppercase ? b.text.toUpperCase() : b.text,
                   bold,
                   italics,
                   font: 'Courier New',
                   size: 24, // 12pt
                 })
               ]
             });
          })
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, "screenplay.docx");
    } catch (e) {
      console.error(e);
    }
    setExporting(false);
  };

  const toggleTheme = async () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    if (newTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    
    try {
      // @ts-ignore
      let settings = window.__PROJECT_SETTINGS__ || window.__GLOBAL_SETTINGS__ || {};
      settings = { ...settings, theme: newTheme };
      
      // @ts-ignore
      if (window.__PROJECT_SETTINGS__) window.__PROJECT_SETTINGS__ = settings;
      // @ts-ignore
      if (window.__GLOBAL_SETTINGS__) window.__GLOBAL_SETTINGS__ = settings;

      if (auth.currentUser) {
        const docRef = projectId ? doc(db, 'projects', projectId) : doc(db, 'users', auth.currentUser.uid);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          await updateDoc(docRef, { settings });
        } else if (!projectId) {
          await setDoc(docRef, { 
            settings,
            email: auth.currentUser.email || '',
            createdAt: new Date().toISOString(),
            displayName: auth.currentUser.displayName || '',
            photoURL: auth.currentUser.photoURL || ''
          }, { merge: true });
        }
      }
    } catch (e) {
      console.error("Failed to save theme setting", e);
    }
  };

  if (loading) return <div className="p-12 text-slate-400 flex items-center gap-3"><Loader2 className="animate-spin w-5 h-5"/> Loading editor...</div>;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 relative">
      <div className="border-b border-slate-800 bg-slate-950 flex flex-col lg:flex-row lg:items-center justify-between px-4 lg:px-6 py-3 shrink-0 gap-4 overflow-x-auto hide-scrollbar">
        <div className="flex flex-nowrap lg:flex-wrap items-center gap-2 overflow-x-auto pb-1 lg:pb-0 hide-scrollbar">
          {([
            { label: 'Scene', type: 'scene' },
            { label: 'Action', type: 'action' },
            { label: 'Character', type: 'character' },
            { label: 'Dialogue', type: 'dialogue' },
            { label: 'Parenthetical', type: 'parenthetical' },
            { label: 'Transition', type: 'transition' },
            { label: 'Shot', type: 'shot' }
          ] as const).map((btn) => (
            <button
              key={btn.type}
              onClick={() => setBlockType(btn.type)}
              className="whitespace-nowrap text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={toggleTheme}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <div className="text-sm font-medium text-slate-400 flex items-center gap-2 hidden sm:flex">
             {isSaving || exporting ? <><Loader2 className="w-3 h-3 animate-spin"/> {exporting ? 'Exporting...' : 'Saving...'}</> : (hasUnsavedChanges.current ? 'Unsaved changes' : 'All changes saved')}
          </div>
          <button 
            onClick={() => saveToCloud(blocks, false)}
            className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
          >
            Save Now
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto w-full flex justify-center py-6 md:py-12 px-4 md:px-0">
        {/* Dark theme screenplay page - Simulated 500 pages default size */}
        <div 
          className="w-full max-w-[816px] bg-slate-800 shadow-xl shadow-black/40 border border-slate-700 rounded-lg px-6 md:px-16 lg:px-24 py-12 md:py-24 pb-32 mb-12 flex flex-col cursor-text transition-colors"
          style={{
            minHeight: '528000px', // 500 pages * 1056px
            backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 1054px, var(--color-slate-600) 1054px, var(--color-slate-600) 1056px)',
          }}
        >
           {blocks.map((block, index) => (
             <BlockEditor 
               key={block.id}
               block={block} 
               index={index} 
               projectCharacters={projectCharacters}
               onChange={handleBlockChange}
               onKeyDown={handleKeyDown}
               onFocus={() => setFocusedIndex(index)}
             />
           ))}
        </div>
      </div>

      {/* Hidden print container for PDF export */}
      <div style={{ position: 'absolute', top: -9999, left: -9999, zIndex: -1 }}>
        <div id="print-container" className="bg-white text-black font-mono" style={{ width: '816px', padding: '96px', fontFamily: '"Courier New", Courier, monospace', fontSize: '12pt', lineHeight: '1.2' }}>
          {blocks.map((block) => (
            <div key={block.id} style={{
              marginTop: ['scene', 'character', 'transition', 'shot'].includes(block.type) ? '24px' : '12px',
              marginBottom: ['scene', 'character', 'transition', 'shot'].includes(block.type) ? '12px' : '0px',
              textAlign: block.type === 'shot' ? 'right' : block.type === 'transition' ? 'left' : 'left',
              fontWeight: ['scene', 'character', 'transition', 'shot'].includes(block.type) ? 'bold' : 'normal',
              textTransform: ['scene', 'character', 'transition', 'shot'].includes(block.type) ? 'uppercase' : 'none',
              fontStyle: block.type === 'parenthetical' ? 'italic' : 'normal',
              marginLeft: block.type === 'character' ? '25%' : block.type === 'dialogue' ? '15%' : block.type === 'parenthetical' ? '20%' : '0',
              marginRight: block.type === 'dialogue' ? '15%' : block.type === 'parenthetical' ? '20%' : '0',
              width: block.type === 'character' ? '50%' : block.type === 'dialogue' ? '70%' : block.type === 'parenthetical' ? '60%' : '100%',
              whiteSpace: 'pre-wrap'
            }}>
              {block.text}
            </div>
          ))}
        </div>
      </div>

      {exportModal && exportModal.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-96">
            <h3 className="text-xl font-bold text-white mb-4">Export Document</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Start Page</label>
                <input 
                  type="number"
                  min="1"
                  value={exportModal.startRaw}
                  onChange={e => setExportModal({ ...exportModal, startRaw: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">End Page <span className="text-slate-500 font-normal">(inclusive)</span></label>
                <input 
                  type="number"
                  min="1"
                  placeholder="All"
                  value={exportModal.endRaw}
                  onChange={e => setExportModal({ ...exportModal, endRaw: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white"
                />
                <p className="text-xs text-slate-500 mt-1">Leave blank to export to the end.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setExportModal(null)} className="px-4 py-2 text-slate-300 hover:text-white transition-colors text-sm">Cancel</button>
              <button 
                onClick={() => {
                  const s = parseInt(exportModal.startRaw) || 1;
                  const e = parseInt(exportModal.endRaw) || 999999;
                  exportModal.type === 'pdf' ? executeExportPDF(s, e) : executeExportDOCX(s, e);
                  setExportModal(null);
                }} 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const BlockEditor: React.FC<{
  block: ScriptBlock; 
  index: number;
  projectCharacters: Character[];
  onChange: (idx: number, val: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>, idx: number) => void;
  onFocus: () => void;
}> = ({ block, index, projectCharacters, onChange, onKeyDown, onFocus }) => {
  const [showPopup, setShowPopup] = useState(false);
  const [suggestions, setSuggestions] = useState<Character[]>([]);

  useEffect(() => {
    if (block.type === 'character' && block.text.trim().length > 0) {
      const matchText = block.text.toLowerCase();
      const filtered = projectCharacters.filter(c => c.name.toLowerCase().startsWith(matchText));
      
      // If there's an exact match, we don't necessarily need to hide it unless they've finished. 
      // But showing it is fine until they press Enter or select it.
      if (filtered.length > 0 && !(filtered.length === 1 && filtered[0].name.toLowerCase() === matchText)) {
        setSuggestions(filtered);
        setShowPopup(true);
      } else {
        setShowPopup(false);
      }
    } else {
      setShowPopup(false);
    }
  }, [block.text, block.type, projectCharacters]);

  const getStyles = (type: BlockType) => {
    switch (type) {
      case 'scene': return 'font-bold uppercase mt-6 mb-2 text-slate-200';
      case 'action': return 'mt-2 mb-2 w-full text-left text-slate-300';
      case 'character': return 'ml-[25%] w-[50%] text-left uppercase font-bold mt-4 text-slate-200';
      case 'dialogue': return 'ml-[15%] w-[70%] text-left mt-0 mb-2 text-slate-300';
      case 'parenthetical': return 'ml-[20%] w-[60%] text-left mt-0 mb-0 text-slate-400 italic';
      case 'transition': return 'font-bold uppercase text-left w-full mt-4 mb-4 text-slate-200';
      case 'shot': return 'font-bold uppercase text-right w-full mt-4 mb-2 text-slate-200';
      default: return 'text-slate-300';
    }
  };

  const handleSuggestionClick = (name: string) => {
    onChange(index, name);
    setShowPopup(false);
    
    // Focus the textarea and simulate hitting Enter maybe? Or just keep it focused.
    setTimeout(() => {
      const el = document.getElementById(`block-${index}`) as HTMLTextAreaElement;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 10);
  };

  // Intercept keydown for popup navigation
  const handleEditorKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPopup && suggestions.length > 0) {
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        handleSuggestionClick(suggestions[0].name);
        return;
      }
    }
    // If not handled by popup, pass to parent
    onKeyDown(e, index);
  };

  return (
    <div className={cn("relative font-mono text-[14px] leading-relaxed", getStyles(block.type))}>
      <textarea
        id={`block-${index}`}
        className="w-full resize-none border-none outline-none bg-transparent overflow-hidden placeholder:text-slate-600 focus:ring-0 text-inherit"
        style={{ height: 'auto', minHeight: '1.5em', textAlign: 'inherit' }}
        value={block.text}
        onChange={(e) => {
          e.target.style.height = 'auto';
          e.target.style.height = e.target.scrollHeight + 'px';
          let newValue = e.target.value;
          if (['scene', 'character', 'transition', 'shot'].includes(block.type)) {
            newValue = newValue.toUpperCase();
          }
          onChange(index, newValue);
        }}
        onKeyDown={handleEditorKeyDown}
        onFocus={onFocus}
        onBlur={() => {
          // slight delay so click events on the popup register
          setTimeout(() => setShowPopup(false), 200);
        }}
        placeholder={block.type === 'scene' ? 'INT. SCENE - DAY' : '...'}
        rows={1}
      />
      
      {showPopup && suggestions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {suggestions.map((char) => (
            <div 
              key={char.id}
              onClick={() => handleSuggestionClick(char.name)}
              className="px-4 py-2 hover:bg-slate-700 cursor-pointer text-slate-200 text-sm font-sans flex flex-col"
            >
              <span className="font-bold">{char.name}</span>
              {char.role && <span className="text-xs text-slate-400">{char.role}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
