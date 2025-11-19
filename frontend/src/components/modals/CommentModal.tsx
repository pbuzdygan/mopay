import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Api } from '../../api';
import { useAppStore } from '../../store';
import { ModalBase } from './ModalBase';
import { FormSection } from '../FormSection';
import { SoftButton } from '../SoftButton';

export function CommentModal() {
  const qc = useQueryClient();
  const { modals, closeModal } = useAppStore();
  const { open, id, text } = modals.comment;
  const tab = useAppStore((s) => s.tab);
  const year = useAppStore((s) => s.year);
  const [value, setValue] = useState(text ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setValue(text ?? '');
      const tm = setTimeout(() => textareaRef.current?.focus(), 40);
      return () => clearTimeout(tm);
    }
  }, [open, text]);

  async function submit() {
    if (id != null && year) {
      await Api.entries.patch(id, { comment: value });
      closeModal('comment');
      qc.invalidateQueries({
        queryKey: ['entries', tab === 'incomes' ? 'income' : 'expense', year],
      });
    }
  }

  return (
    <ModalBase
      open={open}
      title="Entry comment"
      //subtitle="Add an optional note for this entry."
      icon="💬"
      onClose={() => closeModal('comment')}
      size="md"
    >
      <div className="space-y-4">
        <FormSection
          //label="Notes"
          title="Comment"
          //description="Visible only to you."
        >
          <div className="field-stack">
            <label className="field-label" htmlFor="entry-comment">
              Text
            </label>
            <textarea
              id="entry-comment"
              ref={textareaRef}
              className="input h-32 resize-none"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <p className="field-helper">
              Keep it short and helpful.
            </p>
          </div>
        </FormSection>

        <div className="modal-footer-premium flex justify-end gap-2">
          <SoftButton variant="ghost" onClick={() => closeModal('comment')}>
            Cancel
          </SoftButton>
          <button className="btn" onClick={submit} disabled={id == null}>
            Save comment
          </button>
        </div>
      </div>
    </ModalBase>
  );
}
