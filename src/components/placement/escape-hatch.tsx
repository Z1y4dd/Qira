'use client';

import type React from 'react';
import { useState, useTransition } from 'react';
import { ArabicText } from '@/components/arabic-text';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export type EscapeHatchMode = 'placement' | 'reader';

export interface EscapeHatchProps {
  mode: EscapeHatchMode;
  attemptId?: string;
  childId?: string;
}

export function EscapeHatch(props: EscapeHatchProps): React.JSX.Element {
  const [openReason, setOpenReason] = useState<'too_hard' | 'too_easy' | null>(null);
  const [isPending, startTransition] = useTransition();

  // PLAN-05-ACTION-WIRING: replace this stub with abortPlacementAction({ attemptId, reason }) for mode === 'placement', and shiftLevelAction({ childId, direction }) for mode === 'reader' (Phase 4).
  function handleConfirm() {
    startTransition(() => {
      console.warn(
        '[PLAN-05] escape-hatch action wiring pending — confirmed reason:',
        openReason,
        'mode:',
        props.mode,
      );
      setOpenReason(null);
    });
  }

  return (
    <>
      <div className="fixed end-4 bottom-4 z-50 flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-label="هذا صعب"
          onClick={() => setOpenReason('too_hard')}
        >
          <ArabicText size="ui">هذا صعب 😟</ArabicText>
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label="هذا سهل"
          onClick={() => setOpenReason('too_easy')}
        >
          <ArabicText size="ui">هذا سهل 😊</ArabicText>
        </Button>
      </div>

      <AlertDialog
        open={openReason !== null}
        onOpenChange={(open) => {
          if (!open) setOpenReason(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <ArabicText size="reader">هل أنت متأكد؟</ArabicText>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <ArabicText size="ui">
                {openReason === 'too_hard' ? 'سنختار لك مستوى أسهل.' : 'سنختار لك مستوى أصعب.'}
              </ArabicText>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              <ArabicText size="ui">إلغاء</ArabicText>
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
              <ArabicText size="ui">{isPending ? 'جارٍ…' : 'تأكيد'}</ArabicText>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
