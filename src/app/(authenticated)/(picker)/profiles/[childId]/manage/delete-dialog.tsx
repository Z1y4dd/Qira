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
import { type DeleteActionState, deleteChildAction } from './actions';

export function DeleteChildDialog({ childId, childName }: { childId: string; childName: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [state, formAction, pending] = useActionState<DeleteActionState | undefined, FormData>(
    deleteChildAction,
    undefined,
  );

  const matches = typed.normalize('NFC') === childName.normalize('NFC');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="lg" className="w-full">
          <ArabicText size="ui">حذف الملف الشخصي</ArabicText>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <ArabicText size="reader">حذف ملف الطفل</ArabicText>
          </DialogTitle>
          <DialogDescription>
            <ArabicText size="ui">
              سيُحذف الملف وكلّ سجلّ القراءة المرتبط به نهائيّاً. لا يمكن التراجع.
            </ArabicText>
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="childId" value={childId} />
          <div className="space-y-2">
            <Label htmlFor="confirmName">
              <ArabicText size="ui">
                اكتب اسم الطفل (<bdi>{childName}</bdi>) للتأكيد
              </ArabicText>
            </Label>
            <Input
              id="confirmName"
              name="confirmName"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          {state?.error && (
            <ArabicText size="caption" className="block text-destructive">
              {state.error}
            </ArabicText>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              <ArabicText size="ui">إلغاء</ArabicText>
            </Button>
            <Button type="submit" variant="destructive" disabled={!matches || pending}>
              <ArabicText size="ui">{pending ? 'جارٍ الحذف…' : 'حذف نهائيّاً'}</ArabicText>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
