import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ModalBase } from './ModalBase';
import { useAppStore } from '../../store';
import { Api } from '../../api';
import { Button, Icon, Input } from '../ui';

export function InitiateYearModal() {
  const { modals, closeModal, setYear, pinSession } = useAppStore();
  const open = modals.initiateYear;

  const qc = useQueryClient();
  const [year, setYearInput] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && pinSession) {
      const tm = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(tm);
    }
  }, [open, pinSession]);

  async function save() {
    const y = Number(year);

    if (!Number.isInteger(y) || String(y).length !== 4) {
      setError(true);
      setTimeout(() => setError(false), 400);
      return;
    }

    await Api.years.add(y);
    setYear(y);

    setYearInput('');
    await qc.invalidateQueries({ queryKey: ['years'] });

    closeModal('initiateYear');
  }

  return (
    <ModalBase
      open={open}
      title="Initiate MOPAY"
      subtitle="Create the first year to start tracking incomes, expenses and savings."
      icon={<Icon name="calendar-month" />}
      onClose={() => {}}
      disableClose
      size="sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input
          ref={inputRef}
          id="init-year-input"
          label="Year"
          hint="Four digits, for example 2026."
          inputMode="numeric"
          placeholder="YYYY"
          maxLength={4}
          value={year}
          error={error ? 'Enter a four-digit year.' : undefined}
          onChange={(e) => setYearInput(e.target.value.replace(/[^0-9]/g, ''))}
        />
        <div className="ui-dialog-actions">
          <Button variant="ghost" onClick={() => setYearInput('')} disabled={!year.length}>
            Clear
          </Button>
          <Button type="submit" variant="primary" disabled={year.length !== 4}>
            Start
          </Button>
        </div>
      </form>
    </ModalBase>
  );
}
