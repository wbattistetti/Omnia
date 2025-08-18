import { Registry } from './types';
import { dateOfBirthExtractor } from './extractors/dateOfBirth';
import { phoneExtractor } from './extractors/phone';
import { emailExtractor } from './extractors/email';

export const registry: Registry = {
  dateOfBirth: dateOfBirthExtractor,
  phone: phoneExtractor,
  email: emailExtractor,
};



