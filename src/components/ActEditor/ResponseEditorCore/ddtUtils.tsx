import React from 'react';
import {
  Calendar, Mail, MapPin, FileText,
  PlayCircle, HelpCircle, MicOff, CheckCircle2, CheckSquare, AlertCircle,
  MessageCircle, Headphones, Shield, PhoneOff, Database,
  MessageSquare, FunctionSquare as Function, Music, Eraser, ArrowRight,
  Tag, Clock, ServerCog
} from 'lucide-react';

// Mappa delle icone per le azioni (aggiunta per TaskList)
export const iconMap: Record<string, JSX.Element> = {
  MessageCircle: <MessageCircle size={24} />,
  HelpCircle: <HelpCircle size={24} />,
  Headphones: <Headphones size={24} />,
  Shield: <Shield size={24} />,
  PhoneOff: <PhoneOff size={24} />,
  Database: <Database size={24} />,
  Mail: <Mail size={24} />,
  MessageSquare: <MessageSquare size={24} />,
  Function: <Function size={24} />,
  Music: <Music size={24} />,
  Eraser: <Eraser size={24} />,
  ArrowRight: <ArrowRight size={24} />,
  Tag: <Tag size={24} />,
  Clock: <Clock size={24} />,
  ServerCog: <ServerCog size={24} />
};

export function getDDTIcon(type: string): JSX.Element {
  if (!type) return <FileText className="w-5 h-5 text-fuchsia-100 mr-2" />;
  const t = type.toLowerCase();
  if (t === 'date') return <Calendar className="w-5 h-5 text-fuchsia-100 mr-2" />;
  if (t === 'email') return <Mail className="w-5 h-5 text-fuchsia-100 mr-2" />;
  if (t === 'address') return <MapPin className="w-5 h-5 text-fuchsia-100 mr-2" />;
  return <FileText className="w-5 h-5 text-fuchsia-100 mr-2" />;
}

export function getNodeByIndex(mainData: any, index: number | null) {
  if (index == null) return mainData;
  if (!mainData.subData || !mainData.subData[index]) return mainData;
  return mainData.subData[index];
}

export function ordinalIt(n: number): string {
  if (n === 1) return '1°';
  if (n === 2) return '2°';
  if (n === 3) return '3°';
  return `${n}°`;
}

export function buildDDTForUI(ddt: any, selectedNode: any) {
  if (!ddt) return ddt;

  return {
    ...ddt,
    steps: Object.fromEntries(
      (selectedNode?.steps || []).map((stepGroup: any) => [
        stepGroup.type,
        (stepGroup.escalations || []).map((escalation: any) => ({
          type: 'escalation',
          id: escalation.escalationId,
          actions: escalation.actions
        }))
      ])
    )
  };
}

export const stepMeta: Record<string, {
  icon: JSX.Element;
  label: string;
  border: string;
  bg: string;
  color: string;
  bgActive: string
}> = {
  start:        { icon: <PlayCircle size={17} />,        label: 'Chiedo il dato',      border: '#3b82f6', bg: 'rgba(59,130,246,0.08)', color: '#3b82f6', bgActive: 'rgba(59,130,246,0.18)' },
  noMatch:      { icon: <HelpCircle size={17} />,        label: 'Non capisco',         border: '#ef4444', bg: 'rgba(239,68,68,0.08)', color: '#ef4444', bgActive: 'rgba(239,68,68,0.18)' },
  noInput:      { icon: <MicOff size={17} />,            label: 'Non sento',           border: '#6b7280', bg: 'rgba(107,114,128,0.08)', color: '#6b7280', bgActive: 'rgba(107,114,128,0.18)' },
  confirmation: { icon: <CheckCircle2 size={17} />,      label: 'Devo confermare',     border: '#eab308', bg: 'rgba(234,179,8,0.08)', color: '#eab308', bgActive: 'rgba(234,179,8,0.18)' },
  success:      { icon: <CheckSquare size={17} />,       label: 'Ho capito!',           border: '#22c55e', bg: 'rgba(34,197,94,0.08)', color: '#22c55e', bgActive: 'rgba(34,197,94,0.18)' },
  notAcquired:  { icon: <AlertCircle size={17} />,       label: 'Dato non acquisito',  border: '#f59e42', bg: 'rgba(245,158,66,0.08)', color: '#f59e42', bgActive: 'rgba(245,158,66,0.18)' },
};