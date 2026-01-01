import React from 'react';

export default function SynonymsEditor({
	value = [],
	onChange,
}: {
	value?: string[];
	onChange: (next: string[]) => void;
}) {
	const [input, setInput] = React.useState('');
	const add = () => {
		const t = input.trim();
		if (!t) return;
		const next = Array.from(new Set([...(value || []), t]));
		onChange(next);
		setInput('');
	};
	const remove = (s: string) => onChange((value || []).filter(v => v !== s));

	return (
		<div style={{ padding: 12 }}>
			<div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
				<input
					value={input}
					onChange={e => setInput(e.target.value)}
					onKeyDown={e => { if (e.key === 'Enter') add(); }}
					placeholder="Aggiungi sinonimo…"
					style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd' }}
				/>
				<button onClick={add} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>
					Aggiungi
				</button>
			</div>

			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
				{(value || []).map(s => (
					<span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: '#eef2ff', color: '#3730a3', fontWeight: 600 }}>
						{s}
						<button onClick={() => remove(s)} style={{ border: 0, background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>✕</button>
					</span>
				))}
				{(!value || value.length === 0) && <span style={{ color: '#6b7280' }}>Nessun sinonimo</span>}
			</div>
		</div>
	);
}


