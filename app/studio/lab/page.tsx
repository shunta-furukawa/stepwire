import { redirect } from 'next/navigation';

/** The lab became the studio. The old address keeps working. */
export default function LabPage() {
  redirect('/studio');
}
