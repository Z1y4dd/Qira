'use client';

import { useActionState, useState } from 'react';
import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PlacementState } from '@/services/placement';
import { type ResetActionState, resetPlacementAction } from './actions';

interface ResetPlacementFormProps {
  childId: string;
  childName: string;
  state: PlacementState;
}

export function ResetPlacementForm({ childId, childName, state }: ResetPlacementFormProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [actionState, formAction, pending] = useActionState<ResetActionState | undefined, FormData>(
    resetPlacementAction,
    undefined,
  );

  const matches = typed.normalize('NFC') === childName.normalize('NFC');
  const isDisabled = state === 'not_started';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="w-full" disabled={isDisabled} type="button">
          <ArabicText size="ui">إعادة التقييم</ArabicText>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <ArabicText size="reader">إعادة التقييم</ArabicText>
          </DialogTitle>
          <DialogDescription>
            <ArabicText size="ui">
              سيُحذف التقييم السابق وسيبدأ الطفل من جديد. لا يمكن التراجع.
            </ArabicText>
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="childId" value={childId} />
          <div className="space-y-2">
            <Label htmlFor="resetConfirmName">
              <ArabicText size="ui">
                اكتب اسم الطفل (<bdi>{childName}</bdi>) للتأكيد
              </ArabicText>
            </Label>
            <Input
              id="resetConfirmName"
              name="confirmName"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          {actionState?.error && (
            <ArabicText size="caption" className="block text-destructive">
              {actionState.error}
            </ArabicText>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              <ArabicText size="ui">إلغاء</ArabicText>
            </Button>
            <Button type="submit" variant="default" disabled={!matches || pending}>
              <ArabicText size="ui">{pending ? 'جارٍ…' : 'تأكيد'}</ArabicText>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
