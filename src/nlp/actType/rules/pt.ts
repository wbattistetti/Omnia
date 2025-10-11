import { RuleSet } from '../types';

export const PT_RULES: RuleSet = {
  MESSAGE: [
    /^(diga|informe|mostre|avise|explique|anuncie)\b/i,
    /^(diz|informa|mostra|avisa|explica|anuncia)\b/i,
  ],
  REQUEST_DATA: [
    /^(pe[çc]a|solicite|pergunte|colete)\b/i,
    /^(pede|solicita|pergunta|coleta)\b/i,
  ],
  PROBLEM: /\b(problema|erro|falha|bug|sintoma[s]?)\b/i,
  PROBLEM_SPEC_DIRECT: [
    /^(descreva|explique|liste|relate)\s+(o\s+)?(problema|erro|falha|bug|sintoma[s]?)\b/i,
    /^(descreve|explica|lista|relata)\s+(o\s+)?(problema|erro|falha|bug|sintoma[s]?)\b/i,
  ],
  PROBLEM_REASON: [
    /^(pe[çc]a|solicite|pergunte)\s+(o\s+)?(problema|motivo\s+da\s+(liga[çc][aã]o|chamada|solicita[çc][aã]o))\b/i,
    /^(pede|solicita|pergunta)\s+(o\s+)?(problema|motivo\s+da\s+(liga[çc][aã]o|chamada|solicita[çc][aã]o))\b/i,
  ],
  CONFIRM_DATA: [
    /^(confirme|verifique|certifique\-se)\b/i,
    /\b(est[áa]\s+correto)\??$/i,
    /^(confirma|verifica|certifica\-se)\b/i,
  ],
  SUMMARY: [
    /^(resuma|fa[çc]a\s+um\s+resumo|recapitule)\b/i,
    /^(resume|fornece\s+um\s+resumo|recapitula)\b/i,
    /\b(em resumo|em s[ií]ntese)\b/i,
  ],
  BACKEND_CALL: [
    /\b(api|webhook|endpoint|crm|erp|token)\b/i,
    /\b(get|post|put|patch|delete)\b/i,
    /^(chame|invoque|execute|busque|atualize|exclua|crie)\b/i,
    /^(chama|invoca|executa|busca|atualiza|exclui|cria)\b/i,
  ],
};


