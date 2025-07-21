// Executive summary: Main entry point for the Response Editor component. Handles layout and orchestration of the response tree.
import React, { useState } from 'react';
import { ChevronRight, ChevronDown, MessageCircle, HelpCircle, Headphones, Shield, PhoneOff, Database, Mail, MessageSquare, FunctionSquare as Function, Music, Eraser, ArrowRight, Tag, Clock, ServerCog } from 'lucide-react';
import ToolbarButton from './ToolbarButton';
import TreeView from './TreeView';
import styles from './ResponseEditor.module.css';

const getIconComponent = (iconName: string) => {
  const iconMap: { [key: string]: React.ReactNode } = {
    'Mensagem': <MessageCircle size={16} />,
    'Pergunta': <HelpCircle size={16} />,
    'Para Humano': <Headphones size={16} />,
    'Para Guarda VR': <Shield size={16} />,
    'Desligar': <PhoneOff size={16} />,
    'Ler do Backend': <Database size={16} />,
    'Escrever no Backend': <ServerCog size={16} />,
    'Enviar Email': <Mail size={16} />,
    'Enviar SMS': <MessageSquare size={16} />,
    'Atribuir': <Function size={16} />,
    'Tocar Jingle': <Music size={16} />,
    'Limpar': <Eraser size={16} />,
    'Saltar': <ArrowRight size={16} />,
    'Registrar Dados': <Tag size={16} />,
    'Registrar Rótulo': <Tag size={16} />,
    'Aguardando Agente': <Clock size={16} />
  };
  return iconMap[iconName] || <MessageCircle size={16} />;
};

const ResponseEditor: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.toolbar}>
          <ToolbarButton label="ACQUIRE" />
          <ToolbarButton label="CONFIRM" />
          <ToolbarButton label="INVALID" />
          <ToolbarButton label="NOT CONFIRMED" />
          <ToolbarButton label="EXIT" />
        </div>
      </div>
      <div className={styles.body}>
        <TreeView />
      </div>
    </div>
  );
};

export default ResponseEditor;