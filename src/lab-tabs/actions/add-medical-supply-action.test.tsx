import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { launchWorkspace2, openmrsFetch, showNotification, useConfig, type Order } from '@openmrs/esm-framework';
import AddMedicalSupplyAction from './add-medical-supply-action.component';

const mockOrder = {
  patient: { uuid: 'patient-uuid', display: 'Test Patient' },
} as Order;

describe('AddMedicalSupplyAction', () => {
  beforeEach(() => {
    vi.mocked(useConfig).mockReturnValue({ medicalSupplyOrderTypeUuid: 'medical-supply-type' });
  });

  it('passes the patient and active visit to the order basket group', async () => {
    const visit = { uuid: 'visit-uuid' };
    vi.mocked(openmrsFetch).mockResolvedValue({ data: { results: [visit] } } as any);
    vi.mocked(launchWorkspace2).mockResolvedValue(true);

    render(<AddMedicalSupplyAction order={mockOrder} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /add medical supply/i }));

    await waitFor(() => {
      expect(launchWorkspace2).toHaveBeenCalledWith(
        'order-basket',
        {},
        expect.objectContaining({ patientUuid: 'patient-uuid', visitContext: visit }),
        {
          patientUuid: 'patient-uuid',
          patient: { resourceType: 'Patient', id: 'patient-uuid', name: [{ text: 'Test Patient' }] },
          visitContext: visit,
        },
      );
    });
  });

  it('does not open the basket without an active visit', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({ data: { results: [] } } as any);

    render(<AddMedicalSupplyAction order={mockOrder} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /add medical supply/i }));

    await waitFor(() => expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    expect(launchWorkspace2).not.toHaveBeenCalled();
  });

  it('does not open the basket when the order has no patient', async () => {
    render(<AddMedicalSupplyAction order={{} as Order} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /add medical supply/i }));

    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
    expect(openmrsFetch).not.toHaveBeenCalled();
    expect(launchWorkspace2).not.toHaveBeenCalled();
  });
});
