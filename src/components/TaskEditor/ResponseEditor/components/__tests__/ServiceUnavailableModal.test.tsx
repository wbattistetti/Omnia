// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ServiceUnavailableModal } from '../ServiceUnavailableModal';

/**
 * Tests for ServiceUnavailableModal
 *
 * This component displays a modal for service unavailable errors with optional retry functionality.
 * We test observable behaviors: content rendering, button clicks, callback execution, and error handling.
 *
 * WHAT WE TEST:
 * - Service name and message are displayed
 * - Endpoint is displayed when provided
 * - Endpoint is not displayed when not provided
 * - OK button calls onClose
 * - Retry button is shown when onRetry is provided
 * - Retry button is not shown when onRetry is not provided
 * - Retry button calls onClose and onRetry
 * - Error handling in onRetry (does not crash)
 *
 * WHY IT'S IMPORTANT:
 * - Modal is critical for user feedback on service errors
 * - Callbacks must work correctly for user interaction
 * - Error handling prevents crashes
 * - Conditional rendering affects UX
 */

describe('ServiceUnavailableModal', () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onRetry: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onClose = vi.fn();
    onRetry = vi.fn();
  });

  describe('content rendering', () => {
    it('should display service name and message', () => {
      const serviceUnavailable = {
        service: 'Test Service',
        message: 'Service is temporarily unavailable',
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onClose}
        />
      );

      expect(screen.getByText(/Test Service.*non disponibile/i)).toBeInTheDocument();
      expect(screen.getByText('Service is temporarily unavailable')).toBeInTheDocument();
    });

    it('should display default service name when service is empty', () => {
      const serviceUnavailable = {
        service: '',
        message: 'Service error',
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onClose}
        />
      );

      expect(screen.getByText(/Servizio.*non disponibile/i)).toBeInTheDocument();
    });

    it('should display endpoint when provided', () => {
      const serviceUnavailable = {
        service: 'Test Service',
        message: 'Service error',
        endpoint: '/api/test/endpoint',
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onClose}
        />
      );

      expect(screen.getByText(/Endpoint:.*\/api\/test\/endpoint/i)).toBeInTheDocument();
    });

    it('should not display endpoint when not provided', () => {
      const serviceUnavailable = {
        service: 'Test Service',
        message: 'Service error',
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onClose}
        />
      );

      expect(screen.queryByText(/Endpoint:/i)).not.toBeInTheDocument();
    });
  });

  describe('OK button', () => {
    it('should call onClose when OK button is clicked', () => {
      const serviceUnavailable = {
        service: 'Test Service',
        message: 'Service error',
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onClose}
        />
      );

      const okButton = screen.getByRole('button', { name: /^OK$/i });
      fireEvent.click(okButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry button', () => {
    it('should show Retry button when onRetry is provided', () => {
      const serviceUnavailable = {
        service: 'Test Service',
        message: 'Service error',
        onRetry,
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onClose}
        />
      );

      expect(screen.getByRole('button', { name: /^Retry$/i })).toBeInTheDocument();
    });

    it('should not show Retry button when onRetry is not provided', () => {
      const serviceUnavailable = {
        service: 'Test Service',
        message: 'Service error',
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onClose}
        />
      );

      expect(screen.queryByRole('button', { name: /^Retry$/i })).not.toBeInTheDocument();
    });

    it('should call onClose and onRetry when Retry button is clicked', () => {
      const serviceUnavailable = {
        service: 'Test Service',
        message: 'Service error',
        onRetry,
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onClose}
        />
      );

      const retryButton = screen.getByRole('button', { name: /^Retry$/i });
      fireEvent.click(retryButton);

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should call onClose before onRetry', () => {
      const callOrder: string[] = [];

      const onCloseWithOrder = () => {
        callOrder.push('onClose');
        onClose();
      };

      const onRetryWithOrder = () => {
        callOrder.push('onRetry');
        onRetry();
      };

      const serviceUnavailable = {
        service: 'Test Service',
        message: 'Service error',
        onRetry: onRetryWithOrder,
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onCloseWithOrder}
        />
      );

      const retryButton = screen.getByRole('button', { name: /^Retry$/i });
      fireEvent.click(retryButton);

      expect(callOrder).toEqual(['onClose', 'onRetry']);
    });

    it('should handle errors in onRetry gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const failingOnRetry = () => {
        throw new Error('Retry failed');
      };

      const serviceUnavailable = {
        service: 'Test Service',
        message: 'Service error',
        onRetry: failingOnRetry,
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onClose}
        />
      );

      const retryButton = screen.getByRole('button', { name: /^Retry$/i });

      // Should not throw
      expect(() => {
        fireEvent.click(retryButton);
      }).not.toThrow();

      expect(onClose).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
    });

    it('should handle undefined onRetry gracefully', () => {
      const serviceUnavailable = {
        service: 'Test Service',
        message: 'Service error',
        onRetry: undefined,
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onClose}
        />
      );

      // Retry button should not be shown when onRetry is undefined
      expect(screen.queryByRole('button', { name: /^Retry$/i })).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle empty service name', () => {
      const serviceUnavailable = {
        service: '',
        message: 'Service error',
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onClose}
        />
      );

      expect(screen.getByText(/Servizio.*non disponibile/i)).toBeInTheDocument();
    });

    it('should handle empty message without crashing', () => {
      const serviceUnavailable = {
        service: 'Test Service',
        message: '',
      };

      // Should not throw
      expect(() => {
        render(
          <ServiceUnavailableModal
            serviceUnavailable={serviceUnavailable}
            onClose={onClose}
          />
        );
      }).not.toThrow();
    });

    it('should handle very long service name', () => {
      const serviceUnavailable = {
        service: 'A'.repeat(100),
        message: 'Service error',
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onClose}
        />
      );

      expect(screen.getByText(new RegExp(`${'A'.repeat(100)}.*non disponibile`))).toBeInTheDocument();
    });

    it('should handle very long message', () => {
      const longMessage = 'A'.repeat(500);
      const serviceUnavailable = {
        service: 'Test Service',
        message: longMessage,
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onClose}
        />
      );

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should handle very long endpoint', () => {
      const longEndpoint = '/api/' + 'test/'.repeat(50);
      const serviceUnavailable = {
        service: 'Test Service',
        message: 'Service error',
        endpoint: longEndpoint,
      };

      render(
        <ServiceUnavailableModal
          serviceUnavailable={serviceUnavailable}
          onClose={onClose}
        />
      );

      expect(screen.getByText(new RegExp(`Endpoint:.*${longEndpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))).toBeInTheDocument();
    });
  });
});
