import { describe, expect, it } from 'vitest';
import {
  ERROR_TOOLTIP_TASK_NOT_FOUND_COPY,
  userFacingErrorCategoryHeadline,
} from '../ErrorTooltip';

describe('ErrorTooltip user-facing copy', () => {
  it('maps TaskNotFound to Italian title and body constants', () => {
    expect(userFacingErrorCategoryHeadline('TaskNotFound', true)).toBe(
      ERROR_TOOLTIP_TASK_NOT_FOUND_COPY.title
    );
    expect(ERROR_TOOLTIP_TASK_NOT_FOUND_COPY.body).toContain('comportamento');
  });

  it('normalizes tasknotfound casing for headline', () => {
    expect(userFacingErrorCategoryHeadline('tasknotfound', true)).toBe(
      ERROR_TOOLTIP_TASK_NOT_FOUND_COPY.title
    );
  });

  it('maps MissingOrInvalidTask to the same headline as TaskNotFound', () => {
    expect(userFacingErrorCategoryHeadline('MissingOrInvalidTask', true)).toBe(
      ERROR_TOOLTIP_TASK_NOT_FOUND_COPY.title
    );
  });
});
