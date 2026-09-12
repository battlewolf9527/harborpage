import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import './Notes.css';
import type { Note } from '../../types';
import { generateId } from '../../utils/idUtils';
import { useNotesStore } from '../../store/useNotesStore';

const EMPTY_NOTE = { title: '', content: '' };

const Notes: React.FC = () => {
  const { t } = useTranslation('notes');
  const { notes, setNotes } = useNotesStore(
    useShallow((s) => ({ notes: s.notes, setNotes: s.setNotes })),
  );
  const [showAddNote, setShowAddNote] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [newNote, setNewNote] = useState(EMPTY_NOTE);

  const handleAddNote = useCallback(() => {
    if (newNote.title.trim() || newNote.content.trim()) {
      const note: Note = {
        id: generateId(),
        title: newNote.title.trim() || t('untitled'),
        content: newNote.content.trim(),
        createdAt: new Date().toISOString(),
      };
      setNotes(prevNotes => [note, ...prevNotes]);
      setNewNote(EMPTY_NOTE);
      setShowAddNote(false);
    }
  }, [newNote, setNotes, t]);

  const handleEditNote = useCallback(() => {
    if (editingNote) {
      const updatedNote = {
        id: editingNote.id,
        title: newNote.title.trim() || t('untitled'),
        content: newNote.content.trim(),
      };
      setNotes(prevNotes => prevNotes.map(note =>
        note.id === updatedNote.id
          ? { ...note, ...updatedNote }
          : note
      ));
      setEditingNote(null);
      setNewNote(EMPTY_NOTE);
    }
  }, [editingNote, newNote, setNotes, t]);

  const handleDeleteNote = useCallback((id: string) => {
    setNotes(prevNotes => prevNotes.filter(note => note.id !== id));
  }, [setNotes]);

  const startEditNote = useCallback((note: Note) => {
    setEditingNote(note);
    setNewNote({ title: note.title, content: note.content });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingNote(null);
    setNewNote(EMPTY_NOTE);
  }, []);

  const handleShowAdd = useCallback(() => {
    setShowAddNote(true);
    setEditingNote(null);
  }, []);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewNote(prev => ({ ...prev, title: e.target.value }));
  }, []);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewNote(prev => ({ ...prev, content: e.target.value }));
  }, []);

  return (
    <div className="notes">
      <h3>{t('panel.title')}</h3>

      <button
        className="add-note-button"
        onClick={handleShowAdd}
      >
        {t('addNote')}
      </button>

      {(showAddNote || editingNote) && (
        <div className="note-form">
          <h4>{editingNote ? t('editNote') : t('addNote')}</h4>
          <input
            type="text"
            placeholder={t('panel.titlePlaceholder')}
            value={newNote.title}
            onChange={handleTitleChange}
          />
          <textarea
            placeholder={t('panel.contentPlaceholder')}
            value={newNote.content}
            onChange={handleContentChange}
            rows={4}
          />
          <div className="form-buttons">
            <button onClick={editingNote ? handleEditNote : handleAddNote}>
              {editingNote ? t('save') : t('add')}
            </button>
            <button onClick={cancelEdit}>{t('cancel')}</button>
          </div>
        </div>
      )}

      <div className="note-list">
        {notes.map((note) => (
          <div key={note.id} className="note-item">
            <div className="note-header">
              <h4 onClick={() => startEditNote(note)}>{note.title}</h4>
              <button
                className="delete-note"
                onClick={() => handleDeleteNote(note.id)}
              >
                🗑️
              </button>
            </div>
            <p onClick={() => startEditNote(note)}>{note.content}</p>
            <div className="note-footer">
              <span>{new Date(note.createdAt).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notes;
