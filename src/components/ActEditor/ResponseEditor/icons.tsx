// Executive summary: Maps action names to Lucide icon components for use in the response tree.
import React from 'react';
import { MessageCircle, HelpCircle, Headphones, Shield, PhoneOff, Database, Mail, MessageSquare, FunctionSquare as Function, Music, Eraser, ArrowRight, Tag, Clock, ServerCog } from 'lucide-react';

const getIconComponent = (iconName: string) => {
  const iconMap: { [key: string]: React.ReactNode } = {
    // Nomi Lucide standard
    MessageCircle: <MessageCircle size={16} />,
    HelpCircle: <HelpCircle size={16} />,
    Headphones: <Headphones size={16} />,
    Shield: <Shield size={16} />,
    PhoneOff: <PhoneOff size={16} />,
    Database: <Database size={16} />,
    Mail: <Mail size={16} />,
    MessageSquare: <MessageSquare size={16} />,
    Function: <Function size={16} />,
    Music: <Music size={16} />,
    Eraser: <Eraser size={16} />,
    ArrowRight: <ArrowRight size={16} />,
    Tag: <Tag size={16} />,
    Clock: <Clock size={16} />,
    ServerCog: <ServerCog size={16} />,
    // Alias personalizzati (se vuoi mantenere compatibilità)
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

export default getIconComponent; 