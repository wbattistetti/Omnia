import { extractTranslations, getEscalationActions, resolveActionText } from './DDTAdapter';
import { getMainDataList, getSubDataList, getNodeSteps } from '../TaskEditor/ResponseEditor/ddtSelectors';
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
  constructor(private ddt: any, translations: any = {}, private selectedNode?: any) {
    this.dict = extractTranslations(ddt, translations);
    console.log('[FlowEngine] init', { hasDDT: !!ddt, hasNode: !!selectedNode, dictKeys: Object.keys(this.dict).length });
    this.plan = this.buildPlan(ddt);
    console.log('[FlowEngine] plan built', this.plan);
  }

  public setSelectedNode(node: any) {
    this.selectedNode = node;
  }

  private nextId(): string {
    return `${Date.now()}-${this.idCounter++}`;
  }

  start(): FlowState {
    const text = this.getStepLeadText('start', 1, 0) || '[start]';
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
    const currentTarget = this.plan[state.plannerIndex || 0];
    const expected = currentTarget?.expectedKind || 'generic';
    const isValid = validateByKind(expected, userInput);
    console.log('[FlowEngine] input validation', { expected, isValid, userInput });

    if (state.currentStep === 'start' || state.currentStep === 'noInput' || state.currentStep === 'noMatch') {
      const conf = (this.getStepLeadText('confirmation', 1, state.plannerIndex || 0) || 'Is this correct: {input}?').replace('{input}', userInput);
      messages.push({ id: this.nextId(), type: 'bot', text: conf, timestamp: new Date(), stepType: 'confirmation', escalationLevel: 1 });
      return { ...state, currentStep: 'confirmation', escalationLevel: 1, messages, waitingForInput: true, userInput };
    }

    if (state.currentStep === 'confirmation') {
      // If confirmation accepted (any non-empty), mark this target as collected and advance planner
      const nextIndex = (state.plannerIndex || 0) + 1;
      const allDone = nextIndex >= this.plan.length;
      const text = this.getStepLeadText('success', 1, state.plannerIndex || 0) || 'Thank you!';
      messages.push({ id: this.nextId(), type: 'bot', text, timestamp: new Date(), stepType: 'success', escalationLevel: 1 });
      if (allDone) {
        return { ...state, currentStep: 'success', escalationLevel: 1, messages, waitingForInput: false, completed: true, plannerIndex: nextIndex };
      }
      // Start next collection target
      const nextStart = this.getStepLeadText('start', 1, nextIndex) || '[start]';
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
    console.log('[FlowEngine] resolve text', { stepType, level, hasNode: !!node, actions: actions?.length });
    for (const act of actions) {
      const text = resolveActionText(act, this.dict);
      console.log('[FlowEngine] action', { actionId: act?.actionId, text });
      if (text) return text;
    }
    console.warn('[FlowEngine] fallback default for', stepType, level);
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
}

