import { ChevronDown, Users } from 'lucide-react';
import Link from 'next/link';
import { setActiveChildAction } from '@/app/(authenticated)/(picker)/choose-child/actions';
import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ChildProfile } from '@/services/profiles';

export function ActiveChildChip({
  active,
  others,
}: {
  active: ChildProfile;
  others: ChildProfile[];
}) {
  return (
    <div className="fixed top-4 end-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ArabicText size="ui">{active.displayName}</ArabicText>
            <ChevronDown className="size-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel>
            <ArabicText size="caption">الملف النشط: {active.displayName}</ArabicText>
          </DropdownMenuLabel>
          {others.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {others.map((child) => (
                <form key={child.id} action={setActiveChildAction.bind(null, child.id)}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full text-start cursor-pointer">
                      <ArabicText size="ui">{child.displayName}</ArabicText>
                    </button>
                  </DropdownMenuItem>
                </form>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/choose-child" className="gap-2">
              <Users className="size-4" aria-hidden="true" />
              <ArabicText size="caption">إدارة الملفات</ArabicText>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
