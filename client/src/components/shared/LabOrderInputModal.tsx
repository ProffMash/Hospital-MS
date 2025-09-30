import React, { useEffect, useState } from 'react';
import { Modal } from '../UI/Modal';
import { Input } from '../UI/Input';
import { Button } from '../UI/Button';

type TestInput = {
  key: string;
  value: string;
};

type Payload = {
  patientId: string;
  doctorId?: string;
  tests: string[]; // array of test keys/ids
  testDetails?: TestInput[]; // structured values for each test
  status?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string;
  doctorId?: string;
  selectedCategoryKeys: string[]; // keys corresponding to tests selected in parent
  mode?: 'order' | 'result';
  title?: string;
  submitLabel?: string;
  onSubmit: (payload: Payload) => void;
};

const LabOrderInputModal: React.FC<Props> = ({ isOpen, onClose, patientId, doctorId, selectedCategoryKeys, mode, title, submitLabel, onSubmit }) => {
  const [testsInputs, setTestsInputs] = useState<TestInput[]>([]);
  // status is included in the payload but not edited in this modal UI
  const [status] = useState<string>('pending');

  useEffect(() => {
    setTestsInputs(selectedCategoryKeys.map(k => ({ key: k, value: '' })));
  }, [selectedCategoryKeys]);

  const updateTest = (index: number, patch: Partial<TestInput>) => {
    setTestsInputs(prev => prev.map((t, i) => i === index ? { ...t, ...patch } : t));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      alert('Please select a patient before creating the order.');
      return;
    }
    if (!testsInputs.length) {
      alert('No tests selected.');
      return;
    }

    // Parent expects `tests` as an array of test keys/ids and may accept
    // `testDetails` (structured values) — prepare both.
    const tests = testsInputs.map(t => t.key);
    const testDetails = testsInputs.map(t => ({ key: t.key, value: t.value }));

    onSubmit({
      patientId: patientId,
      doctorId,
      tests,
      testDetails,
      status,
    });
  };

  const humanizeKey = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'Enter Lab Order Details'} size="large">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-sm text-gray-700">Enter details for each selected test below. You can leave the value empty if not yet available.</div>

        <div className="space-y-3 max-h-72 overflow-auto">
          {testsInputs.length ? testsInputs.map((t, idx) => (
            <div key={t.key} className="p-3 border rounded bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between mb-2">
                <strong className="text-sm">{humanizeKey(t.key)}</strong>
                <span className="text-xs text-gray-500">{t.key}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-1 gap-2">
                <Input
                  label="Value"
                  value={t.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTest(idx, { value: e.target.value })}
                  placeholder="Enter measured value (optional)"
                />
              </div>
            </div>
          )) : (
            <div className="p-3 text-sm text-gray-500">No tests selected.</div>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">{submitLabel || (mode === 'result' ? 'Create Result(s)' : 'Create Order')}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default LabOrderInputModal;
