// Executive summary: Maps action names to Lucide icon components for use in the response tree.
import React from 'react';
import { MessageCircle, HelpCircle, Headphones, Shield, PhoneOff, Database, Mail, MessageSquare, FunctionSquare as Function, Music, Eraser, ArrowRight, Tag, Clock, ServerCog, User, MapPin, Calendar, Type as TypeIcon, Phone, Hash, Globe, Home, Building, FileText } from 'lucide-react';

const tailwindToHex = (tw?: string): string | undefined => {
  if (!tw) return undefined;
  const map: Record<string, string> = {
    'text-blue-500': '#3b82f6',
    'text-purple-500': '#a21caf',
    'text-green-500': '#22c55e',
    'text-indigo-500': '#6366f1',
    'text-red-500': '#ef4444',
    'text-cyan-500': '#06b6d4',
    'text-blue-600': '#2563eb',
    'text-yellow-600': '#ca8a04',
    'text-teal-500': '#14b8a6',
    'text-violet-500': '#8b5cf6',
    'text-pink-500': '#ec4899',
    'text-gray-500': '#6b7280',
    'text-emerald-500': '#10b981',
    'text-orange-500': '#f59e42',
    'text-amber-500': '#f59e42',
    'text-lime-600': '#65a30d',
  };
  return map[tw] || undefined;
};

const getIconComponent = (iconName: string, color?: string) => {
  const hexColor = tailwindToHex(color) || color;
  const iconMap: { [key: string]: React.ReactNode } = {
    // Core actions aliases
    sayMessage: <MessageCircle size={16} color={hexColor} />,
    SayMessage: <MessageCircle size={16} color={hexColor} />,
    MessageCircle: <MessageCircle size={16} color={hexColor} />,
    HelpCircle: <HelpCircle size={16} color={hexColor} />,
    User: <User size={16} color={hexColor} />,
    MapPin: <MapPin size={16} color={hexColor} />,
    Calendar: <Calendar size={16} color={hexColor} />,
    Type: <TypeIcon size={16} color={hexColor} />,
    Headphones: <Headphones size={16} color={hexColor} />,
    Shield: <Shield size={16} color={hexColor} />,
    PhoneOff: <PhoneOff size={16} color={hexColor} />,
    Database: <Database size={16} color={hexColor} />,
    Mail: <Mail size={16} color={hexColor} />,
    MessageSquare: <MessageSquare size={16} color={hexColor} />,
    Phone: <Phone size={16} color={hexColor} />,
    Hash: <Hash size={16} color={hexColor} />,
    Globe: <Globe size={16} color={hexColor} />,
    Home: <Home size={16} color={hexColor} />,
    Building: <Building size={16} color={hexColor} />,
    Function: <Function size={16} color={hexColor} />,
    Music: <Music size={16} color={hexColor} />,
    Eraser: <Eraser size={16} color={hexColor} />,
    ArrowRight: <ArrowRight size={16} color={hexColor} />,
    Tag: <Tag size={16} color={hexColor} />,
    Clock: <Clock size={16} color={hexColor} />,
    ServerCog: <ServerCog size={16} color={hexColor} />,
    // Alias personalizzati
    'Mensagem': <MessageCircle size={16} color={hexColor} />,
    'Pergunta': <HelpCircle size={16} color={hexColor} />,
    'Para Humano': <Headphones size={16} color={hexColor} />,
    'Para Guarda VR': <Shield size={16} color={hexColor} />,
    'Desligar': <PhoneOff size={16} color={hexColor} />,
    'Ler do Backend': <Database size={16} color={hexColor} />,
    'Escrever no Backend': <ServerCog size={16} color={hexColor} />,
    'Enviar Email': <Mail size={16} color={hexColor} />,
    'Enviar SMS': <MessageSquare size={16} color={hexColor} />,
    'Atribuir': <Function size={16} color={hexColor} />,
    'Tocar Jingle': <Music size={16} color={hexColor} />,
    'Limpar': <Eraser size={16} color={hexColor} />,
    'Saltar': <ArrowRight size={16} color={hexColor} />,
    'Registrar Dados': <Tag size={16} color={hexColor} />,
    'Registrar Rótulo': <Tag size={16} color={hexColor} />,
    'Aguardando Agente': <Clock size={16} color={hexColor} />
  };
  return iconMap[iconName] || <FileText size={16} color={hexColor} />;
};

export default getIconComponent;