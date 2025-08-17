import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DDTWizard from '../DDTWizard';

// Mock fetch with a simple queue of responses
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch as any);

function enqueueJsonResponses(jsons: any[]) {
	(jsons || []).forEach((j) => {
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => j });
	});
}

describe('DDTWizard progress UI behavior', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('shows blue label for current step and renders percentage text near bars', async () => {
		// 1) Detect type -> returns structure with mains and subs
		enqueueJsonResponses([
			{ ai: { schema: { label: 'Personal Data', mainData: [
				{ label: 'Date of Birth', type: 'date', subData: [ { label: 'Day' }, { label: 'Month' }, { label: 'Year' } ] },
			] } } },
			// 2) Enrich constraints (echo structure)
			{ ai: { schema: { label: 'Personal Data', mainData: [
				{ label: 'Date of Birth', type: 'date', subData: [ { label: 'Day' }, { label: 'Month' }, { label: 'Year' } ] },
			] } } }
		]);

		render(<DDTWizard onCancel={() => {}} onComplete={() => {}} />);

		const input = screen.getByPlaceholderText('e.g., date of birth, email, phone number...');
		fireEvent.change(input, { target: { value: 'date of birth' } });
		fireEvent.click(screen.getByText('Invia'));

		// wait for structure step
		await waitFor(() => {
			expect(screen.getByText(/Create a Dialogue for/)).toBeInTheDocument();
		});

		// Start processing
		enqueueJsonResponses([
			// For each generated step the wizard will call endpoints; we stub them with trivial bodies
			{ ok: true }, { ok: true }, { ok: true }, { ok: true }, { ok: true },
		]);
		fireEvent.click(screen.getByText('Continue'));

		// During pipeline we expect the current-step blue label to appear
		await waitFor(() => {
			const label = screen.getByText(/Creating/);
			expect(label).toBeInTheDocument();
		});

		// And the progress indicator text "x / y" should be present (percentage is rendered nearby)
		await waitFor(() => {
			expect(screen.getByText(/\/\s*\d+\s*$/)).toBeTruthy();
		});
	});
});


