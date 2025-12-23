import React from 'react';
import {
  ChevronDown,
  MapPin,
  Globe,
  CreditCard,
  Calendar,
  Mail,
  User,
  Landmark,
  CarFront as Car,
  Type as TypeIcon,
  Hash,
  Phone,
  Badge,
  FileText,
} from 'lucide-react';

export interface KindOption {
  value: string;
  label: string;
  Icon: () => JSX.Element;
}

interface KindSelectorProps {
  kind: string;
  setKind: (value: string) => void;
  lockKind: boolean;
  setLockKind: (value: boolean) => void;
  inferredKind: string;
  hideIfIntent?: boolean; // ✅ Nascondi se kind === "intent"
}

/**
 * Kind selector with auto-lock checkbox and warning for 'generic'
 */
export default function KindSelector({
  kind,
  setKind,
  lockKind,
  setLockKind,
  inferredKind,
  hideIfIntent = false,
}: KindSelectorProps) {
  const [kindOpen, setKindOpen] = React.useState(false);
  const kindRef = React.useRef<HTMLDivElement | null>(null);

  // ✅ Nascondi se kind === "intent" e hideIfIntent è true
  if (hideIfIntent && kind === 'intent') {
    return null;
  }

  const KIND_OPTIONS = React.useMemo(() => {
    const iconColor = '#9ca3af';
    const mk = (value: string, label: string, IconCmp: any): KindOption => ({
      value,
      label,
      Icon: () => <IconCmp size={14} color={iconColor} />,
    });
    const opts = [
      mk('address', 'address', MapPin),
      mk('city', 'city', MapPin),
      mk('country', 'country', Globe),
      mk('credit_card', 'credit card', CreditCard),
      mk('date', 'date', Calendar),
      mk('email', 'email', Mail),
      mk('gender', 'gender', User),
      mk('iban', 'iban', Landmark),
      mk('license_plate', 'license plate', Car),
      mk('name', 'name', TypeIcon),
      mk('number', 'number', Hash),
      mk('phone', 'phone', Phone),
      mk('province', 'province', MapPin),
      mk('street', 'street', MapPin),
      mk('vat', 'vat', Badge),
      mk('zip', 'zip', Hash),
      mk('generic', 'generic', FileText),
    ];
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const selectedKindOpt = React.useMemo(
    () => KIND_OPTIONS.find((o) => o.value === kind) || KIND_OPTIONS[0],
    [KIND_OPTIONS, kind]
  );

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (kindRef.current && !kindRef.current.contains(e.target as Node)) {
        setKindOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Label "Kind" a sinistra */}
      <label
        style={{
          opacity: 0.8,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          whiteSpace: 'nowrap',
        }}
      >
        Kind
      </label>

      {/* Dropdown per selezionare il kind */}
      <div
        ref={kindRef}
        style={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setKindOpen(!kindOpen)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '6px 8px',
            border: '2px solid #9ca3af',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <selectedKindOpt.Icon />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedKindOpt.label}
            </span>
          </div>
          <ChevronDown size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
        </button>

        {kindOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              zIndex: 1000,
              maxHeight: '300px',
              overflowY: 'auto',
            }}
          >
            {KIND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setKind(opt.value);
                  setKindOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  border: 'none',
                  background: kind === opt.value ? '#dbeafe' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (kind !== opt.value) {
                    e.currentTarget.style.background = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (kind !== opt.value) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <opt.Icon />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Checkbox "Auto" a destra */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <input
          type="checkbox"
          checked={lockKind}
          onChange={(e) => {
            const v = e.target.checked;
            setLockKind(v);
            setKind(v ? 'auto' : inferredKind);
          }}
        />
        Auto
      </label>
    </div>
  );
}
