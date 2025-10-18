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
}: KindSelectorProps) {
  const [kindOpen, setKindOpen] = React.useState(false);
  const kindRef = React.useRef<HTMLDivElement | null>(null);

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
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <label style={{ fontSize: 12, opacity: 0.8 }}>Kind</label>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            opacity: 0.8,
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
          />{' '}
          Auto
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} ref={kindRef}>
        {lockKind ? (
          <select
            value={'auto'}
            disabled
            style={{
              flex: 1,
              padding: 6,
              border: '1px solid #ddd',
              borderRadius: 8,
              background: '#f3f4f6',
            }}
          >
            <option value="auto">auto</option>
          </select>
        ) : (
          <div style={{ position: 'relative', flex: 1 }}>
            {/* ⚠️ Warning when kind='generic' */}
            <button
              type="button"
              onClick={() => setKindOpen((o) => !o)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 6,
                border:
                  kind === 'generic' ? '2px solid #ef4444' : '1px solid #ddd',
                borderRadius: 8,
                background: kind === 'generic' ? '#fef2f2' : '#fff',
                cursor: 'pointer',
                position: 'relative',
              }}
              title={
                kind === 'generic'
                  ? "⚠️ L'AI ha usato il tipo generico. Verifica se serve un tipo più specifico."
                  : undefined
              }
            >
              <span
                aria-hidden
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <selectedKindOpt.Icon />
              </span>
              <span
                style={{
                  flex: 1,
                  textAlign: 'left',
                  color: kind === 'generic' ? '#dc2626' : 'inherit',
                  fontWeight: kind === 'generic' ? 600 : 400,
                }}
              >
                {selectedKindOpt.label}
                {kind === 'generic' && ' ⚠️'}
              </span>
              <ChevronDown
                size={14}
                color={kind === 'generic' ? '#dc2626' : '#9ca3af'}
              />
            </button>
            {kind === 'generic' && (
              <div
                style={{
                  marginTop: 4,
                  padding: '6px 8px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  fontSize: 11,
                  color: '#dc2626',
                  display: 'flex',
                  gap: 6,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ flexShrink: 0 }}>⚠️</span>
                <span>
                  L'AI ha usato il tipo <strong>generic</strong>. Verifica se
                  serve un tipo più specifico (number, date, email, etc.).
                </span>
              </div>
            )}
            {kindOpen && (
              <div
                style={{
                  position: 'absolute',
                  zIndex: 20,
                  marginTop: 4,
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  maxHeight: 220,
                  overflowY: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
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
                      padding: '6px 8px',
                      background: opt.value === kind ? '#f3f4f6' : '#fff',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{ display: 'inline-flex', alignItems: 'center' }}
                    >
                      <opt.Icon />
                    </span>
                    <span style={{ textAlign: 'left' }}>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

