// Time extractor
// Supports 24h and 12h formats

import { DataExtractor, ExtractionResult } from '../types';
import { normalizeText } from './base';

export type TimeValue = {
  hours: number;
  minutes: number;
  seconds?: number;
  format: '24h' | '12h';
  period?: 'AM' | 'PM';
};

/**
 * Extracts and validates time from text
 */
export const timeExtractor: DataExtractor<TimeValue> = {
  extract(text: string): ExtractionResult<TimeValue> {
    const raw = String(text || '').trim();
    
    if (!raw) {
      return {
        confidence: 0,
        reasons: ['empty-input']
      };
    }

    const normalized = normalizeText(raw).toUpperCase();

    // Pattern 1: 12h format with AM/PM (2:30 PM, 02:30PM, 2:30 p.m.)
    const format12hPattern = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|A\.M\.|P\.M\.)/i;
    const format12hMatch = normalized.match(format12hPattern);
    
    if (format12hMatch) {
      let hours = parseInt(format12hMatch[1]);
      const minutes = parseInt(format12hMatch[2]);
      const seconds = format12hMatch[3] ? parseInt(format12hMatch[3]) : undefined;
      const period = format12hMatch[4].replace(/\./g, '').toUpperCase() as 'AM' | 'PM';
      
      // Convert to 24h for validation
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return {
          value: {
            hours,
            minutes,
            seconds,
            format: '12h',
            period
          },
          confidence: 0.95,
          metadata: {
            originalFormat: '12h',
            hasSeconds: seconds !== undefined
          }
        };
      }
    }

    // Pattern 2: 24h format (14:30, 14:30:00, 2:30)
    const format24hPattern = /(\d{1,2}):(\d{2})(?::(\d{2}))?(?!\s*[AP]M)/;
    const format24hMatch = raw.match(format24hPattern);
    
    if (format24hMatch) {
      const hours = parseInt(format24hMatch[1]);
      const minutes = parseInt(format24hMatch[2]);
      const seconds = format24hMatch[3] ? parseInt(format24hMatch[3]) : undefined;
      
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return {
          value: {
            hours,
            minutes,
            seconds,
            format: '24h'
          },
          confidence: 0.90,
          metadata: {
            originalFormat: '24h',
            hasSeconds: seconds !== undefined
          }
        };
      }
    }

    return {
      confidence: 0,
      reasons: ['no-time-pattern']
    };
  },

  validate(value: TimeValue): boolean {
    if (!value || typeof value !== 'object') return false;
    if (typeof value.hours !== 'number' || typeof value.minutes !== 'number') return false;
    
    const validHours = value.hours >= 0 && value.hours < 24;
    const validMinutes = value.minutes >= 0 && value.minutes < 60;
    const validSeconds = value.seconds === undefined || (value.seconds >= 0 && value.seconds < 60);
    
    return validHours && validMinutes && validSeconds;
  },

  format(value: TimeValue): string {
    if (!value || typeof value.hours !== 'number' || typeof value.minutes !== 'number') return '—';
    
    const padZero = (num: number) => num.toString().padStart(2, '0');
    
    if (value.format === '12h' && value.period) {
      // Convert back to 12h
      let hours12 = value.hours % 12;
      if (hours12 === 0) hours12 = 12;
      
      const timeStr = `${hours12}:${padZero(value.minutes)}`;
      return value.seconds !== undefined 
        ? `${timeStr}:${padZero(value.seconds)} ${value.period}`
        : `${timeStr} ${value.period}`;
    }
    
    // 24h format
    const timeStr = `${padZero(value.hours)}:${padZero(value.minutes)}`;
    return value.seconds !== undefined ? `${timeStr}:${padZero(value.seconds)}` : timeStr;
  }
};

