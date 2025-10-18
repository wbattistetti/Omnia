import { Registry } from './types';
import { dateOfBirthExtractor } from './extractors/dateOfBirth';
import { phoneExtractor } from './extractors/phone';
import { emailExtractor } from './extractors/email';
import { genericExtractor } from './extractors/generic';
import { numberExtractor } from './extractors/number';
import { monthExtractor } from './extractors/month';
import { taxCodeExtractor } from './extractors/taxCode';
import { ibanExtractor } from './extractors/iban';
import { vatNumberExtractor } from './extractors/vatNumber';
import { podPdrCodeExtractor } from './extractors/podPdrCode';
import { accountNumberExtractor } from './extractors/accountNumber';
import { currencyExtractor } from './extractors/currency';
import { postalCodeExtractor } from './extractors/postalCode';
import { timeExtractor } from './extractors/time';
import { urlExtractor } from './extractors/url';

export const registry: Registry = {
  // ✅ Base extractors
  dateOfBirth: dateOfBirthExtractor,
  phone: phoneExtractor,
  email: emailExtractor,
  generic: genericExtractor,
  number: numberExtractor,
  month: monthExtractor,
  
  // ✅ New extractors for customer care
  taxCode: taxCodeExtractor,
  iban: ibanExtractor,
  vatNumber: vatNumberExtractor,
  podPdrCode: podPdrCodeExtractor,
  accountNumber: accountNumberExtractor,
  currency: currencyExtractor,
  postalCode: postalCodeExtractor,
  time: timeExtractor,
  url: urlExtractor,
};



