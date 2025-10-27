const API = '';

export async function ddtStep1() {
  const res = await fetch(`${API}/step1`, { method: 'POST' });
  return (await res.json()).ai;
}

export async function ddtStep2(user_desc: string) {
  const res = await fetch(`${API}/step2-with-provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userDesc: user_desc, provider: 'openai' })
  });
  return (await res.json()).ai;
}

export async function ddtStep3(meaning: string, desc: string) {
  const res = await fetch(`${API}/step3`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meaning, desc })
  });
  return (await res.json()).ai;
}

export async function ddtStep3b(user_constraints: string, meaning: string, desc: string) {
  const res = await fetch(`${API}/step3b`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_constraints, meaning, desc })
  });
  return (await res.json()).ai;
}

export async function ddtStep4(meaning: string, desc: string, constraints: string) {
  const res = await fetch(`${API}/step4`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meaning, desc, constraints })
  });
  return (await res.json()).ai;
}