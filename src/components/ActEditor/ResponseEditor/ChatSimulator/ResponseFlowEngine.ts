import { extractTranslations, getEscalationActions, resolveActionText } from './DDTAdapter';
import { getMainDataList, getSubDataList, getNodeSteps } from '../ddtSelectors';
import { inferExpectedKind, validateByKind, ExpectedKind } from './validators';
export interface FlowState {
  currentStep: 'start' | 'noInput' | 'noMatch' | 'confirmation' | 'success';
  escalationLevel: number;
  messages: Array<{ id: string; type: 'bot' | 'user'; text: string; timestamp: Date; stepType?: string; escalationLevel?: number; }>;
  waitingForInput: boolean;
  completed: boolean;
  userInput?: string;
  // Planner position
  plannerIndex?: number;
}

export class ResponseFlowEngine {
  private dict: Record<string, string>;
  private idCounter = 1;
  private plan: Array<{ mainIndex: number; subIndex: number | null; label: string; expectedKind: ExpectedKind }>; // flat collection plan
  private collected: Record<number, string> = {};
  private debugVerbose = true;
  constructor(private ddt: any, translations: any = {}, private selectedNode?: any) {
    this.dict = extractTranslations(ddt, translations);
    console.log('[FlowEngine] init', { hasDDT: !!ddt, hasNode: !!selectedNode, dictKeys: Object.keys(this.dict).length });
    this.plan = this.buildPlan(ddt);
    console.log('[FlowEngine] plan built', this.plan);
  }

  public setSelectedNode(node: any) {
    this.selectedNode = node;
  }

  public setDebug(verbose: boolean) {
    this.debugVerbose = !!verbose;
  }

  private vlog(...args: any[]) {
    if (this.debugVerbose) {
      // eslint-disable-next-line no-console
      console.log('[FlowEngine]', ...args);
    }
  }

  private nextId(): string {
    return `${Date.now()}-${this.idCounter++}`;
  }

  start(): FlowState {
    const text = this.getStepLeadText('start', 1, 0) || '[start]';
    this.vlog('start → plannerIndex=0 text=', text);
    return {
      currentStep: 'start',
      escalationLevel: 1,
      messages: [{ id: this.nextId(), type: 'bot', text, timestamp: new Date(), stepType: 'start', escalationLevel: 1 }],
      waitingForInput: true,
      completed: false,
      plannerIndex: 0,
    };
  }

  processUserInput(state: FlowState, userInput: string): FlowState {
    const messages = [...state.messages];
    if (userInput.trim()) messages.push({ id: this.nextId(), type: 'user', text: userInput, timestamp: new Date() });

    if (userInput === '') return this.replyAndStay('noInput', state, messages);
    if (userInput.toLowerCase() === 'xxxx') return this.replyAndStay('noMatch', state, messages);

    // Determine current target in plan
    const currentPlannerIndex = state.plannerIndex || 0;
    const currentTarget = this.plan[currentPlannerIndex];
    const expected = currentTarget?.expectedKind || 'generic';
    const isValid = validateByKind(expected, userInput);
    this.vlog('processUserInput', { currentPlannerIndex, currentTarget, expected, isValid, userInput });

    // If we are on a main with date subs and input is partial, route to missing sub instead of asking confirmation now
    if ((state.currentStep === 'start' || state.currentStep === 'noInput' || state.currentStep === 'noMatch') && currentTarget && currentTarget.subIndex == null) {
      const subIndices = this.getSubIndicesForMain(currentTarget.mainIndex);
      if (subIndices.length > 0 && expected === 'date') {
        const parts = this.parseDateParts(userInput);
        this.vlog('date main partial input parsed parts=', parts);
        // Persist any provided parts into collected for corresponding subs
        for (const idx of subIndices) {
          const label = String(this.plan[idx].label || '').toLowerCase();
          if (/day|giorno/.test(label) && parts.day) this.collected[idx] = String(parts.day);
          if (/month|mese/.test(label) && parts.month) this.collected[idx] = String(parts.month);
          if (/year|anno/.test(label) && parts.year) this.collected[idx] = String(parts.year);
        }
        this.vlog('collected after partial date update', this.collected);
        // Find first missing component
        const missing = subIndices.find((idx) => {
          const lbl = String(this.plan[idx].label || '').toLowerCase();
          if (/day|giorno/.test(lbl)) return this.collected[idx] == null;
          if (/month|mese/.test(lbl)) return this.collected[idx] == null;
          if (/year|anno/.test(lbl)) return this.collected[idx] == null;
          return false;
        });
        if (missing != null) {
          const prompt = this.getStepLeadText('start', 1, missing) || 'Please provide the missing value (day/month/year).';
          this.vlog('route to missing date sub', { missingIndex: missing, label: this.plan[missing]?.label });
          messages.push({ id: this.nextId(), type: 'bot', text: prompt, timestamp: new Date(), stepType: 'start', escalationLevel: 1 });
          return { ...state, currentStep: 'start', escalationLevel: 1, messages, waitingForInput: true, userInput: undefined, plannerIndex: missing };
        }
      }
    }

    if (state.currentStep === 'start' || state.currentStep === 'noInput' || state.currentStep === 'noMatch') {
      // If we are on a date sub, accept value directly without per-sub confirmation, then route to next missing or main confirmation
      if (currentTarget && currentTarget.subIndex != null) {
        const mainIdx = this.findMainPlanIndex(currentTarget.mainIndex);
        const mainExpected = this.plan[mainIdx]?.expectedKind;
        if (mainExpected === 'date') {
          this.collected[currentPlannerIndex] = userInput;
          this.vlog('accepted date sub without confirmation', { index: currentPlannerIndex, label: currentTarget.label, value: userInput });
          const subIndices = this.getSubIndicesForMain(currentTarget.mainIndex);
          const missing = subIndices.find((idx) => this.collected[idx] == null);
          if (missing != null) {
            const prompt = this.getStepLeadText('start', 1, missing) || 'Please provide the missing value (day/month/year).';
            messages.push({ id: this.nextId(), type: 'bot', text: prompt, timestamp: new Date(), stepType: 'start', escalationLevel: 1 });
            return { ...state, currentStep: 'start', escalationLevel: 1, messages, waitingForInput: true, userInput: undefined, plannerIndex: missing };
          }
          const composite = this.assembleDateFromCollected(currentTarget.mainIndex) || userInput;
          const confText = (this.getStepLeadText('confirmation', 1, mainIdx) || 'Is this correct: {input}?').replace('{input}', composite);
          messages.push({ id: this.nextId(), type: 'bot', text: confText, timestamp: new Date(), stepType: 'confirmation', escalationLevel: 1 });
          return { ...state, currentStep: 'confirmation', escalationLevel: 1, messages, waitingForInput: true, userInput: composite, plannerIndex: mainIdx };
        }
      }
      const conf = (this.getStepLeadText('confirmation', 1, state.plannerIndex || 0) || 'Is this correct: {input}?').replace('{input}', userInput);
      this.vlog('ask confirmation for current target', { index: state.plannerIndex || 0, label: currentTarget?.label, value: userInput });
      messages.push({ id: this.nextId(), type: 'bot', text: conf, timestamp: new Date(), stepType: 'confirmation', escalationLevel: 1 });
      return { ...state, currentStep: 'confirmation', escalationLevel: 1, messages, waitingForInput: true, userInput };
    }

    if (state.currentStep === 'confirmation') {
      // If confirmation accepted (any non-empty), mark this target as collected and advance planner
      const currentIndex = state.plannerIndex || 0;
      // Use the original value that was proposed for confirmation, not the confirmation reply
      const confirmedValue = state.userInput ?? userInput;
      this.collected[currentIndex] = confirmedValue;
      this.vlog('confirmed current target', { currentIndex, label: this.plan[currentIndex]?.label, confirmedValue });
      // If we just confirmed a date sub, decide whether to go to next missing sub or main confirmation
      const cur = this.plan[currentIndex];
      if (cur && cur.subIndex != null) {
        const mainIdx = this.findMainPlanIndex(cur.mainIndex);
        const subIndices = this.getSubIndicesForMain(cur.mainIndex);
        const missing = subIndices.find((idx) => this.collected[idx] == null);
        if (missing != null) {
          // Ask for the next missing sub (start)
          const prompt = this.getStepLeadText('start', 1, missing) || 'Please provide the missing value.';
          this.vlog('date sub confirmed; next missing sub', { missingIndex: missing, label: this.plan[missing]?.label });
          messages.push({ id: this.nextId(), type: 'bot', text: prompt, timestamp: new Date(), stepType: 'start', escalationLevel: 1 });
          return { ...state, currentStep: 'start', escalationLevel: 1, messages, waitingForInput: true, userInput: undefined, plannerIndex: missing };
        }
        // All subs present -> ask confirmation for the whole main
        const composite = this.assembleDateFromCollected(cur.mainIndex) || (state.userInput || confirmedValue);
        const confText = (this.getStepLeadText('confirmation', 1, mainIdx) || 'Is this correct: {input}?').replace('{input}', composite);
        this.vlog('all date subs present → ask main confirmation', { mainIdx, composite });
        messages.push({ id: this.nextId(), type: 'bot', text: confText, timestamp: new Date(), stepType: 'confirmation', escalationLevel: 1 });
        return { ...state, currentStep: 'confirmation', escalationLevel: 1, messages, waitingForInput: true, userInput: composite, plannerIndex: mainIdx };
      }
      // Confirming a main item
      let nextIndex: number;
      const currentExpected = this.plan[currentIndex]?.expectedKind;
      if (currentExpected === 'date') {
        // After confirming a composite date main, skip all its subs and move to next main
        nextIndex = this.getAfterMainIndex(cur.mainIndex);
        this.vlog('confirmed date main → skip subs, nextIndex =', nextIndex);
      } else {
        // For other composite mains (name/address), rely on auto-derivation helper
        nextIndex = this.autoCollectDerivedSubs(currentIndex, confirmedValue);
        this.vlog('auto-derivation done, nextIndex candidate =', nextIndex);
      }
      const allDone = nextIndex >= this.plan.length;
      const text = this.getStepLeadText('success', 1, state.plannerIndex || 0) || 'Thank you!';
      messages.push({ id: this.nextId(), type: 'bot', text, timestamp: new Date(), stepType: 'success', escalationLevel: 1 });
      if (allDone) {
        this.vlog('all items collected → completed');
        return { ...state, currentStep: 'success', escalationLevel: 1, messages, waitingForInput: false, completed: true, plannerIndex: nextIndex };
      }
      // Start next collection target
      const nextStart = this.getStepLeadText('start', 1, nextIndex) || '[start]';
      this.vlog('advance to next planner index', { nextIndex, label: this.plan[nextIndex]?.label });
      messages.push({ id: this.nextId(), type: 'bot', text: nextStart, timestamp: new Date(), stepType: 'start', escalationLevel: 1 });
      return { ...state, currentStep: 'start', escalationLevel: 1, messages, waitingForInput: true, completed: false, userInput: undefined, plannerIndex: nextIndex };
    }

    return state;
  }

  private replyAndStay(stepType: FlowState['currentStep'], state: FlowState, messages: FlowState['messages']): FlowState {
    const nextLevel = Math.min(state.escalationLevel + 1, 3);
    const text = this.getStepLeadText(stepType, nextLevel, state.plannerIndex || 0) || `[${stepType}]`;
    messages.push({ id: this.nextId(), type: 'bot', text, timestamp: new Date(), stepType, escalationLevel: nextLevel });
    return { ...state, currentStep: stepType, escalationLevel: nextLevel, messages, waitingForInput: true };
  }

  private getStepLeadText(stepType: string, level: number, plannerIndex: number): string | undefined {
    // Determine node for current plan index; fallback to selectedNode or root
    let node: any = undefined;
    if (this.plan.length > 0) {
      node = this.getNodeForPlanIndex(plannerIndex);
    }
    node = node || this.selectedNode || this.ddt?.mainData || this.ddt;
    const actions = getEscalationActions(node, stepType, level);
    this.vlog('resolve text', { stepType, level, plannerIndex, hasNode: !!node, actions: actions?.length, nodeLabel: node?.label || node?.name });
    for (const act of actions) {
      const text = resolveActionText(act, this.dict);
      this.vlog('action candidate', { actionId: act?.actionId, text });
      if (text) return text;
    }
    // Fallbacks if no explicit action text is available
    const label = (node?.label || node?.name || '').toString();
    if (stepType === 'start' && label) return `Please provide ${label}.`;
    if (stepType === 'confirmation' && label) return `Is this correct for ${label}: {input}?`;
    if (stepType === 'success' && label) return `Thank you for providing your ${label}.`;
    this.vlog('fallback default for', stepType, level);
    return undefined;
  }

  private buildPlan(ddt: any): Array<{ mainIndex: number; subIndex: number | null; label: string; expectedKind: ExpectedKind }>{
    const plan: Array<{ mainIndex: number; subIndex: number | null; label: string; expectedKind: ExpectedKind }> = [];
    const mains = getMainDataList(ddt);
    mains.forEach((main, mIdx) => {
      const mainLabel = (main?.label || main?.name || `main_${mIdx}`).toString();
      // Only consider nodes that actually have usable start/success (or any steps)
      const mainSteps = getNodeSteps(main);
      if (mainSteps.length > 0) {
        plan.push({ mainIndex: mIdx, subIndex: null, label: mainLabel, expectedKind: inferExpectedKind(mainLabel) });
      }
      const subs = getSubDataList(main);
      subs.forEach((sub, sIdx) => {
        const subLabel = (sub?.label || sub?.name || `sub_${mIdx}_${sIdx}`).toString();
        const subSteps = getNodeSteps(sub);
        if (subSteps.length > 0) {
          plan.push({ mainIndex: mIdx, subIndex: sIdx, label: subLabel, expectedKind: inferExpectedKind(subLabel) });
        }
      });
    });
    this.vlog('buildPlan', { mains: mains.length, plan });
    return plan;
  }

  private getNodeForPlanIndex(index: number): any {
    if (!this.ddt || !this.plan.length) return this.selectedNode || this.ddt;
    const target = this.plan[Math.min(Math.max(index, 0), this.plan.length - 1)];
    const mains = getMainDataList(this.ddt);
    const main = mains[target.mainIndex];
    if (target.subIndex == null) return main;
    const subs = getSubDataList(main);
    return subs[target.subIndex] || main;
  }

  private getSubIndicesForMain(mainIndex: number): number[] {
    const indices: number[] = [];
    for (let i = 0; i < this.plan.length; i++) {
      const p = this.plan[i];
      if (p.mainIndex === mainIndex && p.subIndex != null) indices.push(i);
    }
    return indices;
  }

  private findMainPlanIndex(mainIndex: number): number {
    for (let i = 0; i < this.plan.length; i++) {
      const p = this.plan[i];
      if (p.mainIndex === mainIndex && p.subIndex == null) return i;
    }
    return 0;
  }

  private getAfterMainIndex(mainIndex: number): number {
    // Return the first plan index with a mainIndex greater than the provided one
    for (let i = 0; i < this.plan.length; i++) {
      const p = this.plan[i];
      if (p.mainIndex > mainIndex) return i;
    }
    return this.plan.length; // end of plan
  }

  private parseDateParts(s: string): { day?: number; month?: number; year?: number } {
    const raw = String(s || '').trim();
    if (!raw) return {};
    const str = raw.toLowerCase();
    const tokens = str.split(/[^a-z0-9]+/i).filter(Boolean);

    // Month dictionary (en + it) with partial matches support
    const monthMap: Record<string, number> = {
      jan: 1, january: 1, gen: 1, gennaio: 1,
      feb: 2, february: 2, febbra: 2, febbraio: 2,
      mar: 3, march: 3, marzo: 3,
      apr: 4, april: 4, aprile: 4,
      may: 5, maggio: 5,
      jun: 6, june: 6, giu: 6, giugno: 6,
      jul: 7, july: 7, lug: 7, luglio: 7,
      aug: 8, august: 8, ago: 8, agosto: 8,
      sep: 9, sept: 9, september: 9, sett: 9, settembre: 9,
      oct: 10, october: 10, ott: 10, ottobre: 10,
      nov: 11, november: 11, novembre: 11,
      dec: 12, december: 12, dic: 12, dicembre: 12
    };

    let day: number | undefined;
    let month: number | undefined;
    let year: number | undefined;

    // Extract 4-digit year explicitly only if present
    for (const t of tokens) {
      if (/^\d{4}$/.test(t)) {
        const y = parseInt(t, 10);
        if (y >= 1900 && y <= 2100) { year = y; break; }
      }
    }

    // Extract textual month (partial prefix allowed)
    for (const t of tokens) {
      if (!month) {
        const candidates = Object.keys(monthMap).filter(k => t.startsWith(k));
        if (candidates.length > 0) month = monthMap[candidates.sort((a,b)=>b.length-a.length)[0]];
      }
    }

    // Extract numeric parts for day/month if still missing
    const nums = tokens.filter(t => /^\d{1,2}$/.test(t)).map(n => parseInt(n, 10));
    // Heuristics: if month not set and a number in 1..12 exists, use it as month (but not if it looks like a day preceded by month word)
    for (const n of nums) {
      if (!month && n >= 1 && n <= 12) { month = n; continue; }
      if (!day && n >= 1 && n <= 31) { day = n; continue; }
    }

    // Support dd/mm[/yyyy] or mm/dd[/yyyy]
    const slash = raw.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
    if (slash) {
      const a = parseInt(slash[1], 10);
      const b = parseInt(slash[2], 10);
      const y = slash[3] ? parseInt(slash[3], 10) : undefined;
      if (!month && !day) {
        // Prefer day-month if a>12
        if (a > 12) { day = a; month = b; } else { month = a; day = b; }
      }
      if (y && !year) year = y >= 100 ? y : (y + 2000);
    }

    this.vlog('parseDateParts tokens→', tokens, '=>', { day, month, year });
    const result: { day?: number; month?: number; year?: number } = {};
    if (typeof day === 'number') result.day = day;
    if (typeof month === 'number') result.month = month;
    if (typeof year === 'number') result.year = year;
    return result;
  }

  private assembleDateFromCollected(mainIndex: number): string | undefined {
    const subs = this.getSubIndicesForMain(mainIndex);
    if (subs.length === 0) return undefined;
    let day: string | undefined, month: string | undefined, year: string | undefined;
    for (const idx of subs) {
      const v = this.collected[idx];
      if (v == null) return undefined;
      const label = String(this.plan[idx].label || '').toLowerCase();
      if (/day|giorno/.test(label)) day = String(v);
      if (/month|mese/.test(label)) month = String(v);
      if (/year|anno/.test(label)) year = String(v);
    }
    if (!day || !month || !year) return undefined;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Heuristic: If current item label indicates a full name and upcoming subs are first/last name, split and auto-collect them.
  private autoCollectDerivedSubs(currentIndex: number, input: string): number {
    const current = this.plan[currentIndex];
    if (!current) return currentIndex + 1;
    const labelLc = String(current.label || '').toLowerCase();
    const isName = /\b(name|nome)\b/.test(labelLc);
    const isAddress = /(address|indirizzo|via|street|location)/.test(labelLc);

    // Name composition
    if (isName) {
      const parts = String(input || '').trim().split(/\s+/).filter(Boolean);
      if (parts.length < 2) return currentIndex + 1;
      const first = parts[0];
      const last = parts.slice(1).join(' ');

      let idx = currentIndex + 1;
      while (idx < this.plan.length && this.plan[idx].mainIndex === current.mainIndex && this.plan[idx].subIndex != null) {
        const label = String(this.plan[idx].label || '').toLowerCase();
        const isFirst = (/first|given|nome/.test(label)) && /name|nome/.test(label);
        const isLast = ((/last|surname|family|cognome/.test(label)) && /name|nome/.test(label));
        if (isFirst) { this.collected[idx] = first; idx++; continue; }
        if (isLast) { this.collected[idx] = last; idx++; continue; }
        // Any other sub under the same main => use full input
        this.collected[idx] = input; idx++;
      }
      return idx;
    }

    // Address composition
    if (isAddress) {
      const parts = this.parseAddressParts(String(input || ''));
      let idx = currentIndex + 1;
      while (idx < this.plan.length && this.plan[idx].mainIndex === current.mainIndex && this.plan[idx].subIndex != null) {
        const label = String(this.plan[idx].label || '').toLowerCase();
        const isStreet = /(street|via|address\s*line|line\s*1|line1|indirizzo)/.test(label);
        const isCity = /(city|città|comune)/.test(label);
        const isPostal = /(postal|postcode|zip|cap)/.test(label);
        const isCountry = /(country|paese|nazione)/.test(label);
        const isState = /(state|province|provincia|region|county)/.test(label);

        if (isStreet) { this.collected[idx] = parts.street || input; idx++; continue; }
        if (isCity) { this.collected[idx] = parts.city || input; idx++; continue; }
        if (isPostal) { this.collected[idx] = parts.postal || input; idx++; continue; }
        if (isCountry) { this.collected[idx] = parts.country || input; idx++; continue; }
        if (isState) { this.collected[idx] = parts.state || input; idx++; continue; }
        // Unknown piece -> fallback to full input
        this.collected[idx] = input; idx++;
      }
      return idx;
    }

    return currentIndex + 1;
  }

  private parseAddressParts(s: string): { street?: string; city?: string; postal?: string; country?: string; state?: string } {
    const str = s.trim();
    if (!str) return {};
    // Split by commas as coarse separators
    const tokens = str.split(',').map(t => t.trim()).filter(Boolean);
    let street: string | undefined = undefined;
    let city: string | undefined = undefined;
    let postal: string | undefined = undefined;
    let country: string | undefined = undefined;
    let state: string | undefined = undefined;

    // Try to find postal like 4-6 digits or common alnum formats
    const postalMatch = str.match(/\b\d{4,6}\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i);
    if (postalMatch) postal = postalMatch[0];

    // Heuristic mapping: [street][city][state/postal][country]
    if (tokens.length >= 1) street = tokens[0];
    if (tokens.length >= 2) city = tokens[1];
    if (tokens.length >= 3) {
      const t = tokens[2];
      if (!postal && /\b\d{4,6}\b/.test(t)) postal = (t.match(/\b\d{4,6}\b/) || [undefined])[0];
      // extract state letters before postal
      const st = t.replace(/\b\d.*$/, '').trim();
      if (st) state = st;
    }
    if (tokens.length >= 4) country = tokens[3];

    // Fallbacks
    if (!city && tokens.length >= 2) city = tokens[tokens.length - 2];
    if (!country && tokens.length >= 2) country = tokens[tokens.length - 1];

    return { street, city, postal, country, state };
  }
}