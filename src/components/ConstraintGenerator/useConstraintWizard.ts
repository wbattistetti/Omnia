import { useState, useEffect } from 'react';
import { Constraint, LanguageKey } from './types';
import { generateConstraint } from './ConstraintAPI';
import { useConstraintAI } from './useConstraintAI';

export function useConstraintWizard(variable: string, type: string) {
  const [step, setStep] = useState(1);
  const [description, setDescription] = useState('');
  const [label, setLabel] = useState<string | null>(null);
  const [constraint, setConstraint] = useState<Constraint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState<LanguageKey>('js');
  const [showComments, setShowComments] = useState(true);
  const [aiScripts, setAIScripts] = useState<{ js: string; py: string; ts: string }>({ js: '', py: '', ts: '' });
  const [aiSummary, setAISummary] = useState('');
  const [aiTests, setAITests] = useState<any[]>([]);
  const [aiLabel, setAILabel] = useState<string>('');
  const [aiPayoff, setAIPayoff] = useState<string>('');
  const { loading: aiLoading, error: aiError, result: aiResult, generate } = useConstraintAI();
  const [editingLabel, setEditingLabel] = useState(false);
  const [editingPayoff, setEditingPayoff] = useState(false);

  async function handleAIClick() {
    const result = await generate(description, variable, type);
    if (result) {
      setAIScripts(result.scripts);
      setAISummary(result.summary);
      setAITests(result.tests || []);
      setAILabel(result.label || '');
      setAIPayoff(result.payoff || '');
      setEditingLabel(false);
      setEditingPayoff(false);
    } else {
      setAISummary('AI error: unable to generate script.');
      setAIScripts({ js: '', py: '', ts: '' });
      setAITests([]);
      setAILabel('');
      setAIPayoff('');
    }
  }

  async function generateLabel(desc: string): Promise<string> {
    if (desc.toLowerCase().includes('passato')) return 'Il valore deve essere nel passato';
    if (desc.toLowerCase().includes('positivo')) return 'Il valore deve essere positivo';
    return 'Vincolo personalizzato';
  }

  async function handleLabelSubmit() {
    setLoading(true);
    setError(null);
    try {
      const generated = await generateLabel(description);
      setLabel(generated);
      setEditing(false);
    } catch (e: any) {
      setError('Errore generazione etichetta');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateConstraint() {
    setLoading(true);
    setError(null);
    try {
      const c = await generateConstraint(description, variable, type);
      setStep(2);
      handleAIClick();
    } catch (e: any) {
      setError(e.message || 'Errore generazione constraint');
    } finally {
      setLoading(false);
    }
  }

  function handleScriptChange(newScript: string) {
    if (!constraint) return;
    setConstraint({ ...constraint, script: newScript });
  }
  function handleTestCasesChange(newTestCases: any) {
    if (!constraint) return;
    setConstraint({ ...constraint, testCases: newTestCases });
  }

  function getConstraintIcon() {
    if (label && label.toLowerCase().includes('passato')) return 'clock';
    return 'lock';
  }

  function handleLanguageChange(lang: LanguageKey) {
    setCurrentLanguage(lang);
  }

  useEffect(() => {
    if (loading || aiLoading) {
      document.body.style.cursor = 'progress';
    } else {
      document.body.style.cursor = '';
    }
    return () => {
      document.body.style.cursor = '';
    };
  }, [loading, aiLoading]);

  return {
    step, setStep,
    description, setDescription,
    label, setLabel,
    constraint, setConstraint,
    loading, setLoading,
    error, setError,
    editing, setEditing,
    currentLanguage, setCurrentLanguage,
    showComments, setShowComments,
    aiScripts, setAIScripts,
    aiSummary, setAISummary,
    aiTests, setAITests,
    aiLabel, setAILabel,
    aiPayoff, setAIPayoff,
    aiLoading, aiError, aiResult,
    editingLabel, setEditingLabel,
    editingPayoff, setEditingPayoff,
    handleAIClick,
    handleLabelSubmit,
    handleGenerateConstraint,
    handleScriptChange,
    handleTestCasesChange,
    getConstraintIcon,
    handleLanguageChange
  };
} 