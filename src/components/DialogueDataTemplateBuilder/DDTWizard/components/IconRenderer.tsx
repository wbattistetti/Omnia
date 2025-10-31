import React from 'react';
import { User, MapPin, Calendar, Type as TypeIcon, Mail, Phone, Hash, Globe, Home, Building, FileText, HelpCircle } from 'lucide-react';

interface IconRendererProps {
  name?: string;
  size?: number;
}

const IconRenderer: React.FC<IconRendererProps> = ({ name, size = 16 }) => {
  const color = '#fb923c';
  switch ((name || '').trim()) {
    case 'User': return <User size={size} color={color} />;
    case 'MapPin': return <MapPin size={size} color={color} />;
    case 'Calendar': return <Calendar size={size} color={color} />;
    case 'Type': return <TypeIcon size={size} color={color} />;
    case 'Mail': return <Mail size={size} color={color} />;
    case 'Phone': return <Phone size={size} color={color} />;
    case 'Hash': return <Hash size={size} color={color} />;
    case 'Globe': return <Globe size={size} color={color} />;
    case 'Home': return <Home size={size} color={color} />;
    case 'Building': return <Building size={size} color={color} />;
    case 'HelpCircle': return <HelpCircle size={size} color={color} />;
    case 'FileText':
    default:
      return <FileText size={size} color={color} />;
  }
};

export default IconRenderer;

