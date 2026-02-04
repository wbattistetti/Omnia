import React, { useState } from 'react';
import { Edit3, X, Check, MapPin, Tag, Globe, Mail, MessageCircle } from 'lucide-react';
import DataTypeLabel from './DataTypeLabel';
import getIcon from '../../TaskEditor/ResponseEditor/icons';

interface Props {
  detectedType: string | null;
  detectTypeIcon: string | null;
  detectedSubData: string[] | null;
  onCorrect: () => void;
  onWrong: () => void;
  onCancel: () => void;
}

function getSubDataIcon(typeOrLabel: string) {
  if (!typeOrLabel) return <MessageCircle size={18} color="#a21caf" />;
  const t = typeOrLabel.toLowerCase();
  if (t === 'city' || t === 'address' || t === 'street') return <MapPin size={18} color="#a21caf" />;
  if (t === 'postal_code' || t === 'zip') return <Tag size={18} color="#a21caf" />;
  if (t === 'country') return <Globe size={18} color="#a21caf" />;
  if (t === 'email') return <Mail size={18} color="#a21caf" />;
  return <MessageCircle size={18} color="#a21caf" />;
}

const WizardConfirmTypeStep: React.FC<Props> = ({ detectedType, detectTypeIcon, detectedSubData, onCorrect, onWrong, onCancel }) => {
  const [treeData, setTreeData] = useState(detectedSubData || []);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editValue, setEditValue] = useState('');

  const handleAddClick = () => {
    setShowAdd(true);
    setAddValue('');
  };

  const handleAddSave = () => {
    if (addValue.trim()) {
      setTreeData(prev => [...prev, { type: addValue.trim(), label: addValue.trim() }]);
      setShowAdd(false);
    }
  };

  const handleAddCancel = () => {
    setShowAdd(false);
    setAddValue('');
  };

  const handleEditMainClick = (item: any) => {
    setEditingItem(item);
    setEditValue(item.label || item);
  };

  const handleDeleteMain = (item: any) => {
    // Placeholder for delete logic
    console.log('Delete item:', item);
  };

  const handleSaveEdit = (item: any) => {
    if (editValue.trim()) {
      setTreeData(prev => prev.map(i => i.type === item.type ? { ...i, label: editValue.trim() } : i));
      setEditingItem(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditValue('');
  };

  return (
    <div
      style={{
        background: 'var(--sidebar-content-bg, #181825)',
        border: '2px solid #a21caf',
        borderRadius: 16,
        padding: 28,
        maxWidth: 400,
        margin: '32px auto',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ textAlign: 'left', marginBottom: 0, paddingLeft: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
          Create a dialogue for:
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          {getSubDataIcon(detectedType)}
          <span style={{ color: '#a21caf', fontWeight: 700, fontSize: 22 }}>{detectedType}</span>
        </div>
      </div>
      <div style={{ marginBottom: 18, marginTop: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0, width: '100%' }}>
        {treeData.map((item, idx) => {
          const isEditing = editingItem === (item.type || item.label || item);
          const isHovered = hoveredItem === (item.type || item.label || item);
          return (
            <div
              key={item.type || idx}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 0',
                borderRadius: 6,
                transition: 'background 0.2s',
                position: 'relative',
                marginBottom: 2,
                minWidth: 180,
                paddingLeft: 24,
                justifyContent: 'flex-start',
                width: '100%',
              }}
              onMouseEnter={() => setHoveredItem(item.type || item.label || item)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <span style={{ display: 'flex', alignItems: 'center', minWidth: 24, justifyContent: 'center' }}>
                {getSubDataIcon(item.type || item.label || item)}
              </span>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    placeholder={item.label || item}
                    style={{
                      fontSize: 16,
                      color: '#a21caf',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      border: '1px solid #a21caf',
                      borderRadius: 4,
                      padding: '2px 8px',
                      width: '100%',
                      maxWidth: 220,
                      marginRight: 6,
                    }}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(item); if (e.key === 'Escape') handleCancelEdit(); }}
                  />
                  <Check size={16} style={{ color: '#22c55e', cursor: 'pointer', marginRight: 2 }} onClick={() => handleSaveEdit(item)} />
                  <X size={16} style={{ color: '#ef4444', cursor: 'pointer' }} onClick={handleCancelEdit} />
                </>
              ) : (
                <>
                  <span style={{ color: '#a21caf', fontWeight: 500, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>{item.label || item}</span>
                  {isHovered && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
                      <Edit3 size={16} style={{ color: '#a21caf', cursor: 'pointer' }} onClick={() => handleEditMainClick(item)} />
                      <X size={16} style={{ color: '#ef4444', cursor: 'pointer' }} onClick={() => handleDeleteMain(item)} />
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 10, width: '100%', paddingLeft: 24 }}>
          {showAdd ? (
            <>
              <input
                type="text"
                value={addValue}
                onChange={e => setAddValue(e.target.value)}
                placeholder="Scrivi che dati vuoi aggiungere..."
                style={{
                  fontSize: 14,
                  color: '#e5e7eb',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '1px solid #a21caf',
                  borderRadius: 4,
                  padding: '2px 8px',
                  width: '100%',
                  maxWidth: 220,
                  marginRight: 8,
                }}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleAddSave(); if (e.key === 'Escape') handleAddCancel(); }}
              />
              <Check size={16} style={{ color: '#22c55e', cursor: 'pointer' }} onClick={handleAddSave} />
              <X size={16} style={{ color: '#ef4444', cursor: 'pointer' }} onClick={handleAddCancel} />
            </>
          ) : (
            <button
              onClick={handleAddClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'none', color: '#a21caf', border: '1px solid #a21caf', borderRadius: 6,
                fontWeight: 400, fontSize: 15, cursor: 'pointer', padding: '2px 14px',
                margin: '0',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}><b>+</b></span> add...
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
        <button
          onClick={onCancel}
          style={{
            background: '#23232b',
            color: '#9ca3af',
            border: '1px solid #6b7280',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
            padding: '7px 20px',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onCorrect}
          style={{
            background: '#22c55e',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
            padding: '7px 20px',
          }}
        >
          Continua
        </button>
      </div>
    </div>
  );
};

export default WizardConfirmTypeStep;